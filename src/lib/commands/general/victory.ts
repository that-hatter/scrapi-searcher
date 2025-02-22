import { identity, pipe, R, RNEA, RTE } from '@that-hatter/scrapi-factory/fp';
import { Systrings } from '../../../ygo';
import { Command, Nav, SearchCommand } from '../../modules';

export const victory: Command.Command = {
  name: 'victory',
  description:
    'Find victory strings (alternate win conditions) by name or value. ' +
    'Case-insensitive, partial matches allowed.',
  syntax: 'victory <query>',
  aliases: ['win'],
  execute: (parameters, message) => {
    const query = parameters.join(' ').toLowerCase();
    return pipe(
      Systrings.findMatches('victory')(query),
      R.map(RNEA.fromReadonlyArray),
      RTE.fromReader,
      RTE.flatMapOption(identity, () => SearchCommand.noMatches(query)),
      RTE.map(
        (items): Nav.Nav<Systrings.Systring> => ({
          title: SearchCommand.title(items.length, 'victory string', query),
          items,
          selectHint: 'Select victory string to display',
          bulletList: true,
          messageId: message.id,
          channelId: message.channelId,
          itemId: (ct) => ct.value.toString(),
          itemName: (ct) => RTE.right(ct.name),
          itemListDescription: Systrings.itemListDescription,
          itemMenuDescription: Systrings.itemMenuDescription,
          itemEmbed: Systrings.itemEmbed,
        })
      ),
      RTE.flatMap(Nav.sendInitialPage(message))
    );
  },
};
