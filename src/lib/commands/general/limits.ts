import { O, pipe, RTE } from '@that-hatter/scrapi-factory/fp';
import { Ctx } from '../../../Ctx';
import { Babel, Banlists, Card } from '../../../ygo';
import { Command, Op, str } from '../../modules';

const msgContent = (c: Babel.Card) => (ctx: Ctx) =>
  pipe(
    Banlists.limitsBreakdown(c)(ctx),
    O.getOrElse(() => str.subtext('No applicable banlist.')),
    str.prepend(str.bold(c.name) + '\n')
  );

export const limits: Command.Command = {
  name: 'limits',
  description: "Check a card's limit status across all applicable banlists.",
  syntax: 'limits <query>',
  aliases: ['limit'],
  execute: (parameters, message) =>
    pipe(
      Card.bestMatch(parameters.join(' ')),
      RTE.flatMapReader(msgContent),
      RTE.flatMap(Op.sendReply(message))
    ),
};
