import { pipe, RA, RNEA, RR, RTE } from '@that-hatter/scrapi-factory/fp';
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

const update = pipe(
  RTE.ask<CtxWithoutResources>(),
  RTE.map(({ sources }) => Github.rawURL(sources.misc, RESOURCE_PATH)),
  RTE.flatMapTaskEither(Fetch.json),
  RTE.flatMapEither(Decoder.decode(decoder))
);

export const resource: Resource.Resource<'shortcuts'> = {
  key: 'shortcuts',
  description: 'Card search shortcuts.',
  update,
  init: update,
  commitFilter: (ctx) => (src, files) =>
    Github.isSource(src, ctx.sources.misc) && files.includes(RESOURCE_PATH),
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
