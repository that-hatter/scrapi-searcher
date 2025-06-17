import { O, pipe, RA, RR, RTE } from '@that-hatter/scrapi-factory/fp';
import { Ctx } from '../Ctx';
import { Data } from '../lib/modules';
import { listRepoFiles } from '../lib/modules/Github';

const OWNER = 'ProjectIgnis';
const REPO = 'CardScripts';
const BRANCH = 'master';

export type Scripts = RR.ReadonlyRecord<string, string>;

const update = pipe(
  listRepoFiles(OWNER, REPO, BRANCH),
  RTE.map(
    RA.filterMap((f) => {
      if (!f.endsWith('.lua')) return O.none;
      const [_, id] = f.substring(0, f.length - 4).split('/c');
      if (!id) return O.none;
      return O.some([
        id,
        `https://github.com/${OWNER}/${REPO}/blob/${BRANCH}/${f}`,
      ] as const);
    })
  ),
  RTE.map(RR.fromEntries)
);

export const data: Data.Data<'scripts'> = {
  key: 'scripts',
  description: 'Card script filepaths from the CardScript repo.',
  update,
  init: update,
  commitFilter: (repo, files) =>
    repo === 'CardScripts' &&
    files.some((f) => f.endsWith('.lua') && f.includes('/c')),
};

export const getUrl = (id: number) => (ctx: Ctx) =>
  O.fromNullable(ctx.scripts[id.toString()]);
