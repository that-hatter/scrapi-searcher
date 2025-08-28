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
import { Fetch, Github, Nav, Resource, str } from '../lib/modules';

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

const fetchAndParse = (src: Github.Source, path: string) =>
  pipe(
    Github.rawURL(src, path),
    Fetch.text,
    TE.map(parse(Github.blobURL(src, path)))
  );

const DELTA_PATH = 'strings.conf';
const DIST_PATH = 'config/strings.conf';

const update = pipe(
  RTE.ask<CtxWithoutResources>(),
  RTE.flatMapTaskEither(({ sources }) =>
    pipe(
      fetchAndParse(sources.delta, DELTA_PATH),
      TE.flatMap((delta) =>
        pipe(
          fetchAndParse(sources.distribution, DIST_PATH),
          TE.map(
            RA.filter(
              ({ kind, value }) =>
                !delta.some((d) => d.kind === kind && d.value === value)
            )
          ),
          TE.map(RA.concat(delta))
        )
      )
    )
  )
);

export const resource: Resource.Resource<'systrings'> = {
  key: 'systrings',
  description: 'Strings from strings.conf files.',
  update,
  init: update,
  commitFilter: (ctx) => (src, files) =>
    (Github.isSource(src, ctx.sources.delta) && files.includes(DELTA_PATH)) ||
    (Github.isSource(src, ctx.sources.distribution) &&
      files.includes(DIST_PATH)),
};

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
