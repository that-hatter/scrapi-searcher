import { O, pipe, RA, RNEA, RR, TE } from '@that-hatter/scrapi-factory/fp';
import Database from 'better-sqlite3';
import { ioEither } from 'fp-ts';
import MiniSearch, { SearchResult } from 'minisearch';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { Ctx } from '../Ctx';
import { PATHS } from '../lib/constants';
import type { Data } from '../lib/modules';
import { Collection, Decoder, Github, str } from '../lib/modules';
import { utils } from '../lib/utils';

export type Card = Readonly<
  Decoder.TypeOf<typeof dataDecoder> &
    Decoder.TypeOf<typeof textsDecoder> & { cdb: string }
>;

export type Babel = Collection.Collection<Card> & {
  readonly search: (query: string) => ReadonlyArray<Card>;
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

const REPO_PATH = path.join(PATHS.DATA, 'BabelCDB');

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

const WHITESPACE = /\s+/g;
const NEWLINE = /[\r\n]+/g;
const SPECIAL = /[^\p{L}\p{N}\p{M}\p{Z}]/gu;
// whitespace character with a special character before or after it
const WHITESPACE_AROUND_SPECIAL =
  /(?<=[^\p{L}\p{N}\p{M}\p{Z}])\s+|\s+(?=[^\p{L}\p{N}\p{M}\p{Z}])/gu;

const postSort =
  (query: string, record: RR.ReadonlyRecord<string, Card>) =>
  (results: Array<SearchResult>) => {
    const q = query.toLowerCase();

    const boost = (res: SearchResult) => {
      const name = res.name.toLowerCase();
      if (q === name) return 100;

      let boost = 1;

      const card = record[res.id.split(' ')[0]]!;
      if (card.ot & 0x3n) boost *= 1.1;
      if (card.alias === 0) boost *= 1.1;

      if (name.includes(q)) {
        boost *= 1.6 * (1 + (name.length - q.length) / name.length);
        if (name.startsWith(q)) {
          if (name.startsWith(q + ' ')) boost *= 1.4;
          boost *= 1.4;
        } else if (name.includes(q + ' ') || name.includes(' ' + q))
          boost *= 1.4;
      }

      return boost;
    };

    return pipe(
      results,
      RA.map((res) => ({
        ...res,
        score: res.score * boost(res),
      })),
      (final) => final.toSorted((a, b) => b.score - a.score)
    );
  };

const initSearch = (
  array: ReadonlyArray<Card>,
  record: RR.ReadonlyRecord<string, Card>
): Babel['search'] => {
  type Variant = {
    readonly id: string;
    readonly name: string;
  };

  const variants: ReadonlyArray<Variant> = pipe(
    array,
    RA.filter((c) => {
      if (c.alias === 0) return true;
      const main = record[c.alias.toString()];
      return !main || !isAltArt(main, c);
    }),
    RA.flatMap((c) =>
      pipe(
        c.name.match(SPECIAL) ?? [],
        RA.map((char) => c.name.replaceAll(char, ' ')),
        RA.prepend(c.name),
        RA.flatMap((s) => [s, s.replaceAll(SPECIAL, '')]),
        RA.append(c.name.replaceAll(WHITESPACE_AROUND_SPECIAL, '')),
        RA.map(str.trim),
        (variants) => [...new Set(variants)],
        RA.mapWithIndex((i, name) => ({ id: c.id + ' ' + i, name }))
      )
    )
  );

  const minisearch = new MiniSearch<Variant>({
    fields: ['name'],
    searchOptions: {
      fuzzy: true,
      prefix: true,
      maxFuzzy: 8,
      boostDocument: (id, term) => {
        // boost score of original exact matches
        const original = record[id.split(' ')[0]]!.name;
        if (original.toLowerCase().split(WHITESPACE).includes(term)) return 1.6;
        return 1;
      },
      processTerm: (term) => {
        const t = term.toLowerCase();
        // this is fine to do in processTerm because there are no cards
        // with both 'anime' and 'manga' in their name to skew the results
        return t.includes('anime')
          ? [t, t.replace('anime', 'manga')]
          : t.includes('manga')
          ? [t, t.replace('manga', 'anime')]
          : t;
      },
    },
    tokenize: (text) => text.split(WHITESPACE),
    storeFields: ['name'],
  });

  minisearch.addAll(variants);

  return (query) =>
    pipe(
      minisearch.search(query),
      postSort(query, record),
      RA.filterMap((s) => O.fromNullable(s.id.split(' ')[0])),
      (ids) => [...new Set(ids)],
      RA.filterMap((id) => O.fromNullable(record[id]))
    );
};

const loadBabel: TE.TaskEither<string, Babel> = pipe(
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
    const search = initSearch(array, record);
    return { array, record, search };
  })
);

const update: TE.TaskEither<string, Babel> = pipe(
  Github.pullOrClone('BabelCDB', 'https://github.com/ProjectIgnis/BabelCDB'),
  TE.flatMap(() => loadBabel),
  TE.mapError(utils.stringify)
);

export const data: Data.Data<'babel'> = {
  key: 'babel',
  description: 'Card databases from BabelCDB.',
  update,
  init: pipe(
    loadBabel,
    TE.orElse(() => update)
  ),
  commitFilter: (repo, files) =>
    repo === 'BabelCDB' && files.some((f) => f.endsWith('.cdb')),
};

export const getCard = (id: number | string) => (ctx: Ctx) =>
  O.fromNullable(ctx.babel.record[id.toString()]);

export const getAliases = (c: Card) => (ctx: Ctx) =>
  pipe(
    ctx.babel.array,
    RA.filter((a) => a.alias === c.id || c.alias === a.id)
  );

export const isAltArt = (c: Card, alt: Card) =>
  alt.alias === c.id &&
  alt.ot === c.ot &&
  alt.name === c.name &&
  alt.desc.replaceAll(NEWLINE, '\n') === c.desc.replaceAll(NEWLINE, '\n');
