import { Octokit } from '@octokit/rest';
import { createNodeMiddleware, Webhooks } from '@octokit/webhooks';
import { TE } from '@that-hatter/scrapi-factory/fp';
import * as fs from 'node:fs/promises';
import * as http from 'node:http';
import * as path from 'node:path';
import simpleGit from 'simple-git';
import { Decoder } from '.';
import { utils } from '../utils';

export type Github = {
  readonly rest: Octokit;
  readonly webhook: Webhooks;
  readonly webhookServer: http.Server;
};

export const configDecoder = Decoder.struct({
  accessToken: Decoder.string,
  webhookSecret: Decoder.string,
  webhookPort: Decoder.number,
});

export const init = (cfg: Decoder.TypeOf<typeof configDecoder>) =>
  TE.fromIOEither(
    utils.fallibleIO((): Github => {
      const rest = new Octokit({ auth: cfg.accessToken });
      const webhook = new Webhooks({ secret: cfg.webhookSecret });
      const webhookServer = http
        .createServer(
          createNodeMiddleware(webhook, { path: '/api/webhook/github' })
        )
        .listen(cfg.webhookPort);

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
          .then(() => git.cwd(dataPath).clone(repoUrl))
      )
  );
};
