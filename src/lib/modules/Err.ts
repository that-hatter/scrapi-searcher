import { O, pipe, RA, RNEA, RTE } from '@that-hatter/scrapi-factory/fp';
import { Attachment, Ctx, dd, Op, str } from '.';
import { COLORS, LIMITS } from '../constants';
import { utils } from '../utils';

export type Err = {
  readonly reason: O.Option<Reason>;
  readonly devAlert: O.Option<string>;
  readonly userAlert: O.Option<string>;
};

export type Reason = dd.Message | dd.Interaction;

export const forAll = (dev: string, user = dev): Err => ({
  reason: O.none,
  devAlert: O.some(dev),
  userAlert: O.some(user),
});

export const forDev = (content: string): Err => ({
  reason: O.none,
  devAlert: O.some(content),
  userAlert: O.none,
});

export const forUser = (content: string): Err => ({
  reason: O.none,
  devAlert: O.none,
  userAlert: O.some(content),
});

export const ignore = (): Err => ({
  reason: O.none,
  devAlert: O.none,
  userAlert: O.none,
});

export const reason =
  (reason: dd.Message) =>
  (err: Err): Err => ({
    ...err,
    reason: O.some(reason),
  });

const log = (preMsg: string) => (err: Err) => {
  console.log('-'.repeat(80));
  console.log(preMsg);
  console.log(utils.stringify(err));
  console.log('-'.repeat(80));
  return err;
};

const reasonLink = (reason: Reason) => {
  const msg = 'token' in reason ? reason.message : reason;
  if (!msg) return O.none;
  if (!msg.guildId) return O.none;
  return O.some(
    `https://discord.com/channels/${msg.guildId}/${msg.channelId}/${msg.id}`
  );
};

const separateFooter = (s: string): [string, O.Option<string>] => {
  const splits = str.split('\n\n')(s);
  if (splits.length < 2) return [s, O.none];
  const [init, last] = RNEA.unappend(splits);
  if (last.length <= 3 || !last.startsWith('-# ')) return [s, O.none];
  return [init.join('\n\n'), O.some(last.substring(3))];
};

const formatDevAlert =
  (reason: O.Option<Reason>) =>
  (content: string): dd.CreateMessage => {
    const color = COLORS.DISCORD_ERROR_RED;
    const url = pipe(reason, O.flatMap(reasonLink), O.toUndefined);
    const title = 'Encountered an error';
    const [description_, footer_] = separateFooter(content);

    const description = str.limit(
      '\n' + str.subtext('...could not fit full message.'),
      LIMITS.EMBED_DESCRIPTION
    )(description_);

    const footer = pipe(
      footer_,
      O.map((text) => ({ text })),
      O.toUndefined
    );

    return {
      embeds: [{ color, url, title, description, footer }],
      file: pipe(
        reason,
        O.map(Attachment.create('reason.json')),
        O.toUndefined
      ),
    };
  };

export const sendAlerts = (error: Err): Op.Op<ReadonlyArray<dd.Message>> =>
  pipe(
    RTE.ask<Ctx.Ctx>(),
    RTE.flatMap(({ dev }) => {
      const sendToDev = pipe(
        error.devAlert,
        O.map(formatDevAlert(error.reason)),
        O.map(Op.sendMessage(dev.logs)),
        O.map(RTE.mapError(log('Failed to send error message to devs')))
      );

      const sendToUser = pipe(
        error.reason,
        O.flatMap((reason) => {
          const message = 'token' in reason ? reason.message : reason;
          if (!message) return O.none;
          return pipe(error.userAlert, O.map(Op.sendReply(message)));
        }),
        O.map(RTE.mapError(log('Failed to send error message to user')))
      );

      return pipe([sendToDev, sendToUser], RA.compact, RTE.sequenceArray);
    })
  );
