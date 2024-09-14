import { flow, O, pipe, RA, RNEA, TE } from '@that-hatter/scrapi-factory/fp';
import { Babel, Banlist, Pedia } from '.';
import { COLORS, LIMITS, URLS } from '../lib/constants';
import { Ctx, dd, Op, str } from '../lib/modules';
import { Card } from './Babel';
import * as BitNames from './BitNames';

const mainType = RA.findFirst(
  (ctype: string) =>
    ctype === 'Skill' ||
    ctype === 'Monster' ||
    ctype === 'Spell' ||
    ctype === 'Trap'
);

// -----------------------------------------------------------------------------
// cdb-to-text conversions not handled by BitNames
// -----------------------------------------------------------------------------

const ATK = (c: Card) => (c.atk === -2n ? '?' : c.atk.toString());

const DEF = (c: Card) => (c.def === -2n ? '?' : c.def.toString());

const level = (c: Card) => (ctypes: ReadonlyArray<string>) =>
  (ctypes.includes('Pendulum') ? c.level & 0xffffn : c.level).toString();

const rank = level;

const scales = (c: Card) => {
  const bits = c.level >> 16n;
  return (bits >> 8n) + '/' + (bits & 0xffn);
};

// -----------------------------------------------------------------------------
// card texts
// -----------------------------------------------------------------------------

const unofficialDisclaimer = (kid: O.Option<number>) => (text: string) => {
  if (O.isNone(kid)) return text;
  const diffMarker =
    "The above text is unofficial and describes the card's functionality in the OCG.";
  return text.replace(
    '\n* ' + diffMarker,
    str.subtext(str.link(diffMarker, URLS.YGORESOURCES_DIFFS + '#' + kid.value))
  );
};

const descLines = flow(
  str.split('\n'),
  RNEA.map(str.trim),
  RA.filter(
    (s) =>
      s.length > 0 && !s.split('').every((char) => char === '-' || char === '=')
  )
);

const isHeading = (s: string) => s.startsWith('[') && s.endsWith(']');

// splits desc fields into multiple parts if they exceed text field value limits
const safeDescFields = (
  field: dd.DiscordEmbedField
): Array<dd.DiscordEmbedField> => {
  if (field.value.length <= LIMITS.EMBED_FIELD) return [field];
  return field.value
    .split('\n')
    .reduce(
      (aggr, curr) => {
        const s = aggr[aggr.length - 1] + '\n' + curr;
        if (s.length > LIMITS.EMBED_FIELD) return [...aggr, curr];
        return [...aggr.slice(-1), s];
      },
      ['']
    )
    .map((v, i) => ({ name: i === 0 ? field.name : '\u200b', value: v }));
};

const descFields =
  (defaultName: string) =>
  (lines: ReadonlyArray<string>): Array<dd.DiscordEmbedField> => {
    if (!RA.isNonEmpty(lines)) return [];
    if (lines.length === 1) return [{ name: defaultName, value: lines[0] }];

    const [head, tail] = RNEA.unprepend(lines);
    const { init, rest } = RA.spanLeft((s: string) => !isHeading(s))(tail);

    const field = isHeading(head)
      ? {
          name: head.substring(1, head.length - 1).trim(),
          value: init.join('\n'),
        }
      : { name: defaultName, value: [head, ...init].join('\n') };

    return pipe(
      [field, ...descFields('')(rest)],
      RA.flatMap(safeDescFields),
      RA.toArray
    );
  };

const rushDescFields = (defaultName: string) => (c: Card) => {
  const lines = descLines(c.desc);
  const [fst] = lines;
  const maxHeading = 'MAXIMUM ATK = ';
  if (!fst || !fst.startsWith(maxHeading))
    return [O.none, descFields(defaultName)(lines)] as const;
  return [
    O.some(fst.substring(maxHeading.length).trim()),
    descFields(defaultName)(lines.slice(1)),
  ] as const;
};

// -----------------------------------------------------------------------------
// embeds
// -----------------------------------------------------------------------------

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

export const frameColor = (c: Card) => (ctx: Ctx.Ctx) =>
  pipe(BitNames.types(c.type)(ctx.bitNames), frameColor_);

const scriptFolder = (
  c: Card,
  mainType: O.Option<string>,
  scopes: ReadonlyArray<string>
) => {
  if (O.isSome(mainType) && mainType.value === 'Skill') return 'skill';
  if (scopes.includes('Rush')) return 'rush';
  if (c.name.endsWith(' (Pre-Errata)')) return 'pre-errata';
  if (c.name.endsWith(' (Goat)')) return 'goat';
  if (scopes.includes('Pre-release')) return 'pre-release';
  if (scopes.includes('OCG') || scopes.includes('TCG')) return 'official';
  return 'unofficial';
};

const scriptUrl_ = (
  c: Card,
  aliases: ReadonlyArray<Card>,
  mainType: O.Option<string>,
  ctypes: ReadonlyArray<string>,
  scopes: ReadonlyArray<string>
): O.Option<string> => {
  const main = aliases.find((a) => a.alias === 0 && c.ot === a.ot) ?? c;
  if (ctypes.includes('Normal') && !ctypes.includes('Pendulum')) return O.none;
  const folder = scriptFolder(main, mainType, scopes);
  return O.some(
    URLS.CARDSCRIPTS + 'blob/master/' + folder + '/c' + main.id + '.lua'
  );
};

export const scriptUrl = (c: Card) => (ctx: Ctx.Ctx) => {
  const aliases = ctx.babel.array.filter(
    (a) => a.id !== c.id && (c.alias === a.id || a.alias === c.id)
  );
  const ctypes = BitNames.types(c.type)(ctx.bitNames);
  return scriptUrl_(
    c,
    aliases,
    mainType(ctypes),
    ctypes,
    BitNames.scopes(c.ot)(ctx.bitNames)
  );
};

// TODO: exclude non-cards
const pediaURL = (c: Card, kid: O.Option<number>) => {
  if (O.isSome(kid)) return O.some(URLS.YUGIPEDIA_WIKI + kid.value);

  if (
    c.name.endsWith(' (Goat)') ||
    c.name.endsWith(' (Pre-Errata)') ||
    c.name.endsWith(' (DM)') ||
    c.name.endsWith(' (Deck Master)')
  )
    return O.none;

  const pname = c.name
    .replace(' (Rush)', ' (Rush Duel)')
    .replace(' (Skill)', ' (anime Skill)')
    // there's no way to link to specific VG card pages, since yugipedia
    // differentiates them according to the video game they're from,
    // we can only link to the main card at best
    .replace(' (VG)', '');

  return O.some(URLS.YUGIPEDIA_WIKI + encodeURIComponent(pname));
};

const urlsSection = (
  c: Card,
  aliases: ReadonlyArray<Card>,
  konamiId: O.Option<number>,
  mainType: O.Option<string>,
  ctypes: ReadonlyArray<string>,
  scopes: ReadonlyArray<string>
) => {
  const script = pipe(
    scriptUrl_(c, aliases, mainType, ctypes, scopes),
    O.map((s) => str.link('Script', s, 'EDOPro card script'))
  );

  const officialDb = O.map((kid: number) =>
    str.link(
      'Konami DB',
      (scopes.includes('Rush') ? URLS.KONAMI_DB_RUSH : URLS.KONAMI_DB_MASTER) +
        '/card_search.action?ope=2&request_locale=ja&cid=' +
        kid,
      'Official card data and rulings (JP)'
    )
  );

  const pedia = pipe(
    pediaURL(c, konamiId),
    O.map((url: string) => str.link('Yugipedia', url, 'Card wiki page'))
  );

  const ygoResources = flow(
    O.filter((_: number) => !scopes.includes('Rush')),
    O.map((kid) =>
      str.link(
        'YGOResources',
        URLS.YGORESOURCES_DB + 'card#' + kid,
        'Translated rulings and card data'
      )
    )
  );

  return pipe(
    [script, officialDb(konamiId), pedia, ygoResources(konamiId)],
    str.join(' | '),
    str.unempty,
    O.map(str.subtext)
  );
};

const limitsSection =
  (c: Card, scopes: ReadonlyArray<string>) => (ctx: Ctx.Ctx) => {
    if (scopes.includes('Pre-release') || scopes.includes('Legend'))
      return labeledList('Limit')(scopes);
    return pipe(
      scopes,
      RA.map((s) =>
        pipe(
          ctx.banlists,
          RA.findFirst((b) => b.name === s),
          O.flatMap(Banlist.getAllowed(c.id)),
          O.map((lmt) => s + ' ' + str.parenthesized(lmt.toString())),
          O.getOrElse(() => s)
        )
      ),
      labeledList('Limit')
    );
  };

const passcodesFooter = (c: Card, kid: O.Option<number>) =>
  flow(
    RA.prepend(c),
    RNEA.map((c) => c.id.toString()),
    RA.appendW(
      pipe(
        kid,
        O.map((k) => 'Konami ID #' + k)
      )
    ),
    str.join(' | '),
    (text) => ({ text })
  );

// TODO: refactor into individual functions per type/scope
export const itemEmbed =
  (c: Card): Op.SubOp<dd.Embed> =>
  (ctx) => {
    const bns = ctx.bitNames;

    const ctypes = BitNames.types(c.type)(bns);
    const mtype = mainType(ctypes);

    const scopes = BitNames.scopes(c.ot)(bns);
    const archs = pipe(
      BitNames.archetypes(c.setcode)(bns),
      RA.map(str.doubleQuoted)
    );

    // embed commons
    const title = c.name;
    const color = frameColor_(ctypes);

    const kid = pipe(
      scopes.includes('Rush')
        ? Pedia.findRush(c.name)(ctx)
        : Pedia.findMaster(c.id, c.name)(ctx),
      O.flatMap((pc) => pc.konamiId)
    );

    const aliases = ctx.babel.array.filter(
      (a) => a.id !== c.id && (a.alias === c.id || c.id === a.alias)
    );
    const footer = passcodesFooter(c, kid)(aliases);

    const commonDesc = str.joinParagraphs([
      urlsSection(c, aliases, kid, mtype, ctypes, scopes),
      limitsSection(c, scopes)(ctx),
      labeledList('Archetype')(archs),
      labeledList('Card Type')(ctypes),
    ]);

    if (O.isSome(mtype) && scopes.includes('Rush')) {
      const race = BitNames.race(c.race)(bns);
      const attributes = BitNames.attribute(c.attribute)(bns);
      const [maxATK, fields] = rushDescFields(
        ctypes.includes('Normal') ? 'Flavor Text' : 'Card Text'
      )(c);

      const description = ctypes.includes('Monster')
        ? str.joinParagraphs([
            commonDesc,
            str.joinWords([
              labeledList('Monster Type')(race),
              labeledList('Attribute')(attributes),
            ]),
            str.joinWords([
              labeled('Level')(level(c)(ctypes)),
              labeled('ATK')(ATK(c)),
              labeled('DEF')(DEF(c)),
              O.map(labeled('Maximum ATK'))(maxATK),
            ]),
          ])
        : commonDesc;

      return TE.right({ title, color, description, fields, footer });
    }

    if (O.isSome(mtype) && mtype.value === 'Skill') {
      const fields = pipe(c.desc, descLines, descFields('Skill Text'));

      const description = str.joinParagraphs([
        commonDesc,
        labeledList('Character')(BitNames.skillCharacters(c.race)(bns)),
      ]);

      return TE.right({ title, color, description, fields, footer });
    }

    if (O.isSome(mtype) && mtype.value === 'Monster') {
      const isLink = ctypes.includes('Link');
      const isPendulum = ctypes.includes('Pendulum');

      const arrows = isLink ? BitNames.linkArrows(c.def)(bns) : [];
      const race = BitNames.race(c.race)(bns);
      const attribute = BitNames.attribute(c.attribute)(bns);

      const fields = pipe(
        c.desc,
        unofficialDisclaimer(kid),
        descLines,
        descFields(ctypes.includes('Normal') ? 'Flavor Text' : 'Card Text')
      );

      const description = str.joinParagraphs([
        commonDesc,
        str.joinWords([
          labeledList('Monster Type')(race),
          labeledList('Attribute')(attribute),
        ]),
        str.joinWords([
          isLink
            ? labeled('Link Rating')(arrows.length.toString())
            : ctypes.includes('Xyz')
            ? labeled('Rank')(rank(c)(ctypes))
            : labeled('Level')(level(c)(ctypes)),
          labeled('ATK')(ATK(c)),
          isLink
            ? labeled('Link Arrows')(arrows.join(''))
            : labeled('DEF')(DEF(c)),
          isPendulum ? labeled('Pendulum Scale')(scales(c)) : '',
        ]),
      ]);

      return TE.right({ title, color, description, fields, footer });
    }

    // spells, traps, and others

    const isLink = ctypes.includes('Link');
    const arrows = isLink ? BitNames.linkArrows(c.def)(bns) : [];

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
      c.desc,
      unofficialDisclaimer(kid),
      descLines,
      descFields('Card Text')
    );

    return TE.right({ title, color, description, fields, footer });
  };

// -----------------------------------------------------------------------------
// card searching
// -----------------------------------------------------------------------------

export const fuzzyMatches = (query: string) => (ctx: Ctx.Ctx) => {
  const results = ctx.babel.minisearch.search(query, { fuzzy: true });
  return pipe(
    results,
    RA.filterMap(({ id }) => {
      const c = ctx.babel.record[id.toString()];
      if (!c) return O.none;
      return O.some(c);
    })
  );
};

export const bestMatch =
  (query: string) =>
  (ctx: Ctx.Ctx): O.Option<Babel.Card> => {
    if ((+query).toString() === query) {
      const idMatch = ctx.babel.record[query];
      if (idMatch) return O.some(idMatch);
    }

    if (query.startsWith('#')) {
      const kid = +query.substring(1);
      if ('#' + kid === query) {
        const match = pipe(
          Pedia.findByKonamiId(kid)('master')(ctx),
          O.orElse(() => Pedia.findByKonamiId(kid)('rush')(ctx)),
          O.flatMap((pc) => Pedia.toBabelCard(pc)(ctx))
        );
        if (O.isSome(match)) return match;
      }
    }

    return RA.head(fuzzyMatches(query)(ctx));
  };

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
