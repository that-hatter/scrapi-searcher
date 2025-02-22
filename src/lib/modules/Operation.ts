import { flow, pipe, RA, RNEA, RTE, TE } from '@that-hatter/scrapi-factory/fp';
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

const normalizePayload = <T extends dd.EditMessage | dd.CreateMessageOptions>(
  payload: Payload<T>
): T =>
  typeof payload === 'string'
    ? <T>{ content: payload, allowedMentions: { repliedUser: false } }
    : <T>{ ...payload, allowedMentions: { repliedUser: false } };

export const getMessage =
  (channelId: dd.BigString) =>
  (messageId: dd.BigString): Op<dd.Message> =>
  ({ bot }) =>
    asOperation(() => bot.helpers.getMessage(channelId, messageId));

export const getMessages =
  (channelId: dd.BigString) =>
  (options: dd.GetMessagesOptions): Op<ReadonlyArray<dd.Message>> =>
  ({ bot }) =>
    asOperation(() => bot.helpers.getMessages(channelId, options));

export const getReplies =
  (channelId: dd.BigString) =>
  (messageId: dd.BigString): Op<ReadonlyArray<dd.Message>> =>
    pipe(
      getMessages(channelId)({ limit: 100 }),
      RTE.map(RA.filter((msg) => messageId === msg.messageReference?.messageId))
    );

export const sendMessage =
  (channelId: dd.BigString) =>
  (payload: Payload<dd.CreateMessageOptions>): Op<dd.Message> =>
  ({ bot }) =>
    asOperation(() =>
      bot.helpers.sendMessage(channelId, normalizePayload(payload))
    );

export const sendReply =
  (message: dd.Message) =>
  (payload: Payload<dd.CreateMessageOptions>): Op<dd.Message> =>
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
      bot.helpers.editMessage(channelId, messageId, normalizePayload(payload))
    );

export const deleteMessage =
  (channelId: dd.BigString) =>
  (messageId: dd.BigString): Op<void> =>
  ({ bot }) =>
    asOperation(() => bot.helpers.deleteMessage(channelId, messageId));

export const deleteMessages =
  (channelId: dd.BigString) =>
  (messageIds: RNEA.ReadonlyNonEmptyArray<dd.BigString>): Op<void> =>
  ({ bot }) =>
    asOperation(() =>
      messageIds.length === 1
        ? bot.helpers.deleteMessage(channelId, RNEA.head(messageIds))
        : bot.helpers.deleteMessages(channelId, [...messageIds])
    );

export const sendInteractionResponse =
  (interactionId: dd.BigString) =>
  (token: string) =>
  (payload: CanBeReadonly<dd.InteractionResponse>): Op<unknown> =>
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
    asOperation(() => bot.gateway.editBotStatus(status));

export const react =
  (reaction: string) =>
  (message: dd.Message) =>
  ({ bot, emojis }: Ctx) => {
    const emoji =
      (reaction.startsWith(':') && reaction.endsWith(':')) ||
      (reaction.startsWith('<') && reaction.endsWith('>'))
        ? reaction
        : emojis[reaction];
    return asOperation(() =>
      bot.helpers.addReaction(message.channelId, message.id, emoji ?? reaction)
    );
  };

export const deleteOwnReaction =
  (reaction: string) =>
  (message: dd.Message) =>
  ({ bot, emojis }: Ctx) => {
    const emoji =
      (reaction.startsWith(':') && reaction.endsWith(':')) ||
      (reaction.startsWith('<') && reaction.endsWith('>'))
        ? reaction
        : emojis[reaction];
    return asOperation(() =>
      bot.helpers.deleteOwnReaction(
        message.channelId,
        message.id,
        emoji ?? reaction
      )
    );
  };

export const sendLog =
  (payload: Payload<dd.CreateMessageOptions>): Op<dd.Message> =>
  (ctx) =>
    sendMessage(ctx.dev.logs)(payload)(ctx);

export const getAppEmojis = (bot: dd.Bot) =>
  pipe(
    utils.taskify(bot.helpers.getApplicationEmojis),
    TE.map(({ items }) => items)
  );
