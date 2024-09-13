import { pipe, RTE } from '@that-hatter/scrapi-factory/fp';
import { Command, Ctx, dd, Op, str } from '../../modules';
import { helpMessage } from './help';

const description = (message: dd.Message, ctx: Ctx.Ctx) =>
  str.joinParagraphs([
    str.mention(ctx.bot.id) +
      ' displays scripting library documentation and card information, ' +
      'and provides useful commands for EDOPro-related development.',
    '',
    'Part of the `scrapi` group of projects, which aims to improve ' +
      'the overall state of card scripting documentation. ' +
      '`scrapi` stands for **scr**ipting **API**, and each project is named ' +
      'after cards in the ["Scrap"](https://yugipedia.com/wiki/Scrap) archetype, ' +
      'except for `scrapi-book`, which instead plays on "scrapbook".',
    '<:yard:1283971971310293032> ' +
      '[`scrapiyard`](https://github.com/ProjectIgnis/scrapiyard) - ' +
      "Documentation files for EDOPro's Card Scripting API.",
    '<:factory:1283971929769902131> ' +
      '[`scrapi-factory`](https://github.com/that-hatter/scrapi-factory) - ' +
      'Validator and loader package for scrapiyard.',
    '📙 [`scrapi-book`](https://github.com/ProjectIgnis/scrapi-book) - ' +
      'EDOPro scripting guides and reference.',
    '<:searcher:1283971880885162130> ' +
      '[`scrapi-searcher`](https://github.com/that-hatter/scrapi-searcher) - ' +
      'Utility bot for EDOPro scripting and development.',
    '<:mindreader:1283972011256975390> ' +
      '`scrapi-mind-reader` - Scripting auto-completion files *(coming soon™️)*.',
    '',
    helpMessage(message)(ctx),
    '-# For further questions, reach out to ' +
      str.mention(ctx.dev.admin) +
      '.',
  ]);

const aboutMessage =
  (message: dd.Message) =>
  (ctx: Ctx.Ctx): dd.CreateMessage => ({
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
  description: 'Show information about the bot. Equivalent to mentioning it.',
  syntax: 'about',
  aliases: [],
  execute: (_, message) =>
    pipe(
      aboutMessage(message),
      RTE.fromReader,
      RTE.flatMap(Op.sendReply(message))
    ),
};
