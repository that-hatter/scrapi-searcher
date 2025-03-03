import { pipe, RTE } from '@that-hatter/scrapi-factory/fp';
import fetch from 'node-fetch';
import { LIMITS } from '../constants';
import { Attachment, Button, Err, Interaction, Op, str } from '../modules';
import { utils } from '../utils';

const toRawUrl = (folder: string, file: string) =>
  `https://raw.githubusercontent.com/ProjectIgnis/CardScripts/refs/heads/master/${folder}/${file}`;

export const showScript = Button.interaction({
  name: 'showScript',
  execute: (_, interaction) => {
    return pipe(
      Op.getMessage(interaction.message.channelId)(interaction.message.id),
      RTE.bindTo('message'),
      RTE.bindW('folderAndFile', ({ message }) =>
        pipe(
          message.content,
          str.after('/master/'),
          str.before('>'),
          str.split('/'),
          ([folder, file]) =>
            file
              ? RTE.right([folder, file] as const)
              : RTE.left(Err.forDev('Failed to parse script folder and file'))
        )
      ),
      RTE.bindW('script', ({ folderAndFile }) => {
        const [folder, filename] = folderAndFile;
        return pipe(
          toRawUrl(folder, filename),
          (url) => utils.taskify(() => fetch(url).then((resp) => resp.text())),
          RTE.fromTaskEither,
          RTE.mapError(Err.forDev)
        );
      }),
      RTE.map(({ folderAndFile, script }): Interaction.UpdateData => {
        const scriptBlock = str.luaBlock(script);
        if (scriptBlock.length <= LIMITS.MESSAGE_CONTENT)
          return { content: scriptBlock };
        if (scriptBlock.length <= LIMITS.EMBED_DESCRIPTION)
          return { embeds: [{ description: scriptBlock }] };
        const [_, filename] = folderAndFile;
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
