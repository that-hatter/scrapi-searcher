import { pipe, RTE } from '@that-hatter/scrapi-factory/fp';
import { currentState, page } from '../commands/dev/claim';
import { Button, Interaction } from '../modules';

export const glDisplayClaimed = Button.interaction({
  name: 'glDisplayClaimed',
  execute: (_, interaction) =>
    pipe(
      currentState(interaction.message),
      RTE.flatMap((state) =>
        page({ ...state, displayClaimed: !state.displayClaimed })
      ),
      RTE.flatMap(Interaction.sendUpdate(interaction))
    ),
});
