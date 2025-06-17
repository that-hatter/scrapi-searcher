import { O, pipe, RA, RR, RTE, TE } from '@that-hatter/scrapi-factory/fp';
import fetch from 'node-fetch';
import { Babel } from '.';
import { Ctx } from '../Ctx';
import type { Data } from '../lib/modules';
import { Decoder } from '../lib/modules';
import { DeepReadonly, utils } from '../lib/utils';

const decoder = pipe(
  Decoder.struct({
    mappings: Decoder.array(Decoder.tuple(Decoder.number, Decoder.number)),
  }),
  Decoder.map(({ mappings }) => mappings),
  Decoder.map(RA.map(([beta, current]) => [beta.toString(), current] as const)),
  Decoder.map(RR.fromEntries)
);

export type BetaIds = DeepReadonly<Decoder.TypeOf<typeof decoder>>;

const URL =
  'https://raw.githubusercontent.com/ProjectIgnis/' +
  'DeltaBagooska/master/mappings.json';

const update = pipe(
  utils.taskify(() => fetch(URL).then((response) => response.json())),
  TE.flatMapEither(Decoder.parse(decoder)),
  RTE.fromTaskEither
);

export const data: Data.Data<'betaIds'> = {
  key: 'betaIds',
  description: 'Beta passcode mappings.',
  update,
  init: update,
  commitFilter: (repo, files) =>
    repo === 'DeltaBagooska' && files.includes('mappings.json'),
};

export const toBabelCard =
  (betaId: number | string) =>
  (ctx: Ctx): O.Option<Babel.Card> =>
    pipe(
      O.fromNullable(ctx.betaIds[betaId.toString()]),
      O.flatMap((id) => Babel.getCard(id)(ctx))
    );
