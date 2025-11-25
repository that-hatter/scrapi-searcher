import { pipe, RTE } from '@that-hatter/scrapi-factory/fp';
import { Scripts } from '../../ygo';
import { LIMITS } from '../constants';
import { Attachment, Button, Interaction, Op, str } from '../modules';

export const showScript = Button.interaction({
  name: 'showScript',
  execute: (_, interaction) => {
    return pipe(
      Op.getMessage(interaction.message.channelId)(interaction.message.id),
      RTE.flatMap(({ content }) => {
        const filename = str.afterLast('/')(content);
        return pipe(
          filename,
          str.after('c'),
          str.before('.lua'),
          (id) => Scripts.readFile(+id),
          RTE.map((script) => ({ script, filename }))
        );
      }),
      RTE.map(({ filename, script }): Interaction.UpdateData => {
        const scriptBlock = str.luaBlock(script);
        if (scriptBlock.length <= LIMITS.MESSAGE_CONTENT)
          return { content: scriptBlock };
        if (scriptBlock.length <= LIMITS.EMBED_DESCRIPTION)
          return { embeds: [{ description: scriptBlock }] };
        return { files: [Attachment.text(filename)(script)] };
      }),
      RTE.map((msg) => ({
        ...msg,
        flags: 64, // Ephemeral
      })),
      RTE.map(Interaction.asMessageResponse),
      RTE.flatMap(Interaction.sendResponse(interaction))
    );
  },
});
