import { pipe, RTE } from '@that-hatter/scrapi-factory/fp';
import type { Event } from '../modules';
import { messageCreate } from './messageCreate';
import { messageDelete } from './messageDelete';

export const messageUpdate: Event.Event<'messageUpdate'> = {
  name: 'messageUpdate',
  handle: (bot, message) =>
    pipe(
      messageDelete.handle(bot, message),
      RTE.flatMap(() => messageCreate.handle(bot, message))
    ),
};
