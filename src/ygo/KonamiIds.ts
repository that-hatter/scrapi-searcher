import { O, pipe, RA, RR, TE } from '@that-hatter/scrapi-factory/fp';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { Ctx } from '../Ctx';
import { PATHS } from '../lib/constants';
import type { Data } from '../lib/modules';
import { Decoder } from '../lib/modules';
import { DeepReadonly, utils } from '../lib/utils';

const decoder = Decoder.struct({
  master: Decoder.record(Decoder.number),
  rush: Decoder.record(Decoder.number),
});

export type KonamiIds = DeepReadonly<Decoder.TypeOf<typeof decoder>>;

const URL =
  'https://raw.githubusercontent.com/that-hatter/' +
  'scrapi-searcher/master/data/konamiIds.json';

const update = pipe(
  utils.taskify(() => fs.readFile(path.join(PATHS.DATA, 'konamiIds.json'))),
  TE.map((buf) => buf.toString()),
  // utils.taskify(() => fetch(URL).then((response) => response.text())),
  TE.flatMapIOEither((s) => utils.fallibleIO(() => JSON.parse(s))),
  TE.flatMapEither(Decoder.parse(decoder))
);

export const data: Data.Data<'konamiIds'> = {
  key: 'konamiIds',
  description: 'Konami ID mappings.',
  update,
  init: update,
  commitFilter: (repo, files) =>
    repo === 'scrapi-searcher' && files.includes('data/konamiIds.json'),
};

export const toBabelCard =
  (scope: 'master' | 'rush', konamiId: number) => (ctx: Ctx) =>
    pipe(
      RR.toEntries(ctx.konamiIds[scope]),
      RA.findFirst(([_, kid]) => konamiId === kid),
      O.flatMap(([id]) => O.fromNullable(ctx.babel.record[id]))
    );

export const getKonamiId =
  (scopes: ReadonlyArray<string>, passcode: number) => (ctx: Ctx) =>
    O.fromNullable(
      ctx.konamiIds[scopes.includes('Rush') ? 'rush' : 'master'][
        passcode.toString()
      ]
    );
