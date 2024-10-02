import { flow, RTE, TE } from '@that-hatter/scrapi-factory/fp';
import { dd, Err } from '.';
import { Ctx } from '../../Ctx';
import { CanBeReadonly, utils } from '../utils';

// ----------------------------------------------------------------------------
// type aliases
// ----------------------------------------------------------------------------

type CtxRTE<E, V> = RTE.ReaderTaskEither<Ctx, E, V>;

export type Op<V> = CtxRTE<Err.Err, V>;

export type SubOp<V> = CtxRTE<string, V>;

// casting should be safe in these operations,
// since discordeno shouldn't modify them
export type Payload<T> = string | CanBeReadonly<T>;

// ----------------------------------------------------------------------------
// noops
// ----------------------------------------------------------------------------

export const noop = TE.right(undefined);

export const noopReader = RTE.right(undefined);

// ----------------------------------------------------------------------------
// discord operation wrappers
// ----------------------------------------------------------------------------

const asOperation = flow(utils.taskify, TE.mapError(Err.forDev));

const normalizePayload = <T extends dd.EditMessage | dd.CreateMessage>(
  payload: Payload<T>
): T =>
  typeof payload === 'string'
    ? <T>{ content: payload, allowedMentions: { repliedUser: false } }
    : <T>{ ...payload, allowedMentions: { repliedUser: false } };

export const getMessage =
  (channelId: dd.BigString) =>
  (messageId: dd.BigString): Op<dd.Message> =>
  ({ bot }) =>
    asOperation(() => dd.getMessage(bot, channelId, messageId));

export const sendMessage =
  (channelId: dd.BigString) =>
  (payload: Payload<dd.CreateMessage>): Op<dd.Message> =>
  ({ bot }) =>
    asOperation(() =>
      dd.sendMessage(bot, channelId, normalizePayload(payload))
    );

export const sendReply =
  (message: dd.Message) =>
  (payload: Payload<dd.CreateMessage>): Op<dd.Message> =>
    sendMessage(message.channelId)({
      ...normalizePayload(payload),
      messageReference: {
        messageId: message.id,
        failIfNotExists: false,
      },
    });

export const editMessage =
  (channelId: dd.BigString) =>
  (messageId: dd.BigString) =>
  (payload: Payload<dd.EditMessage>): Op<dd.Message> =>
  ({ bot }) =>
    asOperation(() =>
      dd.editMessage(bot, channelId, messageId, normalizePayload(payload))
    );

export const deleteMessage =
  (channelId: dd.BigString) =>
  (messageId: dd.BigString, reason?: string): Op<void> =>
  ({ bot }) =>
    asOperation(() => bot.helpers.deleteMessage(channelId, messageId, reason));

export const deleteMessages =
  (channelId: dd.BigString) =>
  (messageIds: ReadonlyArray<dd.BigString>, reason?: string): Op<void> =>
  ({ bot }) =>
    asOperation(() =>
      bot.helpers.deleteMessages(channelId, [...messageIds], reason)
    );

export const sendInteractionResponse =
  (interactionId: dd.BigString) =>
  (token: string) =>
  (payload: CanBeReadonly<dd.InteractionResponse>): Op<void> =>
  ({ bot }) =>
    asOperation(() =>
      bot.helpers.sendInteractionResponse(
        interactionId,
        token,
        payload as dd.InteractionResponse
      )
    );

export const editBotStatus =
  (status: dd.StatusUpdate) =>
  ({ bot }: Ctx) =>
    asOperation(() => bot.helpers.editBotStatus(status));

export const react =
  (reaction: string) =>
  (message: dd.Message) =>
  ({ bot }: Ctx) =>
    asOperation(() =>
      bot.helpers.addReaction(message.channelId, message.id, reaction)
    );

export const sendLog =
  (payload: Payload<dd.CreateMessage>): Op<dd.Message> =>
  (ctx) =>
    sendMessage(ctx.dev.logs)(payload)(ctx);
