import { switchSection } from '../commands/dev/claim';
import { Menu } from '../modules';

export const glIssueSelect = Menu.interaction({
  name: 'glIssueSelect',
  execute: (_, interaction, [issue_]) =>
    switchSection(interaction)({ issue: +issue_ }),
});
