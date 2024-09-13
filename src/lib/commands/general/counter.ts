import { identity, pipe, R, RNEA, RTE } from '@that-hatter/scrapi-factory/fp';
import { Systrings } from '../../../ygo';
import { Command, Err, Nav, SearchCommand, str } from '../../modules';

export const counter: Command.Command = {
  name: 'counter',
  description:
    'Search counters by name or value. Name matches are case-insensitive and can be partial.',
  syntax: 'counter <query>',
  aliases: [],
  execute: (parameters, message) => {
    const query = parameters.join(' ');
    return pipe(
      Systrings.findMatches('counter')(query),
      R.map(RNEA.fromReadonlyArray),
      RTE.fromReader,
      RTE.flatMapOption(identity, () =>
        Err.forUser('No matches found for ' + str.inlineCode(query))
      ),
      RTE.map(
        (items): Nav.Nav<Systrings.Systring> => ({
          title: SearchCommand.title(items.length, 'counter', query),
          items,
          selectHint: 'Select counter to display',
          messageId: message.id,
          channelId: message.channelId,
          bulletList: true,
          itemName: (ct) => ct.name,
          itemListDescription: Systrings.itemListDescription,
          itemEmbed: Systrings.itemEmbed,
        })
      ),
      RTE.flatMap(Nav.sendInitialPage(message))
    );
  },
};
