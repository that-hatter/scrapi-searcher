import { E, O, pipe, RA, RR, TE } from '@that-hatter/scrapi-factory/fp';
import { Babel } from '.';
import { Ctx, CtxWithoutResources } from '../Ctx';
import { Decoder, FS, Github } from '../lib/modules';
import { DeepReadonly, utils } from '../lib/utils';

const jsonDecoder = pipe(
  Decoder.struct({
    mappings: Decoder.array(Decoder.tuple(Decoder.number, Decoder.number)),
  }),
  Decoder.map(({ mappings }) => mappings),
  Decoder.map(RA.map(([beta, current]) => [beta.toString(), current] as const)),
  Decoder.map(RR.fromEntries)
);

export type BetaIds = DeepReadonly<Decoder.TypeOf<typeof jsonDecoder>>;

const RESOURCE_PATH = 'mappings.json';

export const load = (
  ctx: CtxWithoutResources
): TE.TaskEither<string, BetaIds> =>
  pipe(
    ctx.sources.expansions,
    RA.map((src) =>
      pipe(
        Github.localPath(src, RESOURCE_PATH),
        FS.readJsonFile,
        TE.orElse(() => TE.right({ mappings: [] }))
      )
    ),
    TE.sequenceArray,
    TE.map(RA.map(Decoder.decode(jsonDecoder))),
    TE.flatMapEither(E.sequenceArray),
    TE.map(utils.mergeRecords)
  );

export const toBabelCard =
  (betaId: number | string) =>
  (ctx: Ctx): O.Option<Babel.Card> =>
    pipe(
      O.fromNullable(ctx.betaIds[betaId.toString()]),
      O.flatMap((id) => Babel.getCard(id)(ctx))
    );
