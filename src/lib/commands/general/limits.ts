import { O, pipe, R, RTE, TE } from '@that-hatter/scrapi-factory/fp';
import { Babel, Banlist, Card } from '../../../ygo';
import { Command, Ctx, Err, Op, str } from '../../modules';

const msgContent = (c: Babel.Card) => (ctx: Ctx.Ctx) =>
  pipe(
    Banlist.limitsBreakdown(c)(ctx),
    O.getOrElse(() => str.subtext('No applicable banlist.')),
    str.prepend(str.bold(c.name) + '\n')
  );

export const limits: Command.Command = {
  name: 'limits',
  description: "Show a card's limit status across every applicable banlist.",
  syntax: 'limits <query>',
  aliases: ['limit'],
  execute: (parameters, message) =>
    pipe(
      Card.bestMatch(parameters.join(' ')),
      R.map(TE.fromOption(Err.ignore)),
      RTE.flatMapReader(msgContent),
      RTE.flatMap(Op.sendReply(message))
    ),
};
