import { RTE, pipe } from '@that-hatter/scrapi-factory/fp';
import { Command, Op, dd, str } from '../../modules';

const appendLatency = (userMsg: dd.Message) => (reply: dd.Message) =>
  Op.editMessage(reply.channelId)(reply.id)(
    reply.content +
      ` (${
        reply.timestamp - (userMsg.editedTimestamp ?? userMsg.timestamp)
      } ms)`
  );

export const ping: Command.Command = {
  name: 'ping',
  description: "Check the bot's response time.",
  syntax: 'ping',
  aliases: [],
  execute: (_, message) =>
    pipe(
      str.emoji('ping_pong') + ' pong!',
      Op.sendReply(message),
      RTE.flatMap(appendLatency(message))
    ),
};
