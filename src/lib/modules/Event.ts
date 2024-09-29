import { dd, Op } from '.';

export type Event<K extends keyof dd.EventHandlers> = {
  readonly name: K;
  readonly handle: (
    ...parameters: Parameters<dd.EventHandlers[K]>
  ) => Op.Op<ReturnType<dd.EventHandlers[K]>>;
};

export type List = ReadonlyArray<Event<keyof dd.EventHandlers>>;
