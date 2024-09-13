import { pipe, RTE } from '@that-hatter/scrapi-factory/fp';
import { Cache, dd, Op } from '../modules';

const TIME_TO_LIVE = 10 * 60 * 1000; // 10 minutes
const cache = Cache.create<dd.Message>(TIME_TO_LIVE);

export const cacheMessage = (msg: dd.Message) =>
  Cache.put(cache)(msg.id.toString())(msg);

export const getCachedMessage = Cache.get(cache);

export const uncacheMessage = (id: dd.BigString) =>
  Cache.uncache(cache)(id.toString());

export const deleteReplies = (
  messageId: dd.BigString,
  channelId: dd.BigString
): Op.Op<void> =>
  pipe(
    Cache.getMatches(cache)(
      (val) => val.messageReference?.messageId === messageId
    ),
    RTE.fromTaskEither,
    RTE.flatMap((msgs) => {
      if (msgs.length === 0) return Op.noopReader;
      if (msgs.length === 1) return Op.deleteMessage(channelId)(msgs[0]!.id);
      return Op.deleteMessages(channelId)(msgs.map(({ id }) => id));
    })
  );
