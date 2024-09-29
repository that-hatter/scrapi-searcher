import { O, pipe, RTE, TE } from '@that-hatter/scrapi-factory/fp';
import { Ctx } from '../../Ctx';
import {
  rawDataEmbed,
  rawDescEmbed,
  rawStringsEmbed,
  rawvalModeMenu,
} from '../commands/general/rawvals';
import { Err, Interaction, Menu, str } from '../modules';

const getUpdate = (id: number, mode: string) => (ctx: Ctx) => {
  const embedFn =
    mode === 'desc'
      ? rawDescEmbed
      : mode === 'strs'
      ? rawStringsEmbed
      : rawDataEmbed;

  return pipe(
    ctx.babel.record[id.toString()],
    O.fromNullable,
    O.map((c) => embedFn(c)(ctx)),
    O.map((embed) => ({ embeds: [embed], components: [rawvalModeMenu(mode)] })),
    TE.fromOption(Err.ignore)
  );
};

export const rawvalMode = Menu.interaction({
  name: 'rawvalMode',
  execute: (_, interaction, [mode]) => {
    const t = interaction.message.embeds[0]?.title;
    if (!t) return RTE.left(Err.forDev('Could not find title'));

    const id_ = str.split(' ')(t)[0];
    const id = +id_.substring(1, id_.length - 1);
    if (id === null || isNaN(id))
      return RTE.left(Err.forDev('Could not parse id'));

    return pipe(
      getUpdate(id, mode),
      RTE.flatMap(Interaction.sendUpdate(interaction))
    );
  },
});
