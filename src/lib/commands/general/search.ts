import { identity, pipe, R, RNEA, RTE } from '@that-hatter/scrapi-factory/fp';
import { Ctx } from '../../../Ctx';
import { Card } from '../../../ygo';
import { Command, Nav, SearchCommand } from '../../modules';

const getMatches = (query: string) => (ctx: Ctx) =>
  ctx.babel.array.filter(
    (c) =>
      c.name.toLowerCase().includes(query) ||
      c.desc.toLowerCase().includes(query)
  );

export const search: Command.Command = {
  name: 'search',
  description:
    'Find cards by name or text. Case-insensitive, partial matches allowed.',
  syntax: 'search <query>',
  aliases: ['cardsearch'],
  execute: (parameters, message) => {
    const query = parameters.join(' ').toLowerCase();
    return pipe(
      getMatches(query),
      R.map(RNEA.fromReadonlyArray),
      RTE.fromReader,
      RTE.flatMapOption(identity, () => SearchCommand.noMatches(query)),
      RTE.map((items) =>
        Card.nav(
          SearchCommand.title(items.length, 'card', query),
          items,
          message
        )
      ),
      RTE.flatMap(Nav.sendInitialPage(message))
    );
  },
};
