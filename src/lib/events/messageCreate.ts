import { O, pipe, TE } from '@that-hatter/scrapi-factory/fp';
import { about } from '../commands/general/about';
import { cardBracketSearch } from '../interactions/cardSelect';
import { Collection, Command, Err, Event, Op, str } from '../modules';
import { cacheMessage } from './shared';

export const messageCreate: Event.Event<'messageCreate'> = {
  name: 'messageCreate',
  handle: (_, message) => (ctx) => {
    if (message.authorId === ctx.bot.id) return cacheMessage(message);
    if (message.isFromBot) return Op.noop;

    if (!message.content.startsWith(ctx.prefix)) {
      if (
        message.mentionedUserIds.includes(ctx.bot.id) &&
        message.content.trim() === str.mention(ctx.bot.id)
      )
        return about.execute([], message)(ctx);

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
