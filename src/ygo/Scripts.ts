import { O, pipe, RA, RR, RTE } from '@that-hatter/scrapi-factory/fp';
import { Ctx, CtxWithoutResources } from '../Ctx';
import { Github, Resource } from '../lib/modules';

export type Scripts = RR.ReadonlyRecord<string, string>;

const update = pipe(
  RTE.ask<CtxWithoutResources>(),
  RTE.flatMap(({ sources }) =>
    pipe(
      Github.listRepoFiles(sources.scripts),
      RTE.map(
        RA.filterMap((filename) => {
          if (!filename.endsWith('.lua')) return O.none;
          const [_, id] = filename
            .substring(0, filename.length - 4)
            .split('/c');
          if (!id) return O.none;
          return O.some([
            id,
            Github.blobURL(sources.scripts) + '/' + filename,
          ] as const);
        })
      ),
      RTE.map(RR.fromEntries)
    )
  )
);

export const resource: Resource.Resource<'scripts'> = {
  key: 'scripts',
  description: 'Card script filepaths',
  update,
  init: update,
  commitFilter: (ctx) => (src, files) =>
    Github.isSource(src, ctx.sources.scripts) &&
    files.some((f) => f.endsWith('.lua') && f.includes('/c')),
};

export const getUrl = (id: number) => (ctx: Ctx) =>
  O.fromNullable(ctx.scripts[id.toString()]);
