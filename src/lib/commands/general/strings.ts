import { O, pipe, R, RA, RTE, TE } from '@that-hatter/scrapi-factory/fp';
import { Babel, Card } from '../../../ygo';
import { Command, Err, Op, str } from '../../modules';

export const stringsEmbed = (c: Babel.Card) =>
  pipe(
    Card.frameColor(c),
    R.map((color) => ({
      color,
      title: str.inlineCode(c.id.toString()) + ' ' + str.bold(c.name),
      description: pipe(
        Card.getCdbStrings(c),
        RA.map(([_, i, s]) => str.inlineCode(i.toString()) + ' ' + s),
        str.joinParagraphs,
        str.unempty,
        O.getOrElse(() => str.subtext('This card has no strings.'))
      ),
      footer: { text: c.cdb },
    }))
  );

export const strings: Command.Command = {
  name: 'strings',
  description: "Get a card's database strings.",
  syntax: 'strings <query>',
  aliases: ['strs'],
  execute: (parameters, message) =>
    pipe(
      Card.bestMatch(parameters.join(' ')),
      R.map(TE.fromOption(Err.ignore)),
      RTE.flatMapReader(stringsEmbed),
      RTE.map((embed) => ({ embeds: [embed] })),
      RTE.flatMap(Op.sendReply(message))
    ),
};
