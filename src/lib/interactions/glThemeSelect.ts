import { switchSection } from '../commands/dev/claim';
import { Menu } from '../modules';

export const glThemeSelect = Menu.interaction({
  name: 'glThemeSelect',
  execute: (_, interaction, [theme]) => switchSection(interaction)({ theme }),
});
