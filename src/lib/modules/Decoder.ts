import { E, flow, O, pipe, RA } from '@that-hatter/scrapi-factory/fp';
import { nonEmptyArray } from 'fp-ts';
import * as Decoder from 'io-ts/Decoder';

export const parse = <I, A>(dc: Decoder.Decoder<I, A>) =>
  flow(dc.decode, E.mapLeft(Decoder.draw));

export const option = <A>(
  value: Decoder.Decoder<unknown, A>
): Decoder.Decoder<unknown, O.Option<A>> =>
  Decoder.union(
    Decoder.struct({ _tag: Decoder.literal('None') }),
    Decoder.struct({ _tag: Decoder.literal('Some'), value })
  );

export const numString = pipe(
  Decoder.string,
  Decoder.refine((s): s is string => s.length > 0, 'proper number'),
  Decoder.map((n) => +n),
  Decoder.refine((n): n is number => n !== null && !isNaN(n), 'proper number')
);

export const head = flow(Decoder.array, Decoder.map(RA.head));

export const headReq = flow(
  Decoder.array,
  Decoder.refine(
    <A>(xs: ReadonlyArray<A>): xs is nonEmptyArray.NonEmptyArray<A> =>
      xs.length > 0,
    'non-empty'
  ),
  Decoder.map(nonEmptyArray.head)
);

export * from 'io-ts/Decoder';
