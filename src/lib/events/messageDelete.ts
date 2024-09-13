import { RTE, pipe } from '@that-hatter/scrapi-factory/fp';
import { Event } from '../modules';
import { deleteReplies, uncacheMessage } from './shared';

export const messageDelete: Event.Event<'messageDelete'> = {
  name: 'messageDelete',
  handle: (_, { id, channelId }) => {
    return pipe(
      uncacheMessage(id),
      RTE.fromTaskEither,
      RTE.flatMap(() => deleteReplies(id, channelId))
    );
  },
};
