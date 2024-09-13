import type * as sf from '@that-hatter/scrapi-factory';
import { O, pipe, RTE, TE } from '@that-hatter/scrapi-factory/fp';
import { COLORS } from '../lib/constants';
import { dd, Op, SearchCommand, str } from '../lib/modules';
import { DescInfo } from './shared';
import * as Topic from './shared/Topic';

const quickLinksSection = (en: sf.Enum): O.Option<string> =>
  pipe([Topic.editLink(en)], str.join(' | '), str.unempty, O.map(str.subtext));

const itemEmbed = (en: sf.Enum): Op.SubOp<dd.Embed> =>
  RTE.right({
    title: en.name,
    url: Topic.url(en),
    description: str.joinParagraphs([
      en.bitmaskInt ? str.italic('bit enum') : O.none,
      DescInfo.nonPlaceholder(str.fromAST(en.description)),
      quickLinksSection(en),
    ]),
    color: COLORS.BOOK_ORANGE,
    footer: { text: 'enum' },
  });

export const cmd = SearchCommand.searchCommand<sf.Enum>({
  name: 'enum',
  aliases: ['e'],
  itemCollection: (ctx) => TE.right(ctx.yard.api.enums),
  itemName: ({ name }) => name,

  itemListDescription: Topic.defaultListDescription,
  itemMenuDescription: Topic.defaultMenuDescription,
  itemEmbed,
});
