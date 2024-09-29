import { O, pipe, RA, RR, TE } from '@that-hatter/scrapi-factory/fp';
import fetch from 'node-fetch';
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
  'DeltaPuppetOfStrings/master/mappings.json';

const update = pipe(
  utils.taskify(() => fetch(URL).then((response) => response.text())),
  TE.flatMapIOEither((s) => utils.fallibleIO(() => JSON.parse(s))),
  TE.flatMapEither(Decoder.parse(decoder))
);

export const data: Data.Data<'betaIds'> = {
  key: 'betaIds',
  description: 'Beta passcode mappings.',
  update,
  init: update,
  commitFilter: (repo, files) =>
    repo === 'DeltaPuppetOfStrings' && files.includes('mappings.json'),
};

export const toBabelCard = (betaId: number) => (ctx: Ctx) =>
  pipe(
    O.fromNullable(ctx.betaIds[betaId.toString()]),
    O.flatMap((id) => O.fromNullable(ctx.babel.record[id.toString()]))
  );