import { Greenlight } from '../../ygo';
import { filterStatus as claiming } from '../commands/dev/claim';
import { filterStatus as staging } from '../commands/dev/stage';
import { Menu } from '../modules';

export const glStatusSelect = Menu.interaction({
  name: 'glStatusSelect',
  devOnly: true,
  execute: (_, ixn, statuses) => {
    const ss = Greenlight.asStatusSteps(statuses);
    if (ixn.message.embeds?.at(0)?.title?.startsWith('Staging cards for '))
      return staging(ss)(ixn);
    return claiming(ss)(ixn);
  },
});
