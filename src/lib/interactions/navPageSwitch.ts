import { pipe, RTE } from '@that-hatter/scrapi-factory/fp';
import { Button, Interaction, Nav } from '../modules';

export const navPageSwitch = Button.interaction({
  name: 'navPageSwitch',
  execute: ([page], interaction) =>
    Nav.apply(interaction, (nav) =>
      pipe(
        Nav.listPageMessage(+(page || 1), nav),
        RTE.flatMap(Interaction.sendUpdate(interaction))
      )
    ),
});
