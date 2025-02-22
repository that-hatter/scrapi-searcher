import {
  flow,
  O,
  pipe,
  R,
  RA,
  RNEA,
  RTE,
  TE,
} from '@that-hatter/scrapi-factory/fp';
import { sequenceT } from 'fp-ts/lib/Apply';
import { Babel, Banlists, BetaIds, KonamiIds, Pics, Shortcuts } from '.';
import { Ctx } from '../Ctx';
import { COLORS, LIMITS, URLS } from '../lib/constants';
import { dd, Err, Nav, Op, str } from '../lib/modules';
import { Card } from './Babel';
import * as BitNames from './BitNames';

type PreFormatted = {
  readonly card: Babel.Card;
  readonly scopes: ReadonlyArray<string>;
  readonly rush: boolean;
  readonly archetypes: ReadonlyArray<string>;
  readonly types: ReadonlyArray<string>;
  readonly mainType: string;
  readonly aliases: ReadonlyArray<Card>;
  readonly konamiId: O.Option<number>;
  readonly pic: O.Option<string>;
};

const mainType = flow(
  RA.findFirst(
    (t) => t === 'Skill' || t === 'Monster' || t === 'Spell' || t === 'Trap'
  ),
  O.getOrElse(() => 'Non-Card')
);

const preformatCommon = (card: Card) =>
  pipe(
    R.Do,
    R.let('card', () => card),
    R.let('rush', () => isRush(card)),
    R.bind('scopes', () => BitNames.scopes(card.ot)),
    R.bind('archetypes', () => BitNames.archetypes(card.setcode)),
    R.bind('types', () => BitNames.types(card.type)),
    R.let('mainType', ({ types }) => mainType(types)),
    R.bind('aliases', () => Babel.getAliases(card))
  );

const preformatWithExisting = (card: Card): Op.SubOp<PreFormatted> =>
  pipe(
    preformatCommon(card),
    R.bind('konamiId', ({ rush }) =>
      KonamiIds.getExisting(card, rush ? 'rush' : 'master')
    ),
    R.bind('pic', () => Pics.getExisting(card.id)),
    RTE.fromReader
  );

const preformatWithFetch = (card: Card): Op.SubOp<PreFormatted> =>
  pipe(
    preformatCommon(card),
    RTE.fromReader,
    RTE.bind('konamiId', ({ scopes, types }) =>
      KonamiIds.getOrFetchMissing(card, scopes, types)
    ),
    RTE.bind('pic', () => Pics.getOrFetchMissing(card))
  );

// -----------------------------------------------------------------------------
// card text parsing
// -----------------------------------------------------------------------------

const NEWLINE = /[\r\n]+/g;

// splits desc fields into multiple parts if they exceed text field value limits
const safeTextFields = (
  field: dd.DiscordEmbedField
): Array<dd.DiscordEmbedField> => {
  if (field.value.length <= LIMITS.EMBED_FIELD) return [field];
  return pipe(
    field.value,
    str.split(NEWLINE),
    RA.flatMap((line) => {
      if (line.length <= LIMITS.EMBED_FIELD) return [line];
      return pipe(
        line,
        str.split(/\s+/g),
        str.joinWithLimit(' ', LIMITS.EMBED_FIELD)
      );
    }),
    str.joinWithLimit('\n', LIMITS.EMBED_FIELD),
    RA.mapWithIndex((i, v) => ({
      name: i === 0 ? field.name : '\u200b',
      value: v,
    })),
    RA.toArray
  );
};

const textFields =
  (defaultName: string) =>
  (lines: ReadonlyArray<string>): Array<dd.DiscordEmbedField> => {
    if (!RA.isNonEmpty(lines)) return [];
    if (lines.length === 1)
      return [{ name: defaultName, value: RNEA.head(lines) }];

    const [head, tail] = RNEA.unprepend(lines);
    const { init, rest } = RA.spanLeft((s: string) => !isHeading(s))(tail);

    const field = isHeading(head)
      ? {
          name: head.substring(1, head.length - 1).trim(),
          value: init.join('\n'),
        }
      : { name: defaultName, value: [head, ...init].join('\n') };

    return pipe(
      [field, ...textFields('')(rest)],
      RA.flatMap(safeTextFields),
      RA.toArray
    );
  };

const parseTextLines = flow(
  str.split(NEWLINE),
  RNEA.map(str.trim),
  RA.filter(
    (s) =>
      s.length > 0 && !s.split('').every((char) => char === '-' || char === '=')
  )
);

const isHeading = (s: string) => s.startsWith('[') && s.endsWith(']');

const parseRushText = (desc: string, defaultName: string) => {
  const lines = parseTextLines(desc);
  const [fst] = lines;
  const maxHeading = 'MAXIMUM ATK = ';
  if (!fst || !fst.startsWith(maxHeading))
    return [O.none, textFields(defaultName)(lines)] as const;
  return [
    O.some(fst.substring(maxHeading.length).trim()),
    textFields(defaultName)(lines.slice(1)),
  ] as const;
};

const withUnofficialDisclaimer = (kid: O.Option<number>) => (text: string) => {
  if (O.isNone(kid)) return text;
  const diffMarker =
    "The above text is unofficial and describes the card's functionality in the OCG.";
  return text.replace(
    '\n* ' + diffMarker,
    str.subtext(str.link(diffMarker, URLS.YGORESOURCES_DIFFS + '#' + kid.value))
  );
};

// -----------------------------------------------------------------------------
// embeds
// -----------------------------------------------------------------------------

const emojify = (name: string) => (ctx: Ctx) =>
  O.fromNullable(ctx.emojis[name.replaceAll(/\W+/g, '_').toLowerCase()]);

const appendEmoji = (name: string) => (s: string) =>
  pipe(
    emojify(name),
    R.map((emoji) => str.joinWords([s, emoji]))
  );

const labeled = (label: string) => str.prepend(str.bold(label + ':') + ' ');

const labeledList = (label: string) =>
  flow(str.intercalate(' / '), str.unempty, O.map(labeled(label)));

const FRAME_COLORS = new Map([
  // ordered by priority
  ['Skill', 0x0f7bc7],
  ['Spell', 0x1d9e74],
  ['Trap', 0xbc5a84],
  ['Ritual', 0x6699ff],
  ['Fusion', 0xa086b7],
  ['Synchro', 0xffffff],
  ['Xyz', 0x000000],
  ['Link', 0x00008b],
  ['Token', 0xc0c0c0],
  ['Effect', 0xff8b53],
  ['Normal', 0xfde68a],
]);

const frameColor_ = (ctypes: ReadonlyArray<string>) => {
  for (const [type, color] of FRAME_COLORS) {
    if (ctypes.includes(type)) return color;
  }
  return COLORS.DISCORD_TRANSPARENT;
};

export const frameColor = (c: Card) =>
  pipe(BitNames.types(c.type), R.map(frameColor_));

const scriptFolder = (pf: PreFormatted) => {
  if (pf.rush) return 'rush';
  if (pf.mainType === 'Skill') return 'skill';
  if (pf.card.name.endsWith(' (Pre-Errata)')) return 'pre-errata';
  if (pf.card.name.endsWith(' (Goat)')) return 'goat';
  if (pf.scopes.includes('Pre-release')) return 'pre-release';
  if (pf.scopes.includes('OCG') || pf.scopes.includes('TCG')) return 'official';
  return 'unofficial';
};

const _scriptURL = (pf: PreFormatted): O.Option<string> => {
  if (
    (pf.types.includes('Normal') || pf.types.includes('Token')) &&
    !pf.types.includes('Pendulum')
  )
    return O.none;
  const folder = scriptFolder(pf);
  const main =
    pf.aliases.find((a) => a.alias === 0 && pf.card.ot === a.ot) ?? pf.card;
  return O.some(
    URLS.CARDSCRIPTS + 'blob/master/' + folder + '/c' + main.id + '.lua'
  );
};

const pediaURL = ({ card, konamiId }: PreFormatted) => {
  if (O.isSome(konamiId)) return O.some(URLS.YUGIPEDIA_WIKI + konamiId.value);

  if (
    isNonCard(card) ||
    card.name.endsWith(' (Goat)') ||
    card.name.endsWith(' (Pre-Errata)') ||
    card.name.endsWith(' (DM)') ||
    card.name.endsWith(' (Deck Master)')
  )
    return O.none;

  const pname = card.name
    .replace(' (Anime)', ' (anime)')
    .replace(' (Rush)', ' (Rush Duel)')
    .replace(' (Skill)', ' (anime Skill)')
    // there's no way to link to specific VG card pages, since yugipedia
    // differentiates them according to the video game they're from,
    // we can only link to the main card at best
    .replace(' (VG)', '');

  return O.some(URLS.YUGIPEDIA_WIKI + encodeURIComponent(pname));
};

const urlsSection = (pf: PreFormatted) => {
  const script = pipe(
    _scriptURL(pf),
    O.map((s) => str.link('Script', s, 'EDOPro card script'))
  );

  const officialDb = pipe(
    pf.konamiId,
    O.map((kid) =>
      str.link(
        'Konami DB',
        (pf.rush ? URLS.KONAMI_DB_RUSH : URLS.KONAMI_DB_MASTER) +
          '/card_search.action?ope=2&request_locale=ja&cid=' +
          kid,
        'Official card data and rulings (JP)'
      )
    )
  );

  const pedia = pipe(
    pediaURL(pf),
    O.map((url) => str.link('Yugipedia', url, 'Card wiki page'))
  );

  const ygoResources = pipe(
    pf.konamiId,
    O.filter((_) => !pf.rush),
    O.map((kid) =>
      str.link(
        'YGOResources',
        URLS.YGORESOURCES_DB + 'card#' + kid,
        'Translated rulings and card data'
      )
    )
  );

  return pipe(
    [script, officialDb, pedia, ygoResources],
    str.join(' | '),
    str.unempty,
    O.map(str.subtext)
  );
};

const limitsSection = (pf: PreFormatted) => (ctx: Ctx) => {
  if (pf.scopes.includes('Pre-release') || pf.scopes.includes('Legend'))
    return labeledList('Limit')(pf.scopes);
  return pipe(
    pf.scopes,
    RA.map((s) =>
      pipe(
        ctx.banlists,
        RA.findFirst((b) => b.name === s),
        O.flatMap(Banlists.getAllowed(pf.card.id)),
        O.map((lmt) => s + ' ' + str.parenthesized(lmt.toString())),
        O.getOrElse(() => s)
      )
    ),
    labeledList('Limit')
  );
};

const passcodesFooter = (pf: PreFormatted) =>
  pipe(
    pf.aliases,
    RA.prepend(pf.card),
    RNEA.map((c) => c.id.toString()),
    RA.appendW(
      pipe(
        pf.konamiId,
        O.map((k) => 'Konami ID #' + k)
      )
    ),
    str.join(' | '),
    (text): dd.DiscordEmbedFooter => ({ text })
  );

const ATKDEF = (n: bigint) => (n === -2n ? '?' : n.toString());

const embedStars = (pf: PreFormatted) => {
  const value = pf.types.includes('Pendulum')
    ? pf.card.level & 0xffffn
    : pf.card.level;
  const emojiName = pf.archetypes.includes('Dark Synchro')
    ? 'level_negative'
    : pf.types.includes('Xyz')
    ? 'rank'
    : 'level';
  return pipe(
    emojify(emojiName),
    R.map((e) => str.joinWords([value.toString(), e])),
    R.map(labeled(emojiName === 'rank' ? 'Rank' : 'Level'))
  );
};

const embedScales = (pf: PreFormatted) => (ctx: Ctx) => {
  if (!pf.types.includes('Pendulum')) return O.none;
  const bits = pf.card.level >> 16n;
  return pipe(
    [
      emojify('scale_left')(ctx),
      (bits >> 8n) + '/' + (bits & 0xffn),
      emojify('scale_right')(ctx),
    ],
    str.joinWords,
    labeled('Pendulum Scale'),
    O.some
  );
};

const embedAttributes = (pf: PreFormatted) =>
  pipe(
    BitNames.attribute(pf.card.attribute),
    R.map(RA.map((a) => appendEmoji('attribute_' + a)(a))),
    R.flatMap(R.sequenceArray),
    R.map(labeledList('Attribute'))
  );

const embedRaces = (pf: PreFormatted) =>
  pipe(
    BitNames.race(pf.card.race),
    R.map(RA.map((r) => appendEmoji('race_' + r)(r))),
    R.flatMap(R.sequenceArray),
    R.map(labeledList('Monster Type'))
  );

const embedCardTypes = (pf: PreFormatted) => {
  if (pf.mainType === 'Monster')
    return pipe(pf.types, labeledList('Card Type'), R.of);
  return pipe(
    pf.types,
    RA.map((t) => appendEmoji('type_' + t)(t)),
    R.sequenceArray,
    R.map(labeledList('Card Type'))
  );
};

const finalizeEmbed = (
  pf: PreFormatted,
  description: string,
  fields: dd.DiscordEmbedField[]
): dd.DiscordEmbed => ({
  title: pf.card.name,
  thumbnail: O.isSome(pf.pic) ? { url: pf.pic.value } : undefined,
  description,
  fields,
  color: frameColor_(pf.types),
  footer: passcodesFooter(pf),
});

const commonEmbedDescription = (pf: PreFormatted) =>
  pipe(
    R.Do,
    R.bind('limits', () => limitsSection(pf)),
    R.bind('types', () => embedCardTypes(pf)),
    R.map(({ limits, types }) =>
      str.joinParagraphs([
        urlsSection(pf),
        limits,
        pipe(pf.archetypes, RA.map(str.doubleQuoted), labeledList('Archetype')),
        types,
      ])
    )
  );

const rushMonsterEmbed = (pf: PreFormatted) =>
  pipe(
    R.Do,
    R.bind('stars', () => embedStars(pf)),
    R.bind('races', () => embedRaces(pf)),
    R.bind('attrs', () => embedAttributes(pf)),
    R.bind('commonDesc', () => commonEmbedDescription(pf)),
    R.map(({ stars, races, attrs, commonDesc }) => {
      const [maxATK, fields] = parseRushText(
        pf.card.desc,
        pf.types.includes('Normal') ? 'Flavor Text' : 'Card Text'
      );

      const description = str.joinParagraphs([
        commonDesc,
        str.joinWords([races, attrs]),
        str.joinWords([
          stars,
          labeled('ATK')(ATKDEF(pf.card.atk)),
          labeled('DEF')(ATKDEF(pf.card.def)),
          O.map(labeled('Maximum ATK'))(maxATK),
        ]),
      ]);

      return finalizeEmbed(pf, description, fields);
    })
  );

const rushNonMonsterEmbed = (pf: PreFormatted) =>
  pipe(
    commonEmbedDescription(pf),
    R.map((description) => {
      const [_, fields] = parseRushText(pf.card.desc, 'Card Text');
      return finalizeEmbed(pf, description, fields);
    })
  );

const rushEmbed = (pf: PreFormatted) =>
  pf.mainType === 'Monster' ? rushMonsterEmbed(pf) : rushNonMonsterEmbed(pf);

const skillEmbed = (pf: PreFormatted) =>
  pipe(
    R.Do,
    R.bind('commonDesc', () => commonEmbedDescription(pf)),
    R.bind('chars', () => BitNames.skillCharacters(pf.card.race)),
    R.map(({ commonDesc, chars }) =>
      finalizeEmbed(
        pf,
        str.joinParagraphs([commonDesc, labeledList('Characters')(chars)]),
        pipe(pf.card.desc, parseTextLines, textFields('Skill Text'))
      )
    )
  );

const masterMonsterEmbed = (pf: PreFormatted) =>
  pipe(
    R.Do,
    R.bind('stars', () => embedStars(pf)),
    R.bind('scales', () => embedScales(pf)),
    R.bind('races', () => embedRaces(pf)),
    R.bind('attrs', () => embedAttributes(pf)),
    R.let('isLink', () => pf.types.includes('Link')),
    R.bind('arrows', ({ isLink }) =>
      isLink ? BitNames.linkArrows(pf.card.def) : R.of([])
    ),
    R.bind('commonDesc', () => commonEmbedDescription(pf)),
    R.map(({ stars, scales, isLink, arrows, commonDesc, races, attrs }) => {
      const fields = pipe(
        pf.card.desc,
        withUnofficialDisclaimer(pf.konamiId),
        parseTextLines,
        textFields(pf.types.includes('Normal') ? 'Flavor Text' : 'Card Text')
      );

      const description = str.joinParagraphs([
        commonDesc,
        str.joinWords([races, attrs]),
        str.joinWords([
          isLink ? labeled('Link Rating')(arrows.length.toString()) : stars,
          labeled('ATK')(ATKDEF(pf.card.atk)),
          isLink
            ? labeled('Link Arrows')(arrows.join(''))
            : labeled('DEF')(ATKDEF(pf.card.def)),
          scales,
        ]),
      ]);

      return finalizeEmbed(pf, description, fields);
    })
  );

const masterNonMonsterEmbed = (pf: PreFormatted) =>
  pipe(
    R.Do,
    R.let('isLink', () => pf.types.includes('Link')),
    R.bind('arrows', ({ isLink }) =>
      isLink ? BitNames.linkArrows(pf.card.def) : R.of([])
    ),
    R.bind('commonDesc', () => commonEmbedDescription(pf)),
    R.map(({ isLink, arrows, commonDesc }) => {
      const description = isLink
        ? str.joinParagraphs([
            commonDesc,
            str.joinWords([
              labeled('Link Rating')(arrows.length.toString()),
              labeled('Link Arrows')(arrows.join('')),
            ]),
          ])
        : commonDesc;

      const fields = pipe(
        pf.card.desc,
        withUnofficialDisclaimer(pf.konamiId),
        parseTextLines,
        textFields('Card Text')
      );

      return finalizeEmbed(pf, description, fields);
    })
  );

const embed = (pf: PreFormatted) =>
  pf.rush
    ? rushEmbed(pf)
    : pf.mainType === 'Skill'
    ? skillEmbed(pf)
    : pf.mainType === 'Monster'
    ? masterMonsterEmbed(pf)
    : masterNonMonsterEmbed(pf);

export const itemEmbed: (c: Card) => Op.SubOp<dd.DiscordEmbed> = flow(
  preformatWithExisting,
  RTE.flatMapReader(embed)
);

export const itemEmbedWithFetch: (c: Card) => Op.SubOp<dd.DiscordEmbed> = flow(
  preformatWithFetch,
  RTE.flatMapReader(embed)
);

// -----------------------------------------------------------------------------
// card searching
// -----------------------------------------------------------------------------

export const fuzzyMatches = (query: string) => (ctx: Ctx) => {
  const fullQuery = Shortcuts.resolveShortcuts(query)(ctx);
  return ctx.babel.search(fullQuery);
};

const isNumeric = (s: string) => (+s).toString() === s;

const passcodeMatch =
  (query: string) =>
  (ctx: Ctx): O.Option<Babel.Card> =>
    pipe(
      query,
      O.fromPredicate(isNumeric),
      O.orElse(() =>
        pipe(
          query.startsWith('c') ? query.substring(1) : query,
          (q) => (q.endsWith('.lua') ? q.substring(0, q.length - 4) : q),
          str.trim,
          O.fromPredicate(isNumeric)
        )
      ),
      O.flatMap((id) =>
        pipe(
          Babel.getCard(id)(ctx),
          O.orElse(() => BetaIds.toBabelCard(id)(ctx))
        )
      )
    );

const konamiIdMatch =
  (query: string) =>
  (ctx: Ctx): O.Option<Babel.Card> =>
    pipe(
      query,
      O.fromPredicate(str.startsWith('#')),
      O.map((kid) => kid.substring(1).trim()),
      O.filter(isNumeric),
      O.flatMap((kid) =>
        pipe(
          KonamiIds.toBabelCard('master', +kid)(ctx),
          O.orElse(() => KonamiIds.toBabelCard('rush', +kid)(ctx))
        )
      )
    );

export const bestMatch =
  (input: string): Op.Op<Babel.Card> =>
  (ctx) => {
    const query = input.toLowerCase();
    return pipe(
      passcodeMatch(query)(ctx),
      O.orElse(() => konamiIdMatch(query)(ctx)),
      O.orElse(() => RA.head(fuzzyMatches(query)(ctx))),
      TE.fromOption(() =>
        Err.forUser(
          'No matches found for ' + str.inlineCode(str.limit('...', 50)(input))
        )
      )
    );
  };

// -----------------------------------------------------------------------------
// helpers for card-related commands
// -----------------------------------------------------------------------------

export const isNonCard = (c: Card) => c.type < 1n || c.ot >= 0x800n;

export const isRush = (c: Card) => (c.ot & 0x200n) === 0x200n;

export const scriptURL: (c: Card) => Op.Op<string> = flow(
  preformatWithExisting,
  RTE.mapError(Err.forDev),
  RTE.flatMapOption(_scriptURL, (pf) =>
    Err.forUser('There is no script for ' + str.bold(pf.card.name))
  )
);

export const getCdbStrings = (c: Card) =>
  pipe(
    [
      c.str1,
      c.str2,
      c.str3,
      c.str4,
      c.str5,
      c.str6,
      c.str7,
      c.str8,
      c.str9,
      c.str10,
      c.str11,
      c.str12,
      c.str13,
      c.str14,
      c.str15,
      c.str16,
    ],
    RA.filterMapWithIndex((i, os) =>
      pipe(
        os,
        O.map((s) => [c.id, i, s] as const)
      )
    )
  );

const itemListDescription = () =>
  flow(
    preformatWithExisting,
    RTE.flatMapReader((pf) => {
      if (pf.mainType !== 'Monster') {
        return pipe(
          pf.types,
          RA.map(str.prepend('type_')),
          RA.map(emojify),
          R.sequenceArray,
          R.map(str.join('')),
          R.map(str.prepend(pf.card.name + ' '))
        );
      }

      return pipe(
        sequenceT(R.Apply)(
          BitNames.attribute(pf.card.attribute),
          BitNames.race(pf.card.race)
        ),
        R.map(([attrs, races]) => [
          ...attrs.map(str.prepend('attribute_')),
          ...races.map(str.prepend('race_')),
        ]),
        R.map(RA.map(emojify)),
        R.flatMap(R.sequenceArray),
        R.map(str.join('')),
        R.map(str.prepend(pf.card.name + ' '))
      );
    })
  );

export const nav = (
  title: string,
  items: ReadonlyArray<Card>,
  msg: dd.Message
): Nav.Nav<Card> => ({
  title,
  items,
  messageId: msg.id,
  channelId: msg.channelId,
  selectHint: 'Select card to display',
  itemId: (c: Card) => c.id.toString(),
  itemName: (c: Card) => RTE.right(c.name),
  itemListDescription,
  itemMenuDescription: (c: Card) => RTE.right(c.id.toString()),
  itemEmbed,
});
