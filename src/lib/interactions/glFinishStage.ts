import { O, pipe, RA, RNEA, RR, RTE, TE } from '@that-hatter/scrapi-factory/fp';
import Database from 'better-sqlite3';
import * as buffer from 'node:buffer';
import { Ctx } from '../../Ctx';
import { BitNames, Pedia } from '../../ygo';
import { getState } from '../commands/dev/stage';
import { Button, Decoder, Err, Interaction, Op, str } from '../modules';
import { utils } from '../utils';

const stringWithLinks = pipe(
  Decoder.string,
  // remove masked pedia links in texts (ex: [[Illusion]] links to the Illusion page)
  Decoder.map((s) =>
    s.replaceAll(/\[\[(.+?)\]\]/g, (m, g1) => {
      if (typeof g1 !== 'string') return m;
      const [_, afterPipe] = g1.split('|');
      return afterPipe ?? g1;
    })
  ),
  // transform html line breaks to newlines
  Decoder.map((s) => s.replaceAll('<br />', '\n'))
);

const fulltext = pipe(
  Decoder.struct({ fulltext: Decoder.string }),
  Decoder.map(({ fulltext }) => fulltext)
);

const commonProps = {
  ['English name']: Decoder.headReq(Decoder.string),
  ['Password']: Decoder.head(Decoder.string),
  ['Medium']: Decoder.array(Decoder.string),
  // ['OCG Status']: Decoder.head(Decoder.string),
  // ['TCG Status']: Decoder.head(Decoder.string),
  ['Archseries']: Decoder.array(
    pipe(
      fulltext,
      Decoder.map((s) => s.replace(' (archetype)', ''))
    )
  ),
  ['Lore']: Decoder.headReq(stringWithLinks),
};

const atkDef = pipe(
  Decoder.string,
  Decoder.map((s) => (s === '?' ? -2n : utils.safeBigInt(s)))
);

const monsterProps = {
  ['Card type']: Decoder.headReq(
    pipe(fulltext, Decoder.compose(Decoder.literal('Monster Card')))
  ),
  ['Types string']: pipe(
    Decoder.headReq(Decoder.string),
    Decoder.map(str.split(' / '))
  ),
  ['ATK string']: Decoder.headReq(atkDef),
  ['DEF string']: Decoder.head(atkDef),
  ['Link Arrows']: Decoder.array(Decoder.string),
  ['Level']: Decoder.head(Decoder.number),
  ['Rank']: Decoder.head(Decoder.number),
  ['Pendulum Scale']: Decoder.head(Decoder.number),
  ['Attribute']: Decoder.headReq(fulltext),
  ['Pendulum Effect']: Decoder.head(stringWithLinks),
};

const spellProps = {
  ['Card type']: Decoder.headReq(
    pipe(fulltext, Decoder.compose(Decoder.literal('Spell Card')))
  ),
  ['Property']: Decoder.headReq(
    pipe(
      Decoder.string,
      Decoder.map((s) => s.replace(' Spell Card', ''))
    )
  ),
};

const trapProps = {
  ['Card type']: Decoder.headReq(
    pipe(fulltext, Decoder.compose(Decoder.literal('Trap Card')))
  ),
  ['Property']: Decoder.headReq(
    pipe(
      Decoder.string,
      Decoder.map((s) => s.replace(' Trap Card', ''))
    )
  ),
};

const decoder = pipe(
  Decoder.union(
    Decoder.struct(monsterProps),
    Decoder.struct(spellProps),
    Decoder.struct(trapProps)
  ),
  Decoder.intersect(Decoder.struct(commonProps)),
  Pedia.fetchedResultDecoder
);
type Record = Decoder.TypeOf<typeof decoder>;

// archetypes that have a different name on pedia than the name used in EDOPro
const archetypeOverrides: RR.ReadonlyRecord<string, string> = {
  ['Bonding']: 'Bonding -',
  ['Exodd']: 'Exodd|Obliterate!!!',
  ['Fusion']: 'Fusion|Polymerization',
  ['Polymerization']: 'Fusion|Polymerization',
  ['Ritual Beast Ulti']: 'Ritual Beast Ulti-',
  ['sphinx']: 'Sphinx',
  ['True Draco']: 'True Draco|True King',
};

const arrowNames: RR.ReadonlyRecord<string, string> = {
  'Top-Left': '↖',
  'Top': '⬆',
  'Top-Right': '↗',
  'Right': '➡',
  'Left': '⬅',
  'Bottom-Left': '↙',
  'Bottom': '⬇',
  'Bottom-Right': '↘',
};

type BabelData = {
  id: number;
  alias: number;
  ot: bigint;
  type: bigint;
  setcode: bigint;
  atk: bigint;
  def: bigint;
  level: bigint;
  race: bigint;
  attribute: bigint;
  category: bigint;
  name: string;
  desc: string;
};

const toBabelData =
  (id: number, c: Record[string]) =>
  (ctx: Ctx): BabelData => {
    // TODO: support non-prerelease later
    const ot = BitNames.toInt('scopes')([...c.Medium, 'Pre-release'])(ctx);

    const setcode = pipe(
      c.Archseries,
      RA.map((a) => archetypeOverrides[a] ?? a),
      (archs) => BitNames.archetypesInt(archs)(ctx)
    );

    const defaults = {
      id,
      ot,
      setcode,
      alias: 0,
      atk: 0n,
      def: 0n,
      level: 0n,
      race: 0n,
      attribute: 0n,
      category: 0n,
      desc: c.Lore,
      name: c['English name'],
    };

    if (c['Card type'] === 'Spell Card') {
      const typeStrs =
        c.Property === 'Normal' ? ['Spell'] : ['Spell', c.Property];
      const type = BitNames.toInt('types')(typeStrs)(ctx);
      return { ...defaults, type };
    }

    if (c['Card type'] === 'Trap Card') {
      const typeStrs =
        c.Property === 'Normal' ? ['Trap'] : ['Trap', c.Property];
      const type = BitNames.toInt('types')(typeStrs)(ctx);

      if (c.Archseries.includes('Trap Monster')) {
        const match = c.Lore.match(
          /as a(?:(?:n Effect)|(?: Normal)) Monster \((.*?)\)/
        );
        if (!match) return { ...defaults, type };
        const [_, statsStr] = match;
        if (!statsStr) return { ...defaults, type };
        let race = 0n;
        let attribute = 0n;
        let level = 0n;
        let atk = 0n;
        let def = 0n;
        statsStr.split('/').forEach((stat) => {
          if (stat.startsWith('ATK ')) {
            const atkStr = stat.substring(3).trim();
            atk = atkStr === '?' ? -2n : utils.safeBigInt(atkStr);
          } else if (stat.startsWith('DEF ')) {
            const defStr = stat.substring(3).trim();
            def = defStr === '?' ? -2n : utils.safeBigInt(defStr);
          } else if (stat.startsWith('Level ')) {
            const lvlStr = stat.substring(5).trim();
            level = lvlStr === '?' ? 0n : utils.safeBigInt(lvlStr);
          } else {
            attribute = BitNames.toInt('attributes')([stat])(ctx);
            if (attribute !== 0n) return;
            const raceStr = stat.toLowerCase().endsWith('-type')
              ? stat.substring(stat.length - 5)
              : stat;
            race = BitNames.toInt('races')([raceStr])(ctx);
          }
        });

        return { ...defaults, type, race, attribute, level, atk, def };
      }

      return { ...defaults, type };
    }

    const typeStrs = ['Monster', ...c['Types string'].slice(1)];
    const type = BitNames.toInt('types')(typeStrs)(ctx);
    const race = BitNames.toInt('races')([c['Types string'][0]])(ctx);
    const atk = c['ATK string'];
    const def = pipe(
      c['DEF string'],
      O.getOrElse(() =>
        pipe(
          c['Link Arrows'],
          RA.filterMap((n) => O.fromNullable(arrowNames[n])),
          (arrows) => BitNames.toInt('linkArrows')(arrows)(ctx)
        )
      )
    );
    const level = pipe(
      c.Level,
      O.orElse(() => c.Rank),
      O.map(utils.safeBigInt),
      O.getOrElse(() => 0n),
      (lvl) =>
        pipe(
          c['Pendulum Scale'],
          O.map(utils.safeBigInt),
          O.map((sc) => (lvl << 16n) | (sc << 8n) | sc),
          O.getOrElse(() => lvl)
        )
    );
    const attribute = BitNames.toInt('attributes')([c.Attribute])(ctx);
    const desc = O.isSome(c['Pendulum Effect'])
      ? str.joinParagraphs([
          '[ Pendulum Effect ]',
          c['Pendulum Effect'].value,
          '----------------------------------------',
          typeStrs.includes('Normal')
            ? '[ Flavor Text ]'
            : '[ Monster Effect ]',
          c.Lore,
        ])
      : c.Lore;
    return { ...defaults, type, race, atk, def, level, attribute, desc };
  };

const dataTableDDL = `CREATE TABLE datas (
  id        INTEGER,
  ot        INTEGER,
  alias     INTEGER,
  setcode   INTEGER,
  type      INTEGER,
  atk       INTEGER,
  def       INTEGER,
  level     INTEGER,
  race      INTEGER,
  attribute INTEGER,
  category  INTEGER,
  PRIMARY KEY (
    id
  )
);`;

const textsTableDDL = `CREATE TABLE texts (
  id     INTEGER,
  name   TEXT,
  [desc] TEXT,
  str1   TEXT,
  str2   TEXT,
  str3   TEXT,
  str4   TEXT,
  str5   TEXT,
  str6   TEXT,
  str7   TEXT,
  str8   TEXT,
  str9   TEXT,
  str10  TEXT,
  str11  TEXT,
  str12  TEXT,
  str13  TEXT,
  str14  TEXT,
  str15  TEXT,
  str16  TEXT,
  PRIMARY KEY (
    id
  )
);`;

const insertDatasQuery =
  'INSERT INTO datas (id, ot, alias, setcode, type, atk, def, level, race, attribute, category)' +
  ' VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
const insertTextsQuery =
  'INSERT INTO texts (id, name, desc, str1, str2, str3, str4, str5, str6, str7, str8, str9, str10, str11, str12, str13, str14, str15, str16)' +
  ' VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';

const withCdbFile = (name: string) => (entries: ReadonlyArray<BabelData>) =>
  pipe(
    utils.fallibleIO(() => {
      const db = new Database(':memory:');
      db.prepare(dataTableDDL).run();
      db.prepare(textsTableDDL).run();
      entries.forEach((c) => {
        db.prepare(insertDatasQuery).run(
          c.id,
          c.ot,
          c.alias,
          c.setcode,
          c.type,
          c.atk,
          c.def,
          c.level,
          c.race,
          c.attribute,
          c.category
        );
        db.prepare(insertTextsQuery).run(
          c.id,
          c.name,
          c.desc,
          ...RNEA.replicate('')(16)
        );
      });
      db.exec('VACUUM;');
      const buf = db.serialize();
      db.close();
      return new buffer.Blob([new Uint8Array(buf)]);
    }),
    RTE.fromIOEither,
    RTE.mapError(Err.forDev),
    RTE.map((blob) => ({
      content: '',
      components: [],
      files: [{ name, blob }],
    }))
  );

const parameters = pipe(
  [
    RR.keys(commonProps),
    RR.keys(monsterProps),
    RR.keys(spellProps),
    RR.keys(trapProps),
  ],
  RA.flatten,
  RA.uniq(str.Eq)
);

const fetchAndValidate = (idx: number, pages: ReadonlyArray<string>) =>
  pipe(
    Pedia.fetchCards(idx, Pedia.url(10, 0)(pages)(parameters)),
    TE.flatMapEither(Decoder.parse(decoder)),
    TE.mapError(Err.forDev),
    TE.map(RR.values)
  );

export const glFinishStage = Button.interaction({
  name: 'glFinishStage',
  devOnly: true,
  execute: (_, interaction) => {
    const message = interaction.message;
    return pipe(
      getState(message),
      RTE.tap(({ filename }) =>
        Interaction.sendUpdate(interaction)({
          content: 'Creating ' + str.inlineCode(filename) + ' ⏳',
          embeds: [
            {
              color: message.embeds?.at(0)?.color,
              description: message.embeds?.at(0)?.description,
            },
          ],
          components: [],
        })
      ),
      RTE.flatMap(({ staged, filename }) =>
        pipe(
          staged,
          RA.filterMap((c) =>
            pipe(
              c.link,
              // remove 'https://yugipedia.com/wiki/' from link
              O.map((link) => decodeURIComponent(link.substring(27))),
              O.orElse(() => c.enName)
            )
          ),
          RA.chunksOf(10),
          RA.mapWithIndex(fetchAndValidate),
          TE.sequenceArray,
          RTE.fromTaskEither,
          RTE.map(RA.flatten),
          RTE.map(
            RA.map((val) => {
              const name = val['English name'];
              const id = staged.find(
                (c) => O.isSome(c.enName) && c.enName.value === name
              )?.id;

              if (id) return RTE.fromReader(toBabelData(+id, val));
              return RTE.left(Err.forDev('Failed to match name: ' + name));
            })
          ),
          RTE.flatMap(RTE.sequenceArray),
          RTE.flatMap(withCdbFile(filename)),
          RTE.flatMap(Op.editMessage(message.channelId)(message.id))
        )
      )
    );
  },
});
