import { O, pipe, RA, RNEA, RR, TE } from '@that-hatter/scrapi-factory/fp';
import Database from 'better-sqlite3';
import { ioEither } from 'fp-ts';
import MiniSearch from 'minisearch';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { simpleGit } from 'simple-git';
import { Collection, Decoder } from '../lib/modules';
import { utils } from '../lib/utils';

export type Card = Readonly<
  Decoder.TypeOf<typeof dataDecoder> &
    Decoder.TypeOf<typeof textsDecoder> & { cdb: string }
>;

export type Babel = Collection.Collection<Card> & {
  readonly minisearch: MiniSearch<Card>;
};

// -----------------------------------------------------------------------------
// cdb decoders
// -----------------------------------------------------------------------------

const bigintDecoder = Decoder.fromRefinement(
  (v): v is bigint => typeof v === 'bigint',
  'bigint'
);

const intDecoder = pipe(bigintDecoder, Decoder.map(Number));

const dataDecoder = Decoder.struct({
  id: intDecoder,
  ot: bigintDecoder,
  alias: intDecoder,
  setcode: bigintDecoder,
  type: bigintDecoder,
  atk: bigintDecoder,
  def: bigintDecoder,
  level: bigintDecoder,
  race: bigintDecoder,
  attribute: bigintDecoder,
  category: bigintDecoder,
});

const nullableString = pipe(
  Decoder.nullable(Decoder.string),
  Decoder.map(O.fromNullable),
  Decoder.map(O.filter((s) => s.trim().length > 0))
);

const textsDecoder = Decoder.struct({
  id: intDecoder,
  name: Decoder.string,
  desc: Decoder.string,
  str1: nullableString,
  str2: nullableString,
  str3: nullableString,
  str4: nullableString,
  str5: nullableString,
  str6: nullableString,
  str7: nullableString,
  str8: nullableString,
  str9: nullableString,
  str10: nullableString,
  str11: nullableString,
  str12: nullableString,
  str13: nullableString,
  str14: nullableString,
  str15: nullableString,
  str16: nullableString,
});

// TODO: consider decoding individually, discarding erroneous entries
// (right now, it's set to fail the entire table if at least one entry fails)
const dataTableDecoder = pipe(
  Decoder.array(dataDecoder),
  Decoder.map(RA.toRecord(({ id }) => id.toString()))
);
const textsTableDecoder = pipe(
  Decoder.array(textsDecoder),
  Decoder.map(RA.toRecord(({ id }) => id.toString()))
);

const cdbDecoder = (cdb: string) =>
  pipe(
    Decoder.struct({
      data: dataTableDecoder,
      texts: textsTableDecoder,
    }),
    Decoder.map(({ data, texts }) =>
      pipe(
        data,
        RR.filterMapWithIndex((id, d) =>
          pipe(
            O.fromNullable(texts[id]),
            O.map((t): Card => ({ ...d, ...t, cdb }))
          )
        )
      )
    )
  );

// -----------------------------------------------------------------------------
// fetching and loading
// -----------------------------------------------------------------------------

const GITHUB_URL = 'https://github.com/ProjectIgnis/BabelCDB.git';
const DATA_PATH = path.join(process.cwd(), 'data');
const REPO_PATH = path.join(DATA_PATH, 'BabelCDB');

const loadCdb = (name: string) =>
  pipe(
    utils.fallibleIO(() =>
      new Database(path.join(REPO_PATH, name), {
        fileMustExist: true,
        readonly: true,
      }).defaultSafeIntegers()
    ),
    ioEither.flatMap((db) =>
      pipe(
        utils.fallibleIO(() => ({
          data: db.prepare(`SELECT * FROM datas`).all(),
          texts: db.prepare(`SELECT * FROM texts`).all(),
        })),
        ioEither.flatMapEither(Decoder.parse(cdbDecoder(name))),
        ioEither.tap(() => utils.fallibleIO(() => db.close()))
      )
    ),
    TE.fromIOEither
  );

const getAllCdbPaths = (dir: string) =>
  pipe(
    utils.taskify(() => fs.readdir(dir, { withFileTypes: true })),
    TE.map(
      RA.filterMap((file) => {
        if (file.name.endsWith('.cdb') && !file.isDirectory())
          return O.some(file.name);
        return O.none;
      })
    )
  );

const initMinisearch = (cards: ReadonlyArray<Card>): MiniSearch<Card> => {
  const minisearch = new MiniSearch<Card>({ fields: ['name'] });

  const added: { [name: string]: Card } = {};
  cards.forEach((c) => {
    const alreadyAdded = added[c.name];
    if (
      !alreadyAdded ||
      c.alias !== alreadyAdded.id ||
      c.ot !== alreadyAdded.ot ||
      c.desc !== alreadyAdded.desc
    ) {
      minisearch.add(c);
      added[c.name] = c;
    }
  });

  return minisearch;
};

const loadBabel = (): TE.TaskEither<string, Babel> =>
  pipe(
    getAllCdbPaths(REPO_PATH),
    TE.map(RA.map(loadCdb)),
    TE.flatMap(TE.sequenceArray),
    TE.flatMapOption(RNEA.fromReadonlyArray, () => 'No valid cdbs found.'),
    TE.map(RNEA.unprepend),
    TE.map(([head, tail]) =>
      pipe(
        tail,
        RA.reduce(head, (a, b) => ({ ...a, ...b }))
      )
    ),
    TE.map((record): Babel => {
      const array = RR.values(record).toSorted((a, b) => Number(a.id - b.id));
      const minisearch = initMinisearch(array);
      return { array, record, minisearch };
    })
  );

const git = simpleGit();

export const updateBabel = (): TE.TaskEither<string, Babel> =>
  pipe(
    utils.taskify(() => git.cwd(REPO_PATH).pull()),
    TE.orElseW(() => utils.taskify(() => git.cwd(DATA_PATH).clone(GITHUB_URL))),
    TE.flatMap(loadBabel),
    TE.mapError(utils.stringify)
  );

export const initBabel = () => pipe(loadBabel(), TE.orElse(updateBabel));
