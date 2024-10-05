import { pipe, RTE } from '@that-hatter/scrapi-factory/fp';
import { Card } from '../../../ygo';
import { Command, Op, str } from '../../modules';

export const id: Command.Command = {
  name: 'id',
  description: "Get a card's name and ID (passcode).",
  syntax: 'id <query>',
  aliases: ['passcode', 'password'],
  execute: (parameters, message) =>
    pipe(
      Card.bestMatch(parameters.join(' ')),
      RTE.map((c) => str.inlineCode(c.id.toString()) + ' ' + str.bold(c.name)),
      RTE.flatMap(Op.sendReply(message))
    ),
};
