import { identity, pipe, R, RNEA, RTE } from '@that-hatter/scrapi-factory/fp';
import { Systrings } from '../../../ygo';
import { Command, Nav, SearchCommand } from '../../modules';

export const counter: Command.Command = {
  name: 'counter',
  description:
    'Find counters by name or value. Case-insensitive, partial matches allowed.',
  syntax: 'counter <query>',
  aliases: [],
  execute: (parameters, message) => {
    const query = parameters.join(' ');
    return pipe(
      Systrings.findMatches('counter')(query),
      R.map(RNEA.fromReadonlyArray),
      RTE.fromReader,
      RTE.flatMapOption(identity, () => SearchCommand.noMatches(query)),
      RTE.map(
        (items): Nav.Nav<Systrings.Systring> => ({
          title: SearchCommand.title(items.length, 'counter', query),
          items,
          selectHint: 'Select counter to display',
          messageId: message.id,
          channelId: message.channelId,
          bulletList: true,
          itemId: (ct) => ct.name,
          itemListDescription: Systrings.itemListDescription,
          itemEmbed: Systrings.itemEmbed,
        })
      ),
      RTE.flatMap(Nav.sendInitialPage(message))
    );
  },
};
