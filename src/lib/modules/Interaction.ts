import { flow, O, pipe } from '@that-hatter/scrapi-factory/fp';
import { type Collection, dd, Err, Op, str } from '.';
import { Ctx } from '../../Ctx';
import { CanBeReadonly } from '../utils';

export type Component = {
  readonly name: string;
  readonly type: dd.MessageComponentTypes;
  readonly devOnly?: boolean;
  readonly execute: (
    parameters: ReadonlyArray<string>,
    interaction: dd.Interaction
  ) => Op.Op<unknown>;
};

export type ComponentCollection = Collection.Collection<Component>;

export type UpdateData = NonNullable<dd.InteractionResponse['data']>;

export type WithMsg = Omit<dd.Interaction, 'message'> & {
  message: dd.Message;
};

export const asUpdateResponse = (
  data: CanBeReadonly<UpdateData>
): CanBeReadonly<dd.InteractionResponse> => ({
  type: 7, //dd.InteractionResponseTypes.UpdateMessage,
  data,
});

export const updateable = O.fromPredicate(
  (ixn: dd.Interaction): ixn is WithMsg => !!ixn.message
);

export const sendResponse = (ixn: dd.Interaction) =>
  Op.sendInteractionResponse(ixn.id)(ixn.token);

export const deferredUpdate = (ixn: dd.Interaction) =>
  sendResponse(ixn)({
    type: 6, // dd.InteractionResponseTypes.DeferredUpdateMessage,
  });

export const sendUpdate = (ixn: dd.Interaction) =>
  flow(asUpdateResponse, sendResponse(ixn));

export const devCheck =
  (ixn: dd.Interaction) =>
  ({ dev }: Ctx) => {
    if (dev.admin === ixn.user.id.toString()) return true;
    if (dev.guild.toString() === ixn.guildId?.toString()) return true;
    return !!dev.users[ixn.user.id.toString()];
  };

export const err =
  (comp: Component, ixn: dd.Interaction) =>
  (err: Err.Err): Err.Err => {
    const reason = pipe(
      err.reason,
      O.orElse(() => O.some(ixn))
    );

    const devAlert = pipe(
      err.devAlert,
      O.map(
        str.append(
          '\n\n-# Encountered while processing component interaction: '
        )
      ),
      O.map(str.append(comp.name))
    );

    const userAlert = pipe(
      err.userAlert,
      O.orElse(() => {
        if (O.isNone(err.devAlert)) return O.none;
        return O.some(
          'An error was encountered while processing an interaction. ' +
            'This incident has been reported.'
        );
      })
    );

    return { devAlert, userAlert, reason };
  };
