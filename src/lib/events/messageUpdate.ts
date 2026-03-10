import { O, pipe, RA, RNEA, RTE } from '@that-hatter/scrapi-factory/fp';
import { Op, type Event } from '../modules';
import { messageCreate } from './messageCreate';

export const messageUpdate: Event.Event<'messageUpdate'> = {
  name: 'messageUpdate',
  handle: (message) => (ctx) =>
    pipe(
      Op.getMessages(message.channelId)({ after: message.id, limit: 100 }),
      RTE.flatMap((messagesAfter) => {
        const botReplies = messagesAfter.filter(
          (ma) =>
            ma.author?.id === ctx.bot.id &&
            ma.messageReference?.messageId === message.id
        );

        const fromOtherUsers = messagesAfter.filter(
          (ma) => ma.author?.id !== message.author.id
        );

        const ops = RA.compact([
          // delete the bot's replies if any
          pipe(
            botReplies,
            RNEA.fromReadonlyArray,
            O.map(RNEA.map((msg) => msg.id)),
            O.map(Op.deleteMessages(message.channelId))
          ),
          // process new response only if there have
          // been no other messages from other users
          messagesAfter.length < 100 &&
          fromOtherUsers.length - botReplies.length === 0
            ? O.some(messageCreate.handle(message))
            : O.none,
        ]);

        return ops.length > 0 ? RTE.sequenceSeqArray(ops) : Op.noopReader;
      })
    )(ctx),
};
