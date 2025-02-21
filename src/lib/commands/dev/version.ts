import { O, pipe } from '@that-hatter/scrapi-factory/fp';
import { Command, Op } from '../../modules';

export const version: Command.Command = {
  name: 'version',
  description: "Check the bot's deployed version.",
  syntax: 'version',
  aliases: ['v'],
  execute: (_, message) => (ctx) =>
    pipe(
      ctx.gitRef,
      O.map(
        (sha) =>
          'Version: [`' +
          sha.substring(0, 7) +
          '`]' +
          '(https://github.com/that-hatter/scrapi-searcher/commit/' +
          sha +
          ')'
      ),
      O.getOrElse(() => 'Version unknown'),
      Op.sendReply(message)
    )(ctx),
};
