import { flow, Lazy, O, TE } from '@that-hatter/scrapi-factory/fp';
import { ioEither } from 'fp-ts';
import { str } from './modules';

export type DeepReadonly<T> = Readonly<{
  [K in keyof T]: T[K] extends number | string | symbol // Is it a primitive? Then make it readonly
    ? Readonly<T[K]>
    : // Is it an array of items? Then make the array readonly and the item as well
    T[K] extends Array<infer A>
    ? Readonly<Array<DeepReadonly<A>>>
    : // It is some other object, make it readonly as well
      DeepReadonly<T[K]>;
}>;

export type CanBeReadonly<T> = T | DeepReadonly<T>;

export type Optional<T> = {
  readonly [K in keyof T]: T[K] extends O.Option<infer _>
    ? T[K]
    : O.Option<T[K]>;
};

const replacer = (_: string, value: unknown) => {
  if (typeof value === 'bigint') return value.toString();
  return value;
};

const stringify = (val: unknown): string => {
  try {
    const s = JSON.stringify(val, replacer, 2);
    return s ?? str.clamped('<', '>')(typeof val);
  } catch {
    return str.clamped('<', '>')(typeof val);
  }
};

const tapLog = <T>(val: T): T => {
  console.log(stringify(val));
  return val;
};

const tapLogFn =
  <T, R>(fn: (val: T) => R) =>
  (val: T) => {
    console.log(stringify(fn(val)));
    return val;
  };

const errorString = (e: unknown) => {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  return str.codeBlock(stringify(e));
};

const taskify = <T>(fn: Lazy<Promise<T>>) => TE.tryCatch(fn, errorString);

const fallibleIO = <T>(fn: Lazy<T>) => ioEither.tryCatch(fn, errorString);

const taskifyIO = flow(fallibleIO, TE.fromIOEither);

const safeBigInt = (v: bigint | boolean | number | string) => {
  try {
    return BigInt(v);
  } catch {
    return 0n;
  }
};

const bigBits = (n: number | bigint): ReadonlyArray<bigint> => {
  const bigN = BigInt(n);
  const bits: Array<bigint> = [];
  for (let i = 1n; i <= bigN; i <<= 1n) {
    if ((i & bigN) === i) bits.unshift(i);
  }
  return bits;
};

const bits = (n: number): ReadonlyArray<number> => bigBits(n).map(Number);

export const utils = {
  stringify,
  tapLog,
  tapLogFn,
  taskify,
  fallibleIO,
  taskifyIO,
  safeBigInt,
  bigBits,
  bits,
};
