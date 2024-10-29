import { flow, O, pipe, R, RA, RTE } from '@that-hatter/scrapi-factory/fp';
import { Ctx } from '../../../Ctx';
import { Babel, BitNames, Card } from '../../../ygo';
import { Command, Menu, Op, str } from '../../modules';

const plainVal = (name: string, n: number | bigint) =>
  str.joinWords([str.bold(name) + ':', str.inlineCode(n.toString())]);

const valWithHex = (name: string, n: bigint) =>
  str.joinWords([
    str.bold(name) + ':',
    str.inlineCode(n.toString()),
    str.parenthesized(str.inlineCode('0x' + n.toString(16))),
  ]);

const title = (c: Babel.Card) =>
  str.inlineCode(c.id.toString()) + ' ' + str.bold(c.name);

export const rawDataEmbed = (c: Babel.Card) => (ctx: Ctx) => {
  const color = Card.frameColor(c)(ctx);
  const ctypes = BitNames.types(c.type)(ctx);
  return {
    color,
    title: title(c),
    description: str.joinParagraphs([
      plainVal('id', c.id),
      valWithHex('ot', c.ot),
      plainVal('alias', c.alias),
      valWithHex('setcode', c.setcode),
      valWithHex('type', c.type),
      plainVal('atk', c.atk),
      ctypes.includes('Link')
        ? valWithHex('def', c.def)
        : plainVal('def', c.def),
      ctypes.includes('Pendulum')
        ? valWithHex('level', c.level)
        : plainVal('level', c.level),
      valWithHex('race', c.race),
      valWithHex('attribute', c.attribute),
      valWithHex('category', c.category),
    ]),
    footer: { text: c.cdb },
  };
};

export const rawDescEmbed = (c: Babel.Card) =>
  pipe(
    Card.frameColor(c),
    R.map((color) => ({
      color,
      title: title(c),
      description: str.codeBlock(c.desc),
      footer: { text: c.cdb },
    }))
  );

export const rawStringsEmbed = (c: Babel.Card) =>
  pipe(
    Card.frameColor(c),
    R.map((color) => ({
      color,
      title: title(c),
      description: pipe(
        c,
        Card.getCdbStrings,
        RA.map(
          ([_, i, s]) => str.bold('str' + (i + 1)) + ': ' + str.inlineCode(s)
        ),
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
  description: "Get a card's raw database values.",
  syntax: 'rawvals <query>',
  aliases: ['raws'],
  execute: (parameters, message) =>
    pipe(
      Card.bestMatch(parameters.join(' ')),
      RTE.flatMapReader(initMessage),
      RTE.flatMap(Op.sendReply(message))
    ),
};
