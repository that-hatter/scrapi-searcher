import { O, pipe, RA, RR, TE } from '@that-hatter/scrapi-factory/fp';
import { Babel, Card, Pedia } from '.';
import { Ctx, CtxWithoutResources } from '../Ctx';
import type { Resource } from '../lib/modules';
import { Decoder, Fetch, Github, str } from '../lib/modules';
import { DeepReadonly, utils } from '../lib/utils';
import { isAltArt } from './Babel';

const decoder = Decoder.struct({
  master: Decoder.record(Decoder.number),
  rush: Decoder.record(Decoder.number),
});

export type KonamiIds = DeepReadonly<Decoder.TypeOf<typeof decoder>>;

const RESOURCE_PATH = 'data/konamiIds.json';

const update = ({ sources }: CtxWithoutResources) =>
  pipe(
    sources.misc,
    O.map(({ repo }) =>
      pipe(
        Github.rawURL(repo, RESOURCE_PATH),
        Fetch.json,
        TE.flatMapEither(Decoder.decode(decoder))
      )
    ),
    O.getOrElse(() => TE.right(<KonamiIds>{}))
  );

export const resource: Resource.Resource<'konamiIds'> = {
  key: 'konamiIds',
  description: 'Konami ID mappings.',
  update,
  init: update,
  commitFilter: (ctx) => (src, files) =>
    O.isSome(ctx.sources.misc) &&
    src === ctx.sources.misc.value.repo &&
    files.includes(RESOURCE_PATH),
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
    TE.flatMapEither(Decoder.decode(fetchedIdDecoder)),
    TE.map(RR.values),
    TE.flatMapOption(RA.head, () => 'Failed to fetch card from yugipedia'),
    TE.mapError(
      str.prepend('Could not fetch konami id of ' + str.bold(name) + '\n\n')
    ),
    TE.map((res) => O.some(res['Database ID']))
  );
};

const addId =
  (scope: 'rush' | 'master', id: number, kid: number) =>
  (current: KonamiIds): KonamiIds => ({
    ...current,
    [scope]: { ...current[scope], [id.toString()]: kid },
  });

export const addToFile = (card: Babel.Card, kid: number) => (ctx: Ctx) =>
  pipe(
    ctx.sources.misc,
    O.map(({ repo }) =>
      pipe(
        ctx.konamiIds,
        addId(Card.isRush(card) ? 'rush' : 'master', card.id, kid),
        TE.right,
        TE.tap((content) =>
          Github.updateFile(
            repo,
            RESOURCE_PATH,
            utils.stringify(content),
            'add konami id for ' + card.id
          )(ctx)
        )
      )
    ),
    O.getOrElseW(() => TE.right(ctx.konamiIds))
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
