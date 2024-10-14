import { O, pipe, RA, RR, TE } from '@that-hatter/scrapi-factory/fp';
import fetch from 'node-fetch';
import { Babel, Pedia } from '.';
import { Ctx } from '../Ctx';
import type { Data } from '../lib/modules';
import { Decoder, Github, str } from '../lib/modules';
import { DeepReadonly, utils } from '../lib/utils';

const decoder = Decoder.struct({
  master: Decoder.record(Decoder.number),
  rush: Decoder.record(Decoder.number),
});

export type KonamiIds = DeepReadonly<Decoder.TypeOf<typeof decoder>>;

const OWNER = 'that-hatter';
const REPO = 'scrapi-searcher';
const PATH = 'data/konamiIds.json';
const BRANCH = 'master';
const URL = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${PATH}`;

const update = pipe(
  utils.taskify(() => fetch(URL).then((response) => response.json())),
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
    TE.map((res) => res['Database ID'])
  );
};

const addToFile = (key: Key, passcode: number, kid: number) => (ctx: Ctx) =>
  pipe(
    ctx.konamiIds,
    RR.mapWithIndex((k, v) => {
      if (k === key) return { ...v, [passcode.toString()]: kid };
      return v;
    }),
    utils.stringify,
    (content) =>
      Github.updateFile(
        OWNER,
        'updates-test',
        'main',
        PATH,
        content,
        'add konami id for ' + passcode
      )(ctx)
  );

export const getOrFetchMissing =
  (
    card: Babel.Card,
    scopes: ReadonlyArray<string>,
    types: ReadonlyArray<string>
  ) =>
  (ctx: Ctx) => {
    const key = scopes.includes('Rush') ? 'rush' : 'master';

    const saved = ctx.konamiIds[key][card.id.toString()];
    if (saved)
      return pipe(
        saved,
        O.fromPredicate((n) => n > 0),
        TE.right
      );

    if (scopes.includes('Pre-release') || types.includes('Token'))
      return TE.right(O.none);
    if (key !== 'rush' && !scopes.includes('OCG') && !scopes.includes('TCG'))
      return TE.right(O.none);

    return pipe(
      fetchFromPedia(key, card.name),
      TE.tap((kid) => addToFile(key, card.id, kid)(ctx)),
      TE.map(O.some)
    );
  };
