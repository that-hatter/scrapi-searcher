import type { Octokit } from '@octokit/rest' with { "resolution-mode": "import" };
import type { Webhooks } from '@octokit/webhooks' with { "resolution-mode": "import" };

import { pipe, TE } from '@that-hatter/scrapi-factory/fp';
import * as buffer from 'node:buffer';
import * as fs from 'node:fs/promises';
import * as http from 'node:http';
import * as path from 'node:path';
import simpleGit from 'simple-git';
import { str } from '.';
import { Ctx } from '../../Ctx';
import { utils } from '../utils';

export type Github = {
  readonly rest: Octokit;
  readonly webhook: Webhooks;
  readonly webhookServer: http.Server;
};

const ghRestImport = import('@octokit/rest');
const ghWebhooksImport = import('@octokit/webhooks');

export const init = (
  accessToken: string,
  webhookPort: number,
  webhookSecret: string
): TE.TaskEither<string, Github> =>
  pipe(
    TE.Do,
    TE.bind('ghWebhooks', () => utils.taskify(() => ghWebhooksImport)),
    TE.let(
      'webhook',
      ({ ghWebhooks }) => new ghWebhooks.Webhooks({ secret: webhookSecret })
    ),
    TE.let('middleWare', ({ webhook, ghWebhooks }) =>
      ghWebhooks.createNodeMiddleware(webhook, { path: '/api/webhook/github' })
    ),
    TE.bind('rest', () =>
      utils.taskify(() =>
        ghRestImport.then(({ Octokit }) => new Octokit({ auth: accessToken }))
      )
    ),
    TE.bind('webhookServer', ({ middleWare }) =>
      TE.fromIOEither(
        utils.fallibleIO(() =>
          http.createServer(middleWare).listen(webhookPort)
        )
      )
    )
  );

const git = simpleGit();

export const pullOrClone = (name: string, repoUrl: string) => {
  const dataPath = path.join(process.cwd(), 'data');
  const repoPath = path.join(dataPath, name);
  return utils.taskify(() =>
    git
      .cwd(repoPath)
      .pull()
      .catch(() =>
        fs
          .rm(repoPath, { recursive: true, force: true })
          .then(() => git.cwd(dataPath).clone(repoUrl, ['--depth=1']))
      )
  );
};

export const updateFile =
  (
    owner: string,
    repo: string,
    branch: string,
    path: string,
    content: string,
    message: string
  ) =>
  (ctx: Ctx) =>
    pipe(
      utils.taskify(() => ctx.github.repos.getContent({ owner, repo, path })),
      TE.flatMapNullable(
        ({ data }) => (data instanceof Array ? data[0]?.sha : data?.sha),
        () => 'Failed to get file sha: ' + str.inlineCode(path)
      ),
      TE.flatMap((sha) =>
        utils.taskify(() =>
          ctx.github.rest.repos.createOrUpdateFileContents({
            owner,
            repo,
            branch,
            path,
            sha,
            message: '[auto] ' + message,
            content: buffer.Buffer.from(content).toString('base64'),
          })
        )
      )
    );
