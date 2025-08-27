import { pipe, RA } from '@that-hatter/scrapi-factory/fp';
import { Command, Menu, Op, Resource } from '../../modules';

const menu = pipe(
  Resource.array,
  RA.map((data) => ({
    value: data.key,
    label: data.key,
    description: data.description,
  })),
  (options) =>
    Menu.row({
      customId: 'update',
      placeholder: 'Select data to update',
      maxValues: Resource.array.length,
      options,
    })
);

export const update: Command.Command = {
  name: 'update',
  description: "Manually update the bot's data.",
  syntax: 'update',
  aliases: [],
  devOnly: true,
  execute: (_, message) =>
    Op.sendReply(message)({
      content:
        '⚠️ **NOTE:** ' +
        'The bot automatically updates its data. ' +
        'Only run this command if some update failed.',
      components: [menu],
    }),
};
