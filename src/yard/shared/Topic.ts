import type * as sf from '@that-hatter/scrapi-factory';
import { O, pipe, RA, RNEA, RR, RTE } from '@that-hatter/scrapi-factory/fp';
import * as path from 'node:path';
import { BindingInfo, DescInfo } from '.';
import { URLS } from '../../lib/constants';
import { dd, Op, str } from '../../lib/modules';

// ----------------------------------------------------------------------------
// linkification
// ----------------------------------------------------------------------------

const aliasPath = (doc: AliasCopy): string => {
  if (doc.doctype === 'constant') return doc.enum + '/' + doc.partialName;
  if (doc.doctype === 'namespace') return doc.name;
  return (
    (O.isSome(doc.namespace) ? doc.namespace.value + '/' : '') + doc.partialName
  );
};

export const mainUrl = (doc: sf.Topic): string =>
  pipe(
    doc.filepath,
    // slice to remove the '.yml' extension
    O.map(
      (fp) =>
        URLS.SCRAPI_BOOK +
        '/' +
        path.join('api', fp.slice(0, -4)).replaceAll('\\', '/')
    ),
    O.getOrElse(() => '#')
  );

export const url = (doc: sf.Topic): string =>
  'source' in doc && isAliasCopy(doc)
    ? URLS.SCRAPI_BOOK + '/api/' + doc.doctype + 's/' + aliasPath(doc)
    : mainUrl(doc);

export const linkify =
  (linkName: string) =>
  (doc: sf.Topic): string =>
    str.link(linkName, url(doc));

export const linkedNameText = (doc: sf.Topic): string => linkify(doc.name)(doc);

export const linkedNameCode = (doc: sf.Topic): string =>
  linkify(str.inlineCode(doc.name))(doc);

export const editLink = (doc: sf.Topic): O.Option<string> =>
  pipe(
    doc.filepath,
    O.map((p) => p.replaceAll('(', '\\(').replaceAll(')', '\\)')),
    O.map(
      (p) => `https://github.com/ProjectIgnis/scrapiyard/edit/master/api/${p}`
    ),
    O.map((url) => str.link('Edit this doc', url))
  );

export const tagsSection =
  (doc: Exclude<sf.Topic, sf.Tag>) =>
  (api: sf.API): O.Option<string> =>
    pipe(
      doc.tags,
      RA.filterMap((tg) => RR.lookup(tg)(api.tags.record)),
      RA.map(linkedNameText),
      RNEA.fromReadonlyArray,
      O.map(str.intercalate(', '))
    );

export const defaultListDescription =
  () =>
  (doc: sf.Topic): Op.SubOp<string> =>
    pipe(
      doc.summary,
      O.map((sum) => linkedNameCode(doc) + ' - ' + str.fromAST(sum)),
      O.getOrElse(() => linkedNameCode(doc)),
      RTE.right
    );

export const defaultMenuDescription = (doc: sf.Topic): Op.SubOp<string> =>
  RTE.right(DescInfo.summaryOrDesc(doc));

// ----------------------------------------------------------------------------
// alias shenanigans
// ----------------------------------------------------------------------------

type Aliasable = sf.Constant | sf.Function | sf.Namespace;
type AliasCopy = {
  readonly aliasOf: O.Some<string>;
} & Aliasable;

export const isAliasCopy = <T extends Aliasable>(
  doc: T
): doc is T & AliasCopy => O.isSome(doc.aliasOf);

export const getAliasCopies = <T extends Aliasable>(all: ReadonlyArray<T>) => {
  const aliases = pipe(all, RA.filter(isAliasCopy));
  return ({ name }: T): ReadonlyArray<T & AliasCopy> =>
    pipe(
      aliases,
      RA.filter((a) => a.aliasOf.value === name)
    );
};

// TODO: indicate if alias is deprecated/deleted
export const aliasEmbed = <T extends Aliasable>(
  doc: T
): Op.SubOp<dd.DiscordEmbed> => {
  if (!isAliasCopy(doc)) return RTE.left('Not an alias copy');
  return RTE.right({
    title: doc.name,
    description:
      'This is an alias of ' +
      str.link(str.inlineCode(doc.aliasOf.value), mainUrl(doc)) +
      '.',
  });
};

const aliasNameString = (doc: sf.BindingInfo): string =>
  BindingInfo.strikeBasedOnStatus(doc)(doc.name);

export const aliasesField =
  <T extends Aliasable>({ aliases }: T) =>
  (rec: RR.ReadonlyRecord<string, Aliasable>): O.Option<dd.DiscordEmbedField> =>
    pipe(
      aliases,
      RA.filterMap((a) => RR.lookup(a.name)(rec)),
      RA.map(aliasNameString),
      RNEA.fromReadonlyArray,
      O.map(str.intercalate(', ')),
      O.map((value) => ({ name: 'Aliases', value }))
    );
