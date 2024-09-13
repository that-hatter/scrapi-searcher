import { switchSection } from '../commands/dev/claim';
import { Menu } from '../modules';

export const glPackSelect = Menu.interaction({
  name: 'glPackSelect',
  execute: (_, interaction, [pack]) => switchSection(interaction)({ pack }),
});
