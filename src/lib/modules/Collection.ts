import { O, pipe, RA, RR } from '@that-hatter/scrapi-factory/fp';

export type Collection<T> = {
  readonly array: ReadonlyArray<T>;
  readonly record: RR.ReadonlyRecord<string, T>;
};

export const findByKey =
  <T>(col: Collection<T>) =>
  (key: string): O.Option<T> =>
    O.fromNullable(col.record[key]);

export const fromList =
  <T>(keyFn: (item: T) => string | ReadonlyArray<string>) =>
  (array: ReadonlyArray<T>): Collection<T> =>
    pipe(
      array,
      RA.flatMap((item) =>
        pipe(
          item,
          keyFn,
          (key) => (typeof key === 'string' ? [key] : key),
          RA.map((key) => [key, item] as const)
        )
      ),
      RR.fromEntries,
      (record) => ({ array, record })
    );
