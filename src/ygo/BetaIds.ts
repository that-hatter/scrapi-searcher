import { O, pipe, RA, RR, RTE } from '@that-hatter/scrapi-factory/fp';
import { Babel } from '.';
import { Ctx, CtxWithoutResources } from '../Ctx';
import type { Resource } from '../lib/modules';
import { Decoder, Fetch, Github } from '../lib/modules';
import { DeepReadonly } from '../lib/utils';

const decoder = pipe(
  Decoder.struct({
    mappings: Decoder.array(Decoder.tuple(Decoder.number, Decoder.number)),
  }),
  Decoder.map(({ mappings }) => mappings),
  Decoder.map(RA.map(([beta, current]) => [beta.toString(), current] as const)),
  Decoder.map(RR.fromEntries)
);

export type BetaIds = DeepReadonly<Decoder.TypeOf<typeof decoder>>;

const RESOURCE_PATH = 'mappings.json';

const update = pipe(
  RTE.ask<CtxWithoutResources>(),
  RTE.map(({ sources }) => Github.rawURL(sources.delta, RESOURCE_PATH)),
  RTE.flatMapTaskEither(Fetch.json),
  RTE.flatMapEither(Decoder.decode(decoder))
);

export const resource: Resource.Resource<'betaIds'> = {
  key: 'betaIds',
  description: 'Beta passcode mappings.',
  update,
  init: update,
  commitFilter: (ctx) => (src, files) =>
    Github.isSource(src, ctx.sources.delta) && files.includes(RESOURCE_PATH),
};

export const toBabelCard =
  (betaId: number | string) =>
  (ctx: Ctx): O.Option<Babel.Card> =>
    pipe(
      O.fromNullable(ctx.betaIds[betaId.toString()]),
      O.flatMap((id) => Babel.getCard(id)(ctx))
    );
