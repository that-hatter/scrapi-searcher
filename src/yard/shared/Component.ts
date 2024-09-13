import { O, RNEA, flow, pipe } from '@that-hatter/scrapi-factory/fp';
import { LIMITS } from '../../lib/constants';
import { dd, str } from '../../lib/modules';

// TODO: consider adding links and dynamically
// falling back to no links if it becomes too long
export const singleType = str.bold;

export const fullType = flow(RNEA.map(singleType), str.intercalate('|'));

export const embedField =
  <T>(name: string, sectionFn: (x: T) => string) =>
  (xs: ReadonlyArray<T>): O.Option<dd.DiscordEmbedField> =>
    pipe(
      xs,
      RNEA.fromReadonlyArray,
      O.map(
        flow(
          RNEA.map(sectionFn),
          str.unorderedList,
          (v) =>
            v.length > LIMITS.EMBED_FIELD ? '[Too long to display here]' : v,
          (value) => ({ name, value })
        )
      )
    );
