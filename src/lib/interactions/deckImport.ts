import { flow, pipe, RTE } from '@that-hatter/scrapi-factory/fp';
import { Deck } from '../../ygo';
import { Button, Err, Interaction, Op, str } from '../modules';

export const deckImport = Button.interaction({
  name: 'deckImport',
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
      RTE.map((deck) => ({
        content:
          'Copy the following YDKE string and paste it in the EDOPro deck editor:\n' +
          str.codeBlock(Deck.toYdkeString(deck)) +
          "Or download the following ydk file and place it in your EDOPro installation's deck folder:",
        files: [Deck.toYdkFile(deck)],
        flags: 64, // Ephemeral
      })),
      RTE.map(Interaction.asMessageResponse),
      RTE.flatMap(Interaction.sendResponse(interaction))
    );
  },
});
