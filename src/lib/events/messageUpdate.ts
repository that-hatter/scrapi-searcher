import { apply, pipe, RTE } from '@that-hatter/scrapi-factory/fp';
import { Ctx } from '../../Ctx';
import type { Event } from '../modules';
import { messageCreate } from './messageCreate';
import { cacheMessage, deleteReplies } from './shared';

export const messageUpdate: Event.Event<'messageUpdate'> = {
  name: 'messageUpdate',
  handle: (bot, message) => (ctx: Ctx) => {
    if (message.authorId === ctx.bot.id) return cacheMessage(message);
    return pipe(
      deleteReplies(message.id, message.channelId),
      RTE.flatMap(() => messageCreate.handle(bot, message)),
      apply(ctx)
    );
  },
};
