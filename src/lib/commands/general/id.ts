import { pipe, R, RTE, TE } from '@that-hatter/scrapi-factory/fp';
import { Card } from '../../../ygo';
import { Command, Err, Op, str } from '../../modules';

export const id: Command.Command = {
  name: 'id',
  description:
    "Show a card's name and id (passcode) without other information.",
  syntax: 'id <query>',
  aliases: ['passcode', 'password'],
  execute: (parameters, message) =>
    pipe(
      Card.bestMatch(parameters.join(' ')),
      R.map(TE.fromOption(Err.ignore)),
      RTE.map((c) => str.inlineCode(c.id.toString()) + ' ' + str.bold(c.name)),
      RTE.flatMap(Op.sendReply(message))
    ),
};
