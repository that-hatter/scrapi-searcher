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
import { Op, SearchCommand, dd, str } from '../lib/modules';
import {
  BindingInfo,
  DescInfo,
  Parameter,
  Return,
  SignatureInfo,
  Topic,
} from './shared';

type ParamSplit = Readonly<[sf.Parameter, ReadonlyArray<sf.Parameter>]>;

const isColonCallable =
  (fn: sf.Function) =>
  ([{ type }]: ParamSplit): boolean =>
    type.length === 1 && O.elem(str.Eq)(type[0], fn.namespace);

const quickCopyField = (
  fn: sf.Function,
  v: sf.Variant<sf.Function>
): dd.DiscordEmbedField =>
  pipe(
    v.parameters,
    RNEA.fromReadonlyArray,
    O.map(RNEA.unprepend),
    O.filter(isColonCallable(fn)),
    O.match(
      // dot notation (or just using the name if there's no module)
      () => fn.name + Parameter.headArgsString(v.parameters),
      // colon call notation
      ([fst, rest]: ParamSplit): string =>
        fst.name + ':' + fn.partialName + Parameter.headArgsString(rest)
    ),
    str.luaBlock,
    (value) => ({ name: 'Quick Copy', value })
  );

const getNamespace = (fn: sf.Function) => (api: sf.API) =>
  pipe(
    api.namespaces.record,
    RR.lookup(O.isSome(fn.namespace) ? fn.namespace.value : '(Global)')
  );

const namespaceLink = (fn: sf.Function) =>
  pipe(
    getNamespace(fn),
    R.map(
      O.map((ns) =>
        str.link(
          ns.name === '(Global)'
            ? '(Global) Functions'
            : str.inlineCode(ns.name) + ' Functions',
          Topic.url(ns) + '#Functions'
        )
      )
    )
  );

const usageExamplesLink = (fn: sf.Function) =>
  str.link(
    'Usage Examples',
    'https://github.com/search?q=repo%3AProjectIgnis%2FCardScripts+' +
      encodeURIComponent(fn.partialName) +
      '&type=code'
  );

const quickLinksSection = (fn: sf.Function) =>
  pipe(
    namespaceLink(fn),
    R.map((ns) =>
      pipe(
        [
          BindingInfo.sourceLink(fn),
          usageExamplesLink(fn),
          ns,
          Topic.editLink(fn),
        ],
        str.join(' | '),
        str.unempty,
        O.map(str.subtext)
      )
    )
  );

export const embed =
  (signature: number) =>
  (fn: sf.Function): Op.SubOp<dd.DiscordEmbed> =>
  (ctx) => {
    const variant = signature > 0 ? fn.overloads[signature - 1] ?? fn : fn;
    const synopsis = SignatureInfo.synopsis(variant, fn.name);
    const description = str.joinParagraphs([
      synopsis,
      '',
      DescInfo.nonPlaceholder(str.fromAST(variant.description)),
      quickLinksSection(fn)(ctx.yard.api),
    ]);

    return TE.right({
      title: fn.name,
      url: Topic.url(fn),
      description,
      color: COLORS.DISCORD_TRANSPARENT,
      fields: pipe(
        [
          Topic.aliasesField(fn)(ctx.yard.api.functions.record),
          Parameter.embedField(variant.parameters),
          Return.embedField(variant.returns),
          O.some(quickCopyField(fn, variant)),
        ],
        RA.compact,
        RA.toArray
      ),
      footer: {
        text:
          'function | ' +
          (variant === fn ? 'Main Signature' : 'Overload ' + signature),
      },
    });
  };

export const components =
  (signature: number) =>
  (fn: sf.Function): Op.SubOp<dd.MessageComponents> =>
    pipe(
      SignatureInfo.menuRow(signature, fn),
      O.map((r) => [r]),
      O.getOrElseW(() => []),
      RTE.right
    );

const itemEmbed = (fn: sf.Function) =>
  pipe(
    Topic.aliasEmbed(fn),
    RTE.orElse(() => embed(0)(fn))
  );

const itemComponents = components(0);

const itemListDescription = () => (fn: sf.Function) =>
  RTE.right(str.inlineCode(fn.name) + SignatureInfo.combinedComps(fn));

export const cmd = SearchCommand.searchCommand<sf.Function>({
  name: 'function',
  aliases: ['f', 'fn', 'func'],
  itemCollection: (ctx) => TE.right(ctx.yard.api.functions),
  itemId: ({ name }) => name,

  itemListDescription,
  itemMenuDescription: Topic.defaultMenuDescription,
  itemEmbed,
  itemComponents,
});
