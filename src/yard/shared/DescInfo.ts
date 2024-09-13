import type * as sf from '@that-hatter/scrapi-factory';
import { flow, O, pipe } from '@that-hatter/scrapi-factory/fp';
import { str } from '../../lib/modules';

export const nonPlaceholder = flow(
  str.trim,
  O.fromPredicate(
    (s) => s.length > 0 && s !== '(To be added)' && s !== 'no description yet'
  )
);

export const appendNonPlaceholder =
  (sep: string) => (toAppend: string) => (content: string) =>
    pipe(
      toAppend,
      nonPlaceholder,
      O.map((np) => content + sep + np),
      O.getOrElse(() => content)
    );

export const appendSummary =
  (sep: string) => (doc: sf.DescInfo) => (content: string) =>
    pipe(
      doc.summary,
      O.map(str.fromAST),
      O.flatMap(nonPlaceholder),
      O.map((summary) => content + sep + summary),
      O.getOrElse(() => content)
    );

export const summaryOrDesc = (doc: sf.DescInfo): string =>
  pipe(
    doc.summary,
    O.getOrElse(() => doc.description),
    str.fromAST,
    nonPlaceholder,
    O.getOrElse(() => '')
  );
