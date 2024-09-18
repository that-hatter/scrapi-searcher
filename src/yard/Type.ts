import * as sf from '@that-hatter/scrapi-factory';
import { flow, O, pipe, RTE, TE } from '@that-hatter/scrapi-factory/fp';
import { COLORS } from '../lib/constants';
import { dd, Op, SearchCommand, str } from '../lib/modules';
import { DescInfo } from './shared';
import * as Topic from './shared/Topic';

// TODO: add supertype
const quickLinksSection = (tp: sf.Type): O.Option<string> =>
  pipe(Topic.editLink(tp), O.flatMap(str.unempty), O.map(str.subtext));

const typetype = (tp: sf.Type): string =>
  tp.supertype === sf.FUNCTION_TYPE_SYMBOL
    ? 'function type'
    : tp.supertype === sf.TABLE_TYPE_SYMBOL
    ? 'table type'
    : 'type';

const itemEmbed = (tp: sf.Type): Op.SubOp<dd.Embed> =>
  RTE.right({
    title: tp.name,
    url: Topic.url(tp),
    description: str.joinParagraphs([
      DescInfo.nonPlaceholder(str.fromAST(tp.description)),
      quickLinksSection(tp),
    ]),
    color: COLORS.BOOK_ORANGE,
    footer: { text: typetype(tp) },
  });

const itemListDescription = () => (tp: sf.Type) =>
  flow(
    Topic.defaultListDescription()(tp),
    TE.map((s) => {
      const typ = typetype(tp);
      if (typetype(tp) === 'type') return s;
      return str.italic(str.parenthesized(typ)) + ' ' + s;
    })
  );

export const cmd = SearchCommand.searchCommand<sf.Type>({
  name: 'type',
  aliases: ['t'],
  itemCollection: (ctx) => TE.right(ctx.yard.api.types),
  itemId: ({ name }) => name,

  itemListDescription,
  itemMenuDescription: Topic.defaultMenuDescription,
  itemEmbed,
});
