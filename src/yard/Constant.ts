import type * as sf from '@that-hatter/scrapi-factory';
import {
  O,
  R,
  RA,
  RNEA,
  RR,
  RTE,
  TE,
  pipe,
} from '@that-hatter/scrapi-factory/fp';
import { COLORS } from '../lib/constants';
import { Nav, Op, SearchCommand, dd, str } from '../lib/modules';
import { BindingInfo, DescInfo, Topic } from './shared';

const hexString = (b: bigint): string => '0x' + b.toString(16);

const valueParagraphs = (
  { value }: sf.Constant,
  { bitmaskInt }: sf.Enum
): string => {
  if (bitmaskInt && typeof value === 'bigint')
    return str.joinParagraphs([
      str.bold('HEX: ') + str.inlineCode(hexString(value)),
      str.bold('DEC: ') + str.inlineCode(value.toString()),
    ]);
  return str.inlineCode(value.toString());
};

const enumLink =
  (ct: sf.Constant) =>
  (api: sf.API): O.Option<string> =>
    pipe(
      api.enums.record,
      RR.lookup(ct.enum),
      O.map((en) => Topic.linkify(en.name + ' constants')(en))
    );

const githubSearchLink = (ct: sf.Constant) =>
  str.link(
    'Sample usage',
    'https://github.com/search?q=repo%3AProjectIgnis%2FCardScripts+' +
      encodeURIComponent(ct.name) +
      '&type=code'
  );

const quickLinksSection = (ct: sf.Constant) =>
  pipe(
    enumLink(ct),
    R.map((enLink) =>
      pipe(
        [
          BindingInfo.sourceLink(ct),
          githubSearchLink(ct),
          enLink,
          Topic.editLink(ct),
        ],
        str.join(' | '),
        str.unempty,
        O.map(str.subtext)
      )
    )
  );

const embed =
  (ct: sf.Constant): Op.SubOp<dd.Embed> =>
  (ctx) =>
    pipe(
      ctx.yard.api.enums.record,
      RR.lookup(ct.enum),
      TE.fromOption(() => 'Could not find enum: ' + ct.enum),
      TE.map((en) =>
        str.joinParagraphs([
          DescInfo.nonPlaceholder(str.fromAST(ct.description)),
          valueParagraphs(ct, en),
          quickLinksSection(ct)(ctx.yard.api),
        ])
      ),
      TE.map((description) => ({
        title: ct.name,
        url: Topic.url(ct),
        description,
        color: COLORS.BOOK_ORANGE,
        fields: pipe(
          [Topic.aliasesField(ct)(ctx.yard.api.constants.record)],
          RA.compact,
          RA.toArray
        ),
        footer: { text: 'constant' },
      }))
    );

export const itemEmbed = (ct: sf.Constant): Op.SubOp<dd.Embed> =>
  pipe(
    Topic.aliasEmbed(ct),
    RTE.orElse(() => embed(ct))
  );

export const itemListDescription: Nav.Nav<sf.Constant>['itemListDescription'] =
  (pageItems) => (item) => (ctx) => {
    const hexValFn = (ct: sf.Constant) =>
      ctx.yard.api.enums.record[ct.enum]?.bitmaskInt &&
      typeof ct.value === 'bigint'
        ? hexString(ct.value)
        : '';
    const hexVal = hexValFn(item);

    const maxLength = (fn: (ct: sf.Constant) => string): number =>
      pipe(
        pageItems,
        RNEA.reduce(0, (max, x) => {
          const s = fn(x);
          return s.length > max ? s.length : max;
        })
      );

    const paddedName = str.rightPaddedCode(maxLength(({ name }) => name));
    const paddedDec = str.leftPaddedCode(
      maxLength(({ value }) => value.toString())
    );
    const paddedHex = str.leftPaddedCode(maxLength(hexValFn));

    return pipe(
      [
        paddedName(item.name),
        paddedDec(item.value.toString()),
        hexVal.length > 0 ? paddedHex(hexVal) : O.none,
      ],
      str.joinWords,
      str.trim,
      TE.right
    );
  };

export const cmd = SearchCommand.searchCommand<sf.Constant>({
  name: 'constant',
  aliases: ['c', 'const'],
  itemCollection: (ctx) => TE.right(ctx.yard.api.constants),
  itemId: ({ name }) => name,

  itemListDescription,
  itemMenuDescription: Topic.defaultMenuDescription,
  itemEmbed,
});
