import { pipe, RTE } from '@that-hatter/scrapi-factory/fp';
import { Event, Op } from '../modules';

export const ready: Event.Event<'ready'> = {
  name: 'ready',
  handle: () => (ctx) =>
    pipe(
      Op.sendMessage(ctx.dev.logs)(
        ctx.emojis.searcher + ' Bot successfully connected.'
      ),
      RTE.flatMap(() =>
        Op.editBotStatus({
          status: 'online',
          activities: [
            {
              type: 3, // dd.ActivityTypes.Watching,
              name: 'for ' + ctx.prefix + 'help',
            },
          ],
        })
      )
    )(ctx),
};
