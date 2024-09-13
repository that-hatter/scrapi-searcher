import { flow, pipe, RTE, TE } from '@that-hatter/scrapi-factory/fp';
import { Command, Ctx, Nav, str } from '../../modules';

const list = (ctx: Ctx.Ctx) => TE.right(ctx.commands.array);

const itemListDescription =
  () =>
  ({ devOnly, syntax, description }: Command.Command) =>
  ({ prefix }: Ctx.Ctx) =>
    TE.right(
      (devOnly ? '🛡️ ' : '') +
        str.inlineCode(prefix + syntax) +
        ' - ' +
        description
    );

const itemMenuDescription = ({ aliases }: Command.Command) =>
  RTE.right(aliases.length > 0 ? 'aliases: ' + aliases.join(', ') : '');

export const commands: Command.Command = {
  name: 'commands',
  description: 'Show a list of commands.',
  syntax: 'commands',
  aliases: ['help', 'cmds'],
  execute: (_, message) =>
    pipe(
      list,
      RTE.map(
        (items): Nav.Nav<Command.Command> => ({
          title: 'List of commands',
          selectHint: 'Select command to display',
          items,
          messageId: message.id,
          channelId: message.channelId,
          itemName: ({ name }) => name,
          itemListDescription,
          itemMenuDescription,
          itemEmbed: flow(Command.embed, RTE.fromReader),
        })
      ),
      RTE.flatMap(Nav.sendInitialPage(message))
    ),
};
