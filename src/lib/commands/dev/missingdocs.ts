import { pipe, RA, RR } from '@that-hatter/scrapi-factory/fp';
import { Attachment, Command, Op, str } from '../../modules';

export const missingdocs: Command.Command = {
  name: 'missingdocs',
  description: 'Check which parts of the API are undocumented.',
  syntax: 'missingdocs',
  aliases: ['missing', 'missingdoc'],
  devOnly: true,
  execute: (_, message) => (ctx) => {
    const yard = ctx.yard;
    const api = yard.api;
    const entries = [
      ...api.constants.array,
      ...api.functions.array,
      ...api.namespaces.array,
    ];

    const nonMissing = pipe(
      entries,
      RA.filterMap((e) => e.source),
      RA.toRecord((src) => src)
    );

    const aliases = pipe(
      entries,
      RA.flatMap((e) => e.aliases),
      RA.toRecord((a) => a.name)
    );

    const missing = pipe(
      yard.sourceRecord,
      RR.filterWithIndex((name, src) => !nonMissing[src] && !aliases[name]),
      RR.toEntries
    );

    const longest = missing.toSorted(([a], [b]) => b.length - a.length)[0];
    const maxLength = longest ? longest[0].length : 0;
    return pipe(
      missing,
      RA.map(
        ([name, link]) => name + ' '.repeat(maxLength - name.length + 6) + link
      ),
      str.join('\n'),
      Attachment.text('undocumented.txt'),
      (file) =>
        Op.sendReply(message)({
          content: 'Found ' + missing.length + ' undocumented entries.',
          files: [file],
        })
    )(ctx);
  },
};
