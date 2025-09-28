import type { Octokit } from '@octokit/rest' with { "resolution-mode": "import" };
import type { Webhooks } from '@octokit/webhooks' with { "resolution-mode": "import" };

import { O, pipe, RA, TE } from '@that-hatter/scrapi-factory/fp';
import * as buffer from 'node:buffer';
import * as fs from 'node:fs/promises';
import * as http from 'node:http';
import * as path from 'node:path';
import simpleGit from 'simple-git';
import { Decoder, str } from '.';
import { CtxWithoutResources } from '../../Ctx';
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


export type Source = {
  readonly owner: string;
  readonly repo: string;
  readonly branch: string;
};

export const sourceDecoder = pipe(
  Decoder.string,
  Decoder.parse((s) => {
    const [url, branch] = str.split(' ')(s);
    const [fst, snd] = str.split('github.com/')(url);

    const ownerAndRepo = snd || fst;
    const [owner, repo] = str.split('/')(ownerAndRepo);

    if (!repo) return Decoder.failure(s, 'must be a valid Github repo');
    return Decoder.success<Source>({
      owner,
      repo,
      branch: branch || 'master',
    });
  })
);

export const repoURL = (src: Source) =>
  `https://github.com/${src.owner}/${src.repo}/`;

export const treeURL = (src: Source, path = '') =>
  `https://github.com/${src.owner}/${src.repo}/tree/${src.branch}/${path}`;

export const blobURL = (src: Source, path = '') =>
  `https://github.com/${src.owner}/${src.repo}/blob/${src.branch}/${path}`;

export const rawURL = (src: Source, path: string) =>
  `https://raw.githubusercontent.com/${src.owner}/${src.repo}/${src.branch}/${path}`;

export const searchURL = (src: Source, searchTerm: string) =>
  `https://github.com/search?q=repo%3A${src.owner}%2F${src.repo}+${searchTerm}&type=code`;

export const isSource = (src1: Source, src2: Source) =>
  treeURL(src1) === treeURL(src2);

const git = simpleGit();

export const pullOrClone = (name: string, src: Source) => {
  const dataPath = path.join(process.cwd(), 'data');
  const localPath = path.join(dataPath, name);
  return utils.taskify(() =>
    git
      .cwd(localPath)
      .pull()
      .catch(() =>
        fs
          .rm(localPath, { recursive: true, force: true })
          .then(() =>
            git
              .cwd(dataPath)
              .clone(repoURL(src), name, [
                '--depth=1',
                '--single-branch',
                '--branch',
                src.branch,
              ])
          )
      )
  );
};

export const updateFile =
  (
    { owner, repo, branch }: Source,
    path: string,
    content: string,
    message: string
  ) =>
  (ctx: CtxWithoutResources) =>
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

export const listRepoFiles =
  ({ owner, repo, branch }: Source) =>
  (ctx: CtxWithoutResources) => {
    const ref = 'heads/' + branch;
    const git = ctx.github.git;
    return pipe(
      utils.taskify(() => git.getRef({ owner, repo, ref })),
      TE.map((refData) => refData.data.object.sha),
      TE.flatMap((commitSha) =>
        utils.taskify(() =>
          git.getCommit({ owner, repo, commit_sha: commitSha })
        )
      ),
      TE.map((commitData) => commitData.data.tree.sha),
      TE.flatMap((treeSha) =>
        utils.taskify(() =>
          git.getTree({ owner, repo, tree_sha: treeSha, recursive: 'true' })
        )
      ),
      TE.map((treeData) =>
        pipe(
          treeData.data.tree,
          RA.filterMap((f) =>
            f.type === 'blob' ? O.fromNullable(f.path) : O.none
          )
        )
      )
    );
  };
