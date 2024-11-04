import { O, pipe, TE } from '@that-hatter/scrapi-factory/fp';
import { about } from '../commands/general/about';
import { cardBracketSearch } from '../interactions/cardSelect';
import { Collection, Command, Err, Event, Op, str } from '../modules';

export const messageCreate: Event.Event<'messageCreate'> = {
  name: 'messageCreate',
  handle: (message) => (ctx) => {
    if (message.author.bot) return Op.noop;

    if (!message.content.startsWith(ctx.prefix)) {
      if (
        message.mentionedUserIds.includes(ctx.bot.id) &&
        message.content.trim() === str.mention(ctx.bot.id)
      ) {
        return about.execute([], message)(ctx);
      }

      return pipe(
        cardBracketSearch(message)(ctx),
        TE.mapError(Err.reason(message))
      );
    }

    return pipe(
      message.content.substring(ctx.prefix.length),
      str.toLowerCase,
      str.split(' '),
      ([cmdName, ...parameters]) =>
        pipe(
          cmdName,
          Collection.findByKey(ctx.commands),
          O.filter((cmd) => !cmd.devOnly || Command.devCheck(message)(ctx)),
          O.map((cmd) =>
            pipe(
              cmd.execute(parameters, message)(ctx),
              TE.mapError(Command.err(cmd, message))
            )
          ),
          O.getOrElseW(() => Op.noop)
        )
    );
  },
};
