import { pipe, RTE } from '@that-hatter/scrapi-factory/fp';
import { currentState, page } from '../commands/dev/claim';
import { Button, Interaction } from '../modules';

export const glClaimRefresh = Button.interaction({
  name: 'glClaimRefresh',
  execute: (_, interaction) =>
    pipe(
      currentState(interaction.message),
      RTE.flatMap(page),
      RTE.flatMap(Interaction.sendUpdate(interaction))
    ),
});
