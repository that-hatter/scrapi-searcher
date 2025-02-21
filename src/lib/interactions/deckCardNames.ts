import { flow, pipe, RTE } from '@that-hatter/scrapi-factory/fp';
import { Deck } from '../../ygo';
import { Button, Err, Interaction, Op } from '../modules';

export const deckCardNames = Button.interaction({
  name: 'deckCardNames',
  execute: ([index], interaction) => {
    return pipe(
      Op.getMessage(interaction.message.channelId)(interaction.message.id),
      RTE.flatMap(({ messageReference }) => {
        const ref = messageReference;
        if (!ref) return RTE.left(Err.forDev('Failed to retrieve deck input.'));
        if (!ref.channelId || !ref.messageId)
          return RTE.left(Err.forDev('Failed to retrieve deck input.'));
        return Op.getMessage(ref.channelId)(ref.messageId);
      }),
      RTE.flatMap(flow(Deck.parseDecks, RTE.mapError(Err.forDev))),
      RTE.flatMapNullable(
        (deck) => deck.at(+(index ?? 0)),
        () => Err.forDev('Could not find deck from message: index ' + index)
      ),
      RTE.flatMap(Deck.toEmbed),
      RTE.map((embed) => ({
        embeds: [embed],
        flags: 64, // Ephemeral
      })),
      RTE.map(Interaction.asMessageResponse),
      RTE.flatMap(Interaction.sendResponse(interaction))
    );
  },
});
