import { pipe, RTE } from '@that-hatter/scrapi-factory/fp';
import type { Event } from '../modules';
import { messageCreate } from './messageCreate';
import { messageDelete } from './messageDelete';

export const messageUpdate: Event.Event<'messageUpdate'> = {
  name: 'messageUpdate',
  handle: (message) =>
    pipe(
      messageDelete.handle(message),
      RTE.flatMap(() => messageCreate.handle(message))
    ),
};
