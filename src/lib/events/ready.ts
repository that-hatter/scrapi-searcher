import { pipe, RTE } from '@that-hatter/scrapi-factory/fp';
import { EMOJI } from '../constants';
import { dd, Event, Op } from '../modules';

export const ready: Event.Event<'ready'> = {
  name: 'ready',
  handle: () => (ctx) =>
    pipe(
      Op.sendMessage(ctx.dev.logs)(
        EMOJI.SEARCHER + ' Bot successfully connected.'
      ),
      RTE.flatMap(() =>
        Op.editBotStatus({
          status: 'online',
          activities: [
            {
              type: dd.ActivityTypes.Watching,
              name: 'for ' + ctx.prefix + 'help',
              createdAt: new Date().getTime(),
            },
          ],
        })
      )
    )(ctx),
};
