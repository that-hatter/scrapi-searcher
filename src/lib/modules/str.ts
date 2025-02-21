import {
  flow,
  O,
  pipe,
  RA,
  RNEA,
  string,
} from '@that-hatter/scrapi-factory/fp';
import * as md from '@that-hatter/scrapi-factory/markdown';
import { dd } from '.';
import { URLS } from '../constants';

// -----------------------------------------------------------------------------
// discord plaintext markup
// -----------------------------------------------------------------------------

export const bold = string.surrounded('**');

export const italic = string.surrounded('*');

export const strikethrough = string.surrounded('~~');

export const underline = string.surrounded('__');

export const spoiler = string.surrounded('||');

export const inlineCode = string.surrounded('`');

export const codeBlock = (s: string, lang: string = ''): string =>
  string.surrounded('```')(lang + '\n' + s);

export const luaBlock = (s: string): string => codeBlock(s, 'lua');

export const blockquote = flow(
  string.split('\n'),
  RNEA.map(string.prepend('> ')),
  string.intercalate('\n')
);

export const subtext = flow(
  string.split('\n'),
  RNEA.map(string.prepend('-# ')),
  string.intercalate('\n')
);

export const link = (name: string, url: string, tooltip?: string): string =>
  `[${name}](<${url + (tooltip ? `> "${tooltip}"` : '>')})`;

export const unorderedList = (
  items: ReadonlyArray<string>,
  level: number = 0
): string =>
  pipe(
    items,
    RA.map(string.trim),
    RA.map(string.prepend(' '.repeat(level) + '- ')),
    string.intercalate('\n')
  );

export const orderedList = (
  items: ReadonlyArray<string>,
  start: number = 1,
  level: number = 0
): string =>
  pipe(
    items,
    RA.mapWithIndex(
      (i, str) => ' '.repeat(level) + (start + i).toString() + '. ' + str.trim()
    ),
    string.intercalate('\n')
  );

export const emoji = string.surrounded(':');

export const mention = (id: dd.BigString): string => '<@' + id + '>';

export const channel = (id: dd.BigString): string => '<#' + id + '>';

const admonitionEmoji = {
  info: 'ⓘ',
  tip: '💡',
  warning: '⚠️',
  danger: '❌',
  details: '📝',
} as const;

export const admonition = (
  content: string,
  type: keyof typeof admonitionEmoji = 'info',
  title?: string
): string =>
  blockquote(
    admonitionEmoji[type] +
      bold(title ?? string.sentenceCase(type)) +
      '\n' +
      content
  );

// -----------------------------------------------------------------------------
// working with markdown ASTs
// -----------------------------------------------------------------------------

const expandLink = (link: md.Link): md.Link => ({
  ...link,
  url: link.url.startsWith('/api/') ? URLS.SCRAPI_BOOK + link.url : link.url,
});

const expandLinks = <T extends md.Child<md.Root>>(block: T): T => {
  if (!('children' in block)) return block;
  return {
    ...block,
    children: block.children.map((ch) =>
      ch.type === 'link' ? expandLink(ch) : ch
    ),
  };
};

const compileRoot = (root: md.Root) =>
  md
    .compile({ ...root, children: root.children.map(expandLinks) })
    .replaceAll('\\', '')
    .replace('\n', ' ');

export const fromAST = (
  ast: md.Root | md.Children<md.Root> | md.Child<md.Root>
): string => {
  if (ast instanceof Array) return compileRoot(md.root(ast));
  if (ast.type === 'root') return compileRoot(ast);
  return compileRoot(md.root([ast]));
};

const textParts = <T extends md.RootContent>(
  block: T
): ReadonlyArray<string> => {
  if (block.type === 'text' || block.type === 'html') return [block.value];
  if ('children' in block)
    return pipe([...block.children], RA.flatMap(textParts));
  return [];
};

// discord's code blocks are not commonmark-compliant,
// they treat triple backticks as the start/end of a code block
// even if they're not at the start of a line
const normalizeCodeBlocks = flow(
  string.split('\n'),
  RNEA.flatMap((s) => {
    const split = string.split('```')(s);
    if (split.length % 2 === 1) return [s];
    return pipe(split, RNEA.unappend, ([init, last]) => [
      init.join('```'),
      '```' + last,
    ]);
  }),
  string.intercalate('\n')
);

export const getTextParts = (s: string) => {
  const ast = md.parse(normalizeCodeBlocks(s));
  return pipe(ast.children, RA.flatMap(textParts), string.intercalate(''));
};

// -----------------------------------------------------------------------------
// convenience funtions optional strings
// -----------------------------------------------------------------------------

const isUnempty = (s: string) => s.length > 0;

const normalizeOptional = (s: string | O.Option<string>): O.Option<string> =>
  typeof s === 'string' ? O.some(s) : s;

export const join = (sep: string) =>
  flow(RA.filterMap(normalizeOptional), string.intercalate(sep));

export const joinWords = join(' ');

export const joinParagraphs = join('\n');

export const joinWithLimit = (sep: string, max: number) =>
  flow(
    RA.filterMap(normalizeOptional),
    RA.reduce([''], (aggr, curr) => {
      const s = aggr[aggr.length - 1]! + sep + curr;
      if (s.length > max) return [...aggr, curr];
      return [...aggr.slice(0, aggr.length - 1), s];
    })
  );

export const unempty = flow(string.trim, O.fromPredicate(isUnempty));

// -----------------------------------------------------------------------------
// additional helpers
// -----------------------------------------------------------------------------

export const crop =
  (left: number, right: number = left) =>
  (s: string) =>
    s.substring(left, s.length - right);

export const before = (sep: string) => (s: string) => s.split(sep).at(0) ?? s;

export const after = (sep: string) => (s: string) =>
  s.split(sep).slice(1).join(sep);

export const afterLast = (sep: string) => (s: string) => {
  const parts = s.split(sep);
  if (parts.length === 1) return '';
  return parts.at(parts.length - 1) ?? '';
};

export const limit = (indicator: string, max: number) => (s: string) =>
  s.length <= max ? s : s.substring(0, max - indicator.length) + indicator;

export const rightPaddedCode =
  (max: number) =>
  (s: string): string =>
    inlineCode(s + ' '.repeat(Math.max(max - s.length, 0)));

export const leftPaddedCode =
  (max: number) =>
  (s: string): string =>
    inlineCode(' '.repeat(Math.max(max - s.length, 0)) + s);
