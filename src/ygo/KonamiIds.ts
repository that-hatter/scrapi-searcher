import { O, pipe, RA, RR, RTE, TE } from '@that-hatter/scrapi-factory/fp';
import fetch from 'node-fetch';
import { Babel, Card, Pedia } from '.';
import { Ctx } from '../Ctx';
import type { Data } from '../lib/modules';
import { Decoder, Github, str } from '../lib/modules';
import { DeepReadonly, utils } from '../lib/utils';
import { isAltArt } from './Babel';

const decoder = Decoder.struct({
  master: Decoder.record(Decoder.number),
  rush: Decoder.record(Decoder.number),
});

export type KonamiIds = DeepReadonly<Decoder.TypeOf<typeof decoder>>;

const OWNER = 'that-hatter';
const REPO = 'scrapi-searcher-data';
const PATH = 'data/konamiIds.json';
const BRANCH = 'main';
const URL = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${PATH}`;

const update = pipe(
  utils.taskify(() => fetch(URL).then((response) => response.json())),
  TE.flatMapEither(Decoder.parse(decoder)),
  RTE.fromTaskEither
);

export const data: Data.Data<'konamiIds'> = {
  key: 'konamiIds',
  description: 'Konami ID mappings.',
  update,
  init: update,
  commitFilter: (repo, files) =>
    repo === 'scrapi-searcher-data' && files.includes('data/konamiIds.json'),
};

type Key = 'master' | 'rush';

export const getExisting = (card: Babel.Card, key: Key) => (ctx: Ctx) =>
  pipe(
    ctx.konamiIds[key][card.id.toString()],
    O.fromNullable,
    O.filter((n) => n > 0)
  );

export const toBabelCard = (key: Key, konamiId: number) => (ctx: Ctx) =>
  pipe(
    RR.toEntries(ctx.konamiIds[key]),
    RA.findFirst(([_, kid]) => konamiId === kid),
    O.flatMap(([id]) => Babel.getCard(id)(ctx))
  );

const fetchedIdDecoder = Pedia.fetchedResultDecoder(
  Decoder.struct({
    ['Database ID']: Decoder.headReq(Decoder.number),
  })
);

const fetchFromPedia = (key: Key, name: string) => {
  const pname =
    key === 'rush'
      ? name
          .replace(' (Rush)', ' (Rush Duel)')
          .replace(' (L)', ' [L]')
          .replace(' (R)', ' [R]')
      : name;

  const url = Pedia.url(1, 0)([pname])(['Database ID']);
  return pipe(
    Pedia.fetchCards(0, url),
    TE.flatMapEither(Decoder.parse(fetchedIdDecoder)),
    TE.map(RR.values),
    TE.flatMapOption(RA.head, () => 'Failed to fetch card from yugipedia'),
    TE.mapError(
      str.prepend('Could not fetch konami id of ' + str.bold(name) + '\n\n')
    ),
    TE.map((res) => O.some(res['Database ID']))
  );
};

export const addToFile = (card: Babel.Card, kid: number) => {
  return (ctx: Ctx) =>
    pipe(
      ctx.konamiIds,
      RR.mapWithIndex((k, v) =>
        (Card.isRush(card) ? k === 'rush' : k === 'master')
          ? { ...v, [card.id.toString()]: kid }
          : v
      ),
      TE.right,
      TE.tap((content) =>
        Github.updateFile(
          OWNER,
          REPO,
          BRANCH,
          PATH,
          utils.stringify(content),
          'add konami id for ' + card.id
        )(ctx)
      )
    );
};

export const getOrFetchMissing =
  (
    card: Babel.Card,
    scopes: ReadonlyArray<string>,
    types: ReadonlyArray<string>
  ) =>
  (ctx: Ctx) => {
    const key = scopes.includes('Rush') ? 'rush' : 'master';

    const saved = ctx.konamiIds[key][card.id.toString()];
    if (saved) {
      return pipe(
        saved,
        O.fromPredicate((n) => n > 0),
        TE.right
      );
    }

    if (scopes.includes('Pre-release') || types.includes('Token'))
      return TE.right(O.none);
    if (key !== 'rush' && !scopes.includes('OCG') && !scopes.includes('TCG'))
      return TE.right(O.none);

    if (card.alias > 0) {
      const main = ctx.babel.record[card.alias.toString()];
      if (main && isAltArt(main, card)) {
        return TE.right(getExisting(main, key)(ctx));
      }
    }

    return fetchFromPedia(key, card.name);
  };

export const current = (ctx: Ctx) => TE.right(ctx.konamiIds);
