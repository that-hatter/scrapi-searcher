import { O, pipe, RA, RNEA, RR, TE } from '@that-hatter/scrapi-factory/fp';
import { Ctx, CtxWithoutResources } from '../Ctx';
import { Decoder, FS, Github, str } from '../lib/modules';
import { DeepReadonly } from '../lib/utils';

const jsonDecoder = pipe(
  Decoder.record(Decoder.array(Decoder.string)),
  Decoder.map(RR.toEntries),
  Decoder.map(
    RA.flatMap(([full, aliases]) => aliases.map((a) => [a, full] as const))
  ),
  Decoder.map(RR.fromEntries)
);

export type Shortcuts = DeepReadonly<Decoder.TypeOf<typeof jsonDecoder>>;

const RESOURCE_PATH = 'data/shortcuts.json';

export const load = (
  ctx: CtxWithoutResources
): TE.TaskEither<string, Shortcuts> =>
  pipe(
    ctx.sources.misc,
    O.map((repo) =>
      pipe(
        Github.localPath(repo, RESOURCE_PATH),
        FS.readJsonFile,
        TE.flatMapEither(Decoder.decode(jsonDecoder))
      )
    ),
    O.getOrElse(() => TE.right({}))
  );

export const resolveShortcuts = (query: string) => (ctx: Ctx) =>
  pipe(
    query,
    str.split(/\s+/),
    RNEA.map((s) => {
      // TODO: instead of replacing the original string then searching,
      // use shortcuts as alternative search results
      if (s.startsWith('(') && s.endsWith(')')) return s;
      const key = s.toLowerCase().replaceAll(/[\p{P}\p{S}]+/gu, '');
      return ctx.shortcuts[key] ?? s;
    }),
    str.intercalate(' ')
  );
