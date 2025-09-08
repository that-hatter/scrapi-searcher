import { O, pipe, RA, RNEA, RR, TE } from '@that-hatter/scrapi-factory/fp';
import { Ctx, CtxWithoutResources } from '../Ctx';
import type { Resource } from '../lib/modules';
import { Decoder, Fetch, Github, str } from '../lib/modules';
import { DeepReadonly } from '../lib/utils';

const decoder = pipe(
  Decoder.record(Decoder.array(Decoder.string)),
  Decoder.map(RR.toEntries),
  Decoder.map(
    RA.flatMap(([full, aliases]) => aliases.map((a) => [a, full] as const))
  ),
  Decoder.map(RR.fromEntries)
);

export type Shortcuts = DeepReadonly<Decoder.TypeOf<typeof decoder>>;

const RESOURCE_PATH = 'data/shortcuts.json';

const update = ({ sources }: CtxWithoutResources) =>
  pipe(
    sources.misc,
    O.map(({ repo }) =>
      pipe(
        Github.rawURL(repo, RESOURCE_PATH),
        Fetch.json,
        TE.flatMapEither(Decoder.decode(decoder))
      )
    ),
    O.getOrElse(() => TE.right(<Shortcuts>{}))
  );

export const resource: Resource.Resource<'shortcuts'> = {
  key: 'shortcuts',
  description: 'Card search shortcuts.',
  update,
  init: update,
  commitFilter: (ctx) => (src, files) =>
    O.isSome(ctx.sources.misc) &&
    src === ctx.sources.misc.value.repo &&
    files.includes(RESOURCE_PATH),
};

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
