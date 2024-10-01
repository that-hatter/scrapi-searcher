import { pipe, R, RTE, TE } from '@that-hatter/scrapi-factory/fp';
import { Card } from '../../../ygo';
import { Command, Err, Op, str } from '../../modules';

export const script: Command.Command = {
  name: 'script',
  description: "Get a link to a card's script in the CardScript repo.",
  syntax: 'script <query>',
  aliases: [],
  execute: (parameters, message) =>
    pipe(
      Card.bestMatch(parameters.join(' ')),
      R.map(TE.fromOption(Err.ignore)),
      RTE.flatMap((c) =>
        pipe(
          Card.scriptUrl(c),
          R.map(TE.fromOption(Err.ignore)),
          RTE.map(str.clamped('<', '>')),
          RTE.map(str.prepend(str.bold(c.name) + '\n'))
        )
      ),
      RTE.flatMap(Op.sendReply(message))
    ),
};
