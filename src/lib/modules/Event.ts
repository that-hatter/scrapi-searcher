import { E, pipe, RTE } from '@that-hatter/scrapi-factory/fp';
import { Ctx, dd, Err, Op } from '.';

export type Event<K extends keyof dd.EventHandlers> = {
  readonly name: K;
  readonly handle: (
    ...parameters: Parameters<dd.EventHandlers[K]>
  ) => Op.Op<ReturnType<dd.EventHandlers[K]>>;
};

type List = ReadonlyArray<Event<keyof dd.EventHandlers>>;

export const asHandlers = (
  list: List,
  ctx: Ctx.Ctx
): Partial<dd.EventHandlers> =>
  list.reduce(
    (acc, event) => ({
      ...acc,
      ...toHandler(event, list, ctx),
    }),
    {}
  );

const toHandler = <K extends keyof dd.EventHandlers>(
  event: Event<K>,
  list: List,
  ctx: Ctx.Ctx
): Partial<dd.EventHandlers> => ({
  [event.name]: async (...params: Parameters<dd.EventHandlers[K]>) => {
    const ret = await pipe(
      event.handle(...params),
      RTE.tapError(Err.sendAlerts)
    )(ctx)();

    if (E.isRight(ret) && Ctx.isUpdate(ret.right)) {
      // update event handlers to use new Ctx
      const newCtx = Ctx.applyUpdate(ret.right)(ctx);
      ctx.bot.events = {
        ...ctx.bot.events,
        ...asHandlers(list, { ...ctx, ...newCtx }),
      };
    }
  },
});
