import type * as sf from '@that-hatter/scrapi-factory';
import { O, pipe, RA, RTE, TE } from '@that-hatter/scrapi-factory/fp';
import { COLORS } from '../lib/constants';
import { dd, Op, SearchCommand, str } from '../lib/modules';
import { BindingInfo, DescInfo } from './shared';
import * as Topic from './shared/Topic';

const quickLinksSection = (nm: sf.Namespace) =>
  pipe(
    [BindingInfo.sourceLink(nm), Topic.editLink(nm)],
    str.join(' | '),
    str.unempty,
    O.map(str.subtext)
  );

const embed =
  (nm: sf.Namespace): Op.SubOp<dd.Embed> =>
  (ctx) =>
    TE.right({
      title: nm.name,
      url: Topic.url(nm),
      description: str.joinParagraphs([
        DescInfo.nonPlaceholder(str.fromAST(nm.description)),
        quickLinksSection(nm),
      ]),
      color: COLORS.BOOK_ORANGE,
      fields: pipe(
        [Topic.aliasesField(nm)(ctx.yard.api.namespaces.record)],
        RA.compact,
        RA.toArray
      ),
      footer: { text: 'namespace' },
    });

const itemEmbed = (nm: sf.Namespace) =>
  pipe(
    Topic.aliasEmbed(nm),
    RTE.orElse(() => embed(nm))
  );

export const cmd = SearchCommand.searchCommand<sf.Namespace>({
  name: 'namespace',
  aliases: ['n', 'ns'],
  itemCollection: (ctx) => TE.right(ctx.yard.api.namespaces),
  itemName: ({ name }) => name,

  itemListDescription: Topic.defaultListDescription,
  itemMenuDescription: Topic.defaultMenuDescription,
  itemEmbed,
});
