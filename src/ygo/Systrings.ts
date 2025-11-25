import {
  flow,
  O,
  pipe,
  RA,
  RNEA,
  RTE,
  TE,
} from '@that-hatter/scrapi-factory/fp';
import { Ctx, CtxWithoutResources } from '../Ctx';
import { FS, Github, Nav, str } from '../lib/modules';

const kinds = ['system', 'victory', 'counter', 'setname'] as const;

type Kind = (typeof kinds)[number];

export type Systring = {
  readonly kind: Kind;
  readonly name: string;
  readonly value: number;
  readonly source: string;
};

export type Systrings = ReadonlyArray<Systring>;

const parse = (url: string) =>
  flow(
    str.split('\n'),
    RA.filterMapWithIndex((i, s): O.Option<Systring> => {
      if (!s.startsWith('!')) return O.none;

      const split = s.substring(1).split(' ');
      const [kind_, value_] = split;
      if (!kind_ || !value_) return O.none;

      const kind = kinds.find((k) => k === kind_.trim());
      if (!kind) return O.none;

      const value = parseInt(value_);
      if (value === null || isNaN(value)) return O.none;

      return O.some({
        kind,
        value,
        name: split.slice(2).join(' ') || '???',
        source: url + '#L' + (i + 1),
      });
    })
  );

const loadSingleFile = (source: Github.Source, relPath: string) =>
  pipe(
    Github.localPath(source, relPath),
    FS.readTextFile,
    TE.map(parse(Github.blobURL(source, relPath)))
  );

const BASE_PATH = 'config/strings.conf';
const EXPANSION_PATH = 'strings.conf';

export const load = ({
  sources,
}: CtxWithoutResources): TE.TaskEither<string, Systrings> =>
  pipe(
    sources.expansions,
    RA.map((src) => loadSingleFile(src, EXPANSION_PATH)),
    RA.prepend(loadSingleFile(sources.base, BASE_PATH)),
    TE.sequenceArray,
    TE.map(RA.flatten),
    TE.map(
      RA.uniq({ equals: (a, b) => a.kind === b.kind && a.value === b.value })
    )
  );

const hexString = (ct: Systring): string => '0x' + ct.value.toString(16);

export const itemListDescription: Nav.Nav<Systring>['itemListDescription'] =
  (pageItems) => (item) => {
    const maxLength = (fn: (ct: Systring) => string): number =>
      pipe(
        pageItems,
        RNEA.reduce(0, (max, x) => {
          const s = fn(x);
          return s.length > max ? s.length : max;
        })
      );

    const paddedDec = str.leftPaddedCode(
      maxLength(({ value }) => value.toString())
    );
    const paddedHex = str.leftPaddedCode(maxLength(hexString));

    return pipe(
      [
        paddedDec(item.value.toString()),
        item.kind === 'system' ? O.none : paddedHex(hexString(item)),
        item.name,
      ],
      str.joinWords,
      str.trim,
      RTE.right
    );
  };

export const itemMenuDescription: Nav.Nav<Systring>['itemMenuDescription'] = (
  item
) =>
  pipe(
    item.kind === 'system' ? '' : ' | 0x' + item.value.toString(16),
    str.prepend(item.value.toString()),
    RTE.right
  );

export const itemEmbed = (s: Systring) => (ctx: Ctx) =>
  TE.right({
    title: s.kind + ' string',
    url: s.source,
    description: str.joinParagraphs([
      s.name,
      str.bold('DEC:') + ' ' + str.inlineCode(s.value.toString()),
      s.kind === 'system'
        ? O.none
        : str.bold('HEX:') + ' ' + str.inlineCode(hexString(s)),
    ]),
  });

export const findMatches = (kind: Kind) => (query: string) => (ctx: Ctx) => {
  const value = +query;
  if (value && !isNaN(value)) {
    const valMatches = ctx.systrings.filter(
      (s) => s.kind === kind && s.value === value
    );
    if (valMatches.length > 0) return valMatches;
  }
  return ctx.systrings.filter(
    (s) => s.kind === kind && s.name.toLowerCase().includes(query)
  );
};
