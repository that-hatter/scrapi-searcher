import { pipe, RNEA, RTE } from '@that-hatter/scrapi-factory/fp';
import { Collection, Command, Err, Nav, Op, str } from '.';

export type Options<T> = {
  readonly name: string;
  readonly aliases: ReadonlyArray<string>;
  readonly itemCollection: Op.SubOp<Collection.Collection<T>>;
  readonly customFilter?: (
    parameters: ReadonlyArray<string>
  ) => (item: T) => boolean;
} & Nav.Formatters<T> &
  Pick<Nav.Nav<T>, 'itemId'>;

export const title = (amt: number, name: string, query: string) => {
  const s = `Found ${amt} ${name}(s) matching ${str.inlineCode(query)}`;
  return str.limit('...', 100)(s);
};

export const noMatches = (query: string): Err.Err =>
  pipe(
    query,
    str.limit('...', 200),
    str.inlineCode,
    str.append('.'),
    str.prepend('No matches found for '),
    Err.forUser
  );

export const searchCommand = <T>(opts: Options<T>): Command.Command => ({
  name: opts.name,
  description: `Search ${opts.name}s by name. Results are case-insensitive and can be partial.`,
  syntax: opts.name + ' <query>',
  aliases: opts.aliases,
  execute: (parameters, message) => {
    const query = parameters.join(' ');
    const filterFn = opts.customFilter
      ? opts.customFilter(parameters)
      : (t: T) => opts.itemId(t).toLowerCase().includes(query);

    return pipe(
      opts.itemCollection,
      RTE.mapError(Err.forDev),
      RTE.map(({ array }) => {
        const res = array.filter(filterFn);
        if (opts.customFilter || parameters.length > 1) return res;
        return res.sort((a, b) => {
          const a_ = opts.itemId(a).toLowerCase().startsWith(query);
          const b_ = opts.itemId(b).toLowerCase().startsWith(query);
          return a_ && !b_ ? -1 : b_ && !a_ ? 1 : 0;
        });
      }),
      RTE.flatMapOption(RNEA.fromReadonlyArray, () => noMatches(query)),
      RTE.map(
        (items): Nav.Nav<T> => ({
          title: title(items.length, opts.name, query),
          items,
          selectHint: `Select ${opts.name} to display`,
          messageId: message.id,
          channelId: message.channelId,
          itemId: opts.itemId,

          itemListDescription: opts.itemListDescription,
          itemMenuDescription: opts.itemMenuDescription,
          itemEmbed: opts.itemEmbed,
          itemComponents: opts.itemComponents,
        })
      ),
      RTE.flatMap(Nav.sendInitialPage(message))
    );
  },
});
