import { Greenlight } from '../../ygo';
import { filterStatus as claiming } from '../commands/dev/claim';
import { filterStatus as staging } from '../commands/dev/stage';
import { Menu } from '../modules';

export const glStatusSelect = Menu.interaction({
  name: 'glStatusSelect',
  execute: (_, interaction, statuses) => {
    const ss = Greenlight.asStatusSteps(statuses);
    if (interaction.message.embeds[0]?.title?.startsWith('Staging cards for '))
      return staging(ss)(interaction);
    return claiming(ss)(interaction);
  },
});
