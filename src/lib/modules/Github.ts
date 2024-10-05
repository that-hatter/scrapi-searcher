import { Octokit } from '@octokit/rest';
import { createNodeMiddleware, Webhooks } from '@octokit/webhooks';
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

export const init = (
  accessToken: string,
  webhookPort: number,
  webhookSecret: string
) =>
  TE.fromIOEither(
    utils.fallibleIO((): Github => {
      const rest = new Octokit({ auth: accessToken });
      const webhook = new Webhooks({ secret: webhookSecret });
      const webhookServer = http
        .createServer(
          createNodeMiddleware(webhook, { path: '/api/webhook/github' })
        )
        .listen(webhookPort);

      return { rest, webhook, webhookServer };
    })
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
