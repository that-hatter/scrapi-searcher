import { pipe, RTE } from '@that-hatter/scrapi-factory/fp';
import { Ctx } from '../../../Ctx';
import { Command, dd, Op, str } from '../../modules';

export const helpMessage = (message: dd.Message) => (ctx: Ctx) => {
  const sample =
    ctx.babel.array[message.timestamp % ctx.babel.array.length]?.name ??
    'Silhouhatte Rabbit';
  return str.joinParagraphs([
    'View a list of commands by typing ' +
      str.inlineCode(ctx.prefix + 'commands') +
      '.',
    'Search cards inside messages using curly braces, e.g. ' +
      str.inlineCode(str.braced(sample)) +
      '.',
  ]);
};

export const help: Command.Command = {
  name: 'help',
  description: 'Display a basic help message.',
  syntax: 'help',
  aliases: [],
  execute: (_, message) =>
    pipe(
      helpMessage(message),
      RTE.fromReader,
      RTE.flatMap(Op.sendReply(message))
    ),
};
