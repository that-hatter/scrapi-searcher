import { O, pipe, RA, RR, TE } from '@that-hatter/scrapi-factory/fp';
import { Ctx, CtxWithoutResources } from '../Ctx';
import { FS, Github, str } from '../lib/modules';
import { utils } from '../lib/utils';

export type Scripts = RR.ReadonlyRecord<string, string>;

const loadSingleSource = (
  source: Github.Source
): TE.TaskEither<string, Scripts> => {
  const localPath = Github.localPath(source, 'script');
  return pipe(
    localPath,
    FS.getFilepathsWithExt('.lua'),
    TE.map(
      RA.filterMap((filepath) => {
        const cid = pipe(filepath, FS.filenameFromPath, O.map(FS.removeExt));
        if (O.isNone(cid)) return O.none;

        const relativePath = pipe(
          filepath.substring(localPath.length),
          FS.splitFilepath,
          RA.prepend('script'),
          str.join('/')
        );
        return O.some([
          cid.value.substring(1),
          Github.blobURL(source, relativePath),
        ] as const);
      })
    ),
    TE.map(RR.fromEntries)
  );
};

export const load = (
  ctx: CtxWithoutResources
): TE.TaskEither<string, Scripts> =>
  pipe(
    [ctx.sources.base, ...ctx.sources.expansions],
    RA.map(loadSingleSource),
    TE.sequenceArray,
    TE.map(utils.mergeRecords)
  );

export const getRawUrl =
  (id: number) =>
  (ctx: Ctx): O.Option<string> =>
    O.fromNullable(ctx.scripts[id.toString()]);

export const getUrl = (id: number) => (ctx: Ctx) =>
  pipe(
    getRawUrl(id)(ctx),
    O.map((url) =>
      pipe(
        ctx.sources.scripts,
        O.map((src) => Github.blobURL(src, url.split('/script/')[1])),
        O.getOrElse(() => url)
      )
    )
  );
