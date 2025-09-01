import type * as sf from '@that-hatter/scrapi-factory';
import { O, RA, RNEA, RR, RTE, TE, pipe } from '@that-hatter/scrapi-factory/fp';
import { Ctx } from '../Ctx';
import { COLORS } from '../lib/constants';
import { Github, Nav, Op, SearchCommand, dd, str } from '../lib/modules';
import { BindingInfo, DescInfo, Topic } from './shared';

const hexString = (b: bigint): string => '0x' + b.toString(16);

const valueParagraphs = (
  { value }: sf.Constant,
  { bitmaskInt }: sf.Enum
): string => {
  if (bitmaskInt && typeof value === 'bigint') {
    return str.joinParagraphs([
      str.bold('HEX:') + ' ' + str.inlineCode(hexString(value)),
      str.bold('DEC:') + ' ' + str.inlineCode(value.toString()),
    ]);
  }
  return str.bold('Value:') + ' ' + str.inlineCode(value.toString());
};

const enumLink = (ct: sf.Constant, ctx: Ctx): O.Option<string> =>
  pipe(
    ctx.yard.api.enums.record,
    RR.lookup(ct.enum),
    O.map((en) => Topic.linkify(en.name + ' Constants')(en))
  );

const usageExamplesLink = (ct: sf.Constant, ctx: Ctx) =>
  str.link(
    'Usage Examples',
    Github.searchURL(
      ctx.sources.scripts,
      encodeURIComponent('/(?-i)' + ct.name + '/')
    )
  );

const quickLinksSection = (ct: sf.Constant, ctx: Ctx) =>
  pipe(
    [
      BindingInfo.sourceLink(ct),
      usageExamplesLink(ct, ctx),
      enumLink(ct, ctx),
      Topic.editLink(ct),
    ],
    str.join(' | '),
    str.unempty,
    O.map(str.subtext)
  );

const embed =
  (ct: sf.Constant): Op.SubOp<dd.DiscordEmbed> =>
  (ctx) =>
    pipe(
      ctx.yard.api.enums.record,
      RR.lookup(ct.enum),
      TE.fromOption(() => 'Could not find enum: ' + ct.enum),
      TE.map((en) =>
        str.joinParagraphs([
          DescInfo.nonPlaceholder(str.fromAST(ct.description)),
          valueParagraphs(ct, en),
          quickLinksSection(ct, ctx),
        ])
      ),
      TE.map((description) => ({
        title: ct.name,
        url: Topic.url(ct),
        description,
        color: COLORS.DISCORD_TRANSPARENT,
        fields: pipe(
          [Topic.aliasesField(ct)(ctx.yard.api.constants.record)],
          RA.compact,
          RA.toArray
        ),
        footer: { text: 'constant' },
      }))
    );

export const itemEmbed = (ct: sf.Constant): Op.SubOp<dd.DiscordEmbed> =>
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
