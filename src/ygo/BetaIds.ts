import { O, pipe, RA, RR, TE } from '@that-hatter/scrapi-factory/fp';
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

const update = (ctx: CtxWithoutResources): TE.TaskEither<string, BetaIds> =>
  pipe(
    ctx.sources.delta,
    O.map((repo) =>
      pipe(
        Github.rawURL(repo, RESOURCE_PATH),
        Fetch.json,
        TE.flatMapEither(Decoder.decode(decoder))
      )
    ),
    O.getOrElse(() => TE.right({}))
  );

export const resource: Resource.Resource<'betaIds'> = {
  key: 'betaIds',
  description: 'Beta passcode mappings.',
  update,
  init: update,
  commitFilter: (ctx) => (src, files) =>
    O.isSome(ctx.sources.delta) &&
    Github.isSource(src, ctx.sources.delta.value) &&
    files.includes(RESOURCE_PATH),
};

export const toBabelCard =
  (betaId: number | string) =>
  (ctx: Ctx): O.Option<Babel.Card> =>
    pipe(
      O.fromNullable(ctx.betaIds[betaId.toString()]),
      O.flatMap((id) => Babel.getCard(id)(ctx))
    );
