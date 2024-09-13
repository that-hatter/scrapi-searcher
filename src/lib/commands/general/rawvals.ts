import { flow, O, pipe, R, RA, RTE, TE } from '@that-hatter/scrapi-factory/fp';
import { Babel, Card } from '../../../ygo';
import { Command, Err, Menu, Op, str } from '../../modules';

const plainField = (name: string, n: number) => ({
  name,
  value: str.inlineCode(n.toString()),
  inline: true,
});

const fieldWithHex = (name: string, n: bigint) => ({
  name,
  value:
    str.inlineCode(n.toString()) +
    ' ' +
    str.parenthesized(str.inlineCode('0x' + n.toString(16))),
  inline: true,
});

export const rawDataEmbed = (c: Babel.Card) =>
  pipe(
    Card.frameColor(c),
    R.map((color) => ({
      color,
      title: str.inlineCode(c.id.toString()) + ' ' + str.bold(c.name),
      fields: [
        plainField('id', c.id),
        fieldWithHex('ot', c.ot),
        plainField('alias', c.alias),
        fieldWithHex('setcode', c.setcode),
        fieldWithHex('type', c.type),
        fieldWithHex('atk', c.atk),
        fieldWithHex('def', c.def),
        fieldWithHex('level', c.level),
        fieldWithHex('race', c.race),
        fieldWithHex('attribute', c.attribute),
        fieldWithHex('category', c.category),
      ],
      footer: { text: c.cdb },
    }))
  );

export const rawDescEmbed = (c: Babel.Card) =>
  pipe(
    Card.frameColor(c),
    R.map((color) => ({
      color,
      title: str.inlineCode(c.id.toString()) + ' ' + str.bold(c.name),
      description: c.desc,
      footer: { text: c.cdb },
    }))
  );

export const rawStringsEmbed = (c: Babel.Card) =>
  pipe(
    Card.frameColor(c),
    R.map((color) => ({
      color,
      title: str.inlineCode(c.id.toString()) + ' ' + str.bold(c.name),
      description: pipe(
        c,
        Card.getCdbStrings,
        RA.map(([_, i, s]) => str.bold('str' + (i + 1)) + ': ' + s),
        str.joinParagraphs,
        str.unempty,
        O.getOrElseW(() => str.subtext('This card has no strings.'))
      ),
      footer: { text: c.cdb },
    }))
  );

export const rawvalModeMenu = (selected: string) =>
  Menu.row({
    customId: 'rawvalMode',
    placeholder: 'Select which values to view',
    options: [
      {
        label: 'data',
        value: 'data',
        description: 'All fields from the "datas" table.',
        default: selected === 'data',
      },
      {
        label: 'desc',
        value: 'desc',
        description: 'The desc field from the texts table.',
        default: selected === 'desc',
      },
      {
        label: 'strs',
        value: 'strs',
        description: 'The str1 to str16 fields from the texts table.',
        default: selected === 'strs',
      },
    ],
  });

const initMessage = flow(
  rawDataEmbed,
  R.map((embed) => ({
    embeds: [embed],
    components: [rawvalModeMenu('data')],
  }))
);

export const rawvals: Command.Command = {
  name: 'rawvals',
  description: "Display a card's raw values from the database.",
  syntax: 'rawvals <query>',
  aliases: ['raws'],
  execute: (parameters, message) =>
    pipe(
      Card.bestMatch(parameters.join(' ')),
      R.map(TE.fromOption(Err.ignore)),
      RTE.flatMapReader(initMessage),
      RTE.flatMap(Op.sendReply(message))
    ),
};
