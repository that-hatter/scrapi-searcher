import { O, pipe, RTE } from '@that-hatter/scrapi-factory/fp';
import { Ctx } from '../../../Ctx';
import { Command, dd, Op, str } from '../../modules';
import { helpMessage } from './help';

const description = (message: dd.Message, ctx: Ctx) =>
  str.joinParagraphs([
    pipe(
      ctx.gitRef,
      O.map(
        (sha) =>
          'Version: [`' +
          sha.substring(0, 7) +
          '`]' +
          '(<https://github.com/that-hatter/scrapi-searcher/commit/' +
          sha +
          '>)'
      ),
      O.map(str.subtext)
    ),
    '',
    str.mention(ctx.bot.id) +
      ' displays scripting library documentation and card information, ' +
      'and provides useful commands for EDOPro-related development.',
    '',
    'Part of the `scrapi` group of projects, which aims to improve ' +
      'the overall state of card scripting documentation. ' +
      '`scrapi` stands for **scr**ipting **API**, and each project is named ' +
      'after cards in the ["Scrap"](https://yugipedia.com/wiki/Scrap) archetype, ' +
      'except for `scrapi-book`, which instead plays on "scrapbook".',
    ctx.emojis.yard +
      ' [`scrapiyard`](https://github.com/ProjectIgnis/scrapiyard) - ' +
      "Documentation files for EDOPro's Card Scripting API.",
    ctx.emojis.factory +
      ' [`scrapi-factory`](https://github.com/that-hatter/scrapi-factory) - ' +
      'Validator and loader package for scrapiyard.',
    '📙 [`scrapi-book`](https://github.com/ProjectIgnis/scrapi-book) - ' +
      'EDOPro scripting guides and reference.',
    ctx.emojis.searcher +
      ' [`scrapi-searcher`](https://github.com/that-hatter/scrapi-searcher) - ' +
      'Utility bot for EDOPro scripting and development.',
    ctx.emojis.mind_reader +
      ' `scrapi-mind-reader` - Scripting auto-completion files *(coming soon™️)*.',
    '',
    helpMessage(message)(ctx),
    '-# For further questions, reach out to ' +
      str.mention(ctx.dev.admin) +
      '.',
  ]);

const aboutMessage =
  (message: dd.Message) =>
  (ctx: Ctx): dd.CreateMessageOptions => ({
    embeds: [
      {
        title: 'scrapi-searcher',
        url: 'https://github.com/that-hatter/scrapi-searcher',
        description: description(message, ctx),
      },
    ],
  });

export const about: Command.Command = {
  name: 'about',
  description: 'Get information about the bot.',
  syntax: 'about',
  aliases: [],
  execute: (_, message) =>
    pipe(
      aboutMessage(message),
      RTE.fromReader,
      RTE.flatMap(Op.sendReply(message))
    ),
};
