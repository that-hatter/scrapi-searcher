import { switchSection } from '../commands/dev/claim';
import { Menu } from '../modules';

export const glThemeSelect = Menu.interaction({
  name: 'glThemeSelect',
  devOnly: true,
  execute: (_, interaction, [theme]) => switchSection(interaction)({ theme }),
});
