import { pipe, RA } from '@that-hatter/scrapi-factory/fp';
import { Command, Data, Menu, Op } from '../../modules';

const menu = pipe(
  Data.array,
  RA.map((data) => ({
    value: data.key,
    label: data.key,
    description: data.description,
  })),
  (options) =>
    Menu.row({
      customId: 'update',
      placeholder: 'Select data to update',
      maxValues: 3,
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
