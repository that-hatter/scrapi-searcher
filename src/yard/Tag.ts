import type * as sf from '@that-hatter/scrapi-factory';
import { O, pipe, RTE, TE } from '@that-hatter/scrapi-factory/fp';
import { COLORS } from '../lib/constants';
import { dd, Op, SearchCommand, str } from '../lib/modules';
import { DescInfo } from './shared';
import * as Topic from './shared/Topic';

const quickLinksSection = (tag: sf.Tag): O.Option<string> =>
  pipe(Topic.editLink(tag), O.flatMap(str.unempty), O.map(str.subtext));

const itemEmbed = (tag: sf.Tag): Op.SubOp<dd.DiscordEmbed> =>
  RTE.right({
    title: tag.name,
    url: Topic.url(tag),
    description: str.joinParagraphs([
      DescInfo.nonPlaceholder(str.fromAST(tag.description)),
      quickLinksSection(tag),
    ]),
    color: COLORS.DISCORD_TRANSPARENT,
    footer: { text: 'tag' },
  });

export const cmd = SearchCommand.searchCommand<sf.Tag>({
  name: 'tag',
  aliases: [],
  itemCollection: (ctx) => TE.right(ctx.yard.api.tags),
  itemId: ({ name }) => name,

  itemListDescription: Topic.defaultListDescription,
  itemMenuDescription: Topic.defaultMenuDescription,
  itemEmbed,
});
