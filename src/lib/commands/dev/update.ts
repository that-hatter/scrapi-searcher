import { flow, O, pipe, R, RA } from '@that-hatter/scrapi-factory/fp';
import { Ctx } from '../../../Ctx';
import { Command, Github, Menu, Op } from '../../modules';

const repoLabel = (source: Github.Source) => source.owner + '/' + source.repo;

const createOptions = ({ sources }: Ctx) =>
  RA.compact([
    O.some({
      value: 'yard',
      label: repoLabel(sources.yard),
      description: 'The API documentation repo',
    }),
    O.some({
      value: 'base',
      label: repoLabel(sources.base),
      description: 'The base distributed EDOPro resource repo',
    }),
    ...pipe(
      sources.expansions,
      RA.mapWithIndex((i, repo) =>
        O.some({
          value: 'expansions ' + i,
          label: repoLabel(repo),
          description: 'Additional EDOPro resource repo',
        })
      )
    ),
    pipe(
      sources.banlists,
      O.map((repo) => ({
        value: 'banlists',
        label: repoLabel(repo),
        description: 'Repo for banlist files',
      }))
    ),
    pipe(
      sources.misc,
      O.map((repo) => ({
        value: 'misc',
        label: repoLabel(repo),
        description: 'Miscellaneous data used by the bot',
      }))
    ),
  ]);

const createMenu = flow(createOptions, (options) =>
  Menu.row({
    customId: 'update',
    placeholder: 'Select repository to update',
    maxValues: options.length,
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
    pipe(
      createMenu,
      R.flatMap((menu) =>
        Op.sendReply(message)({
          content:
            '⚠️ **NOTE:** ' +
            'The bot automatically updates its data. ' +
            "You normally shouldn't need to run this command.",
          components: [menu],
        })
      )
    ),
};
