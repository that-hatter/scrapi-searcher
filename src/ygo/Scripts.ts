import { O, pipe, RA, RR, TE } from '@that-hatter/scrapi-factory/fp';
import { Ctx, CtxWithoutResources } from '../Ctx';
import { Err, FS, Github, str } from '../lib/modules';
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
        ctx.sources.scriptLink,
        O.map((src) => Github.blobURL(src, url.split('/script/')[1])),
        O.getOrElse(() => url)
      )
    )
  );

export const readFile = (id: number) => (ctx: Ctx) =>
  pipe(
    getRawUrl(id)(ctx),
    TE.fromOption(() => Err.forAll('Could not find script file: ' + id)),
    TE.flatMap((url) =>
      pipe(
        url,
        str.after('https://github.com/'),
        str.replace('blob/', ''),
        str.split('/'),
        ([owner, repo, branch, ...path]) =>
          Github.localPath(
            { owner, repo: repo ?? '', branch: branch ?? '' },
            path.join('/')
          ),
        FS.readTextFile,
        TE.mapError(() => Err.forAll('Failed to read script file: ' + id))
      )
    )
  );
