import {
  flow,
  O,
  pipe,
  RA,
  RNEA,
  RR,
  TE,
} from '@that-hatter/scrapi-factory/fp';
import fetch from 'node-fetch';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { setTimeout } from 'timers/promises';
import { URLS } from '../lib/constants';
import { Ctx, Decoder, str } from '../lib/modules';
import { utils } from '../lib/utils';

// -----------------------------------------------------------------------------
// yugipedia API
// -----------------------------------------------------------------------------

export const url =
  (limit: number, offset: number) => (query: ReadonlyArray<string>) =>
    flow(
      paramsSection,
      RA.of,
      RA.prepend(querySection(query)),
      RA.append(`limit=${limit}|offset=${offset}&format=json`),
      str.intercalate('|'),
      str.prepend(URLS.YUGIPEDIA_API)
    );

export const querySection = flow(
  RA.map(encodeURIComponent),
  str.intercalate('||'),
  str.clamped('[[', ']]')
);

export const paramsSection = flow(
  RA.map(encodeURIComponent),
  RA.map(str.prepend('?')),
  str.intercalate('|')
);

export const fetchCards = (delaySecs: number, url: string) =>
  utils.taskify(() =>
    setTimeout(delaySecs * 1000)
      .then(() => fetch(url))
      .then((resp) => resp.json())
  );

export const fetchedResultDecoder = <A>(dc: Decoder.Decoder<unknown, A>) =>
  pipe(
    Decoder.struct({
      query: Decoder.struct({
        results: Decoder.record(Decoder.struct({ printouts: dc })),
      }),
    }),
    Decoder.map(({ query }) =>
      pipe(
        query.results,
        RR.map(({ printouts }) => printouts)
      )
    )
  );

// -----------------------------------------------------------------------------
// fetching ids (konamiId, password, name)
// -----------------------------------------------------------------------------

const savedIdsDecoder = Decoder.struct({
  name: Decoder.string,
  konamiId: Decoder.option(Decoder.number),
  passcode: Decoder.option(Decoder.number),
});

const savedIdsListDecoder = Decoder.struct({
  master: Decoder.readonly(Decoder.array(savedIdsDecoder)),
  rush: Decoder.readonly(Decoder.array(savedIdsDecoder)),
});

export type Ids = Readonly<Decoder.TypeOf<typeof savedIdsDecoder>>;

export type IdsList = Readonly<Decoder.TypeOf<typeof savedIdsListDecoder>>;

const idsUrl = (concept: string, offset: number) =>
  url(5000, offset)([`Concept: ${concept}`])(['Database ID', 'Password']);

const PEDIA_PATH = path.join(process.cwd(), 'data', 'yugipedia');
const IDS_FILENAME = path.join(PEDIA_PATH, 'ids.json');

const saveIdsFile = (res: IdsList) =>
  utils.taskify(() =>
    fs
      .mkdir(PEDIA_PATH, { recursive: true })
      .then(() => fs.writeFile(IDS_FILENAME, utils.stringify(res)))
  );

const fetchedIdsDecoder = Decoder.struct({
  ['Database ID']: Decoder.head(Decoder.number),
  Password: Decoder.head(Decoder.numString),
});

const decodePediaIds = flow(
  Decoder.parse(fetchedResultDecoder(fetchedIdsDecoder)),
  TE.fromEither,
  TE.map(
    RR.mapWithIndex((name, printouts) => ({
      name,
      konamiId: printouts['Database ID'],
      passcode: printouts.Password,
    }))
  ),
  TE.map(RR.values)
);

// This will stop working once there are over 10000 monster cards,
// will have to switch to splitting by name ranges
export const updatePedia = (): TE.TaskEither<string, IdsList> =>
  pipe(
    [
      idsUrl('CG monsters', 0),
      idsUrl('CG monsters', 5000),
      idsUrl('CG non-monster cards', 0),
      idsUrl('Rush Duel cards', 0),
    ],
    RA.mapWithIndex(fetchCards),
    RA.map(TE.flatMap(decodePediaIds)),
    TE.sequenceArray,
    TE.flatMapOption(RNEA.fromReadonlyArray, () => 'Received zero arrays'),
    TE.map(RNEA.unappend),
    TE.map(([master, rush]) => ({ master: RA.flatten(master), rush })),
    TE.tap(saveIdsFile),
    TE.mapError(utils.stringify)
  );

export const initPedia = () =>
  pipe(
    utils.taskify(() => fs.readFile(IDS_FILENAME, 'utf-8')),
    TE.flatMapIOEither((s) => utils.fallibleIO(() => JSON.parse(s))),
    TE.flatMapEither(Decoder.parse(savedIdsListDecoder)),
    TE.orElse(updatePedia)
  );

export const findMaster =
  (passcode: number, name: string) =>
  ({ pedia }: Ctx.Ctx): O.Option<Ids> =>
    pipe(
      pedia.master,
      RA.findFirst(
        (c) => O.isSome(c.passcode) && c.passcode.value === passcode
      ),
      O.orElse(() =>
        pipe(
          pedia.master,
          RA.findFirst((c) => c.name === name)
        )
      )
    );

export const findRush =
  (name: string) =>
  ({ pedia }: Ctx.Ctx): O.Option<Ids> =>
    pipe(
      pedia.rush,
      RA.findFirst((c) => c.name === name.replace(' (Rush)', ' (Rush Duel)'))
    );

export const find = (id: number, name: string) => (ctx: Ctx.Ctx) =>
  pipe(
    findMaster(id, name)(ctx),
    O.orElse(() => findRush(name)(ctx))
  );

export const findByKonamiId =
  (id: number) =>
  (key: 'rush' | 'master') =>
  ({ pedia }: Ctx.Ctx): O.Option<Ids> =>
    pipe(
      pedia[key],
      RA.findFirst((c) => O.isSome(c.konamiId) && c.konamiId.value === id)
    );

export const toBabelCard = (c: Ids) => (ctx: Ctx.Ctx) =>
  pipe(
    ctx.babel.array,
    RA.findFirst((bc) => O.isSome(c.passcode) && bc.id === c.passcode.value),
    O.orElse(() =>
      pipe(
        ctx.babel.array,
        RA.findFirst(
          (bc) => bc.name.replace(' (Rush Duel)', ' (Rush)') === c.name
        )
      )
    )
  );
