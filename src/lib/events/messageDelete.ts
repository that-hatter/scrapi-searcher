import { pipe, RA, RNEA, RTE } from '@that-hatter/scrapi-factory/fp';
import { Err, Event, Op } from '../modules';

export const messageDelete: Event.Event<'messageDelete'> = {
  name: 'messageDelete',
  handle:
    ({ id, channelId }) =>
    (ctx) =>
      pipe(
        Op.getReplies(channelId)(id),
        RTE.map(RA.filter((msg) => msg.author.id === ctx.bot.id)),
        RTE.flatMapOption(RNEA.fromReadonlyArray, Err.ignore),
        RTE.map(RNEA.map((msg) => msg.id)),
        RTE.flatMap(Op.deleteMessages(channelId))
      )(ctx),
};
