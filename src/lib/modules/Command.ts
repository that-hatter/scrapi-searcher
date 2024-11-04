import { O, pipe, R } from '@that-hatter/scrapi-factory/fp';
import type { Collection } from '.';
import { dd, Err, Op, str } from '.';
import { Ctx } from '../../Ctx';

export type Execution = (
  parameters: ReadonlyArray<string>,
  message: Readonly<dd.Message>
) => Op.Op<unknown>;

export type Command = {
  readonly name: string;
  readonly syntax: string;
  readonly description: string;
  readonly aliases: ReadonlyArray<string>;
  readonly devOnly?: boolean;
  readonly execute: Execution;
};

export type Collection = Collection.Collection<Command>;

// TODO: more valid cases? (specific admin users, debug mode, etc.)
export const devCheck =
  (message: dd.Message) =>
  ({ dev }: Ctx): boolean => {
    const authorId = message.author?.id.toString();
    if (!authorId) return false;
    if (dev.admin === authorId) return true;
    if (dev.guild.toString() === message.guildId?.toString()) return true;
    return !!dev.users[authorId];
  };

const embedFields =
  (cmd: Command) =>
  (ctx: Ctx): Array<dd.DiscordEmbedField> => {
    const syntaxField: dd.DiscordEmbedField = {
      name: 'Syntax',
      value: str.inlineCode(ctx.prefix + cmd.syntax),
      inline: true,
    };
    if (cmd.aliases.length === 0) return [syntaxField];
    const aliasField = {
      name: 'Aliases',
      value: cmd.aliases.map(str.inlineCode).join(', '),
      inline: true,
    };
    return [syntaxField, aliasField];
  };

export const embed = (cmd: Command): R.Reader<Ctx, dd.DiscordEmbed> =>
  pipe(
    embedFields(cmd),
    R.map((fields) => ({
      title: cmd.name,
      description:
        cmd.description +
        '\n' +
        str.subtext(
          str.link(
            'Documentation',
            'https://github.com/that-hatter/scrapi-searcher/blob/master/docs/commands.md#' +
              cmd.name
          )
        ),
      fields,
    }))
  );

export const err =
  (cmd: Command, message: dd.Message) =>
  (err: Err.Err): Err.Err => {
    const reason = pipe(
      err.reason,
      O.orElse(() => O.some(message))
    );

    const devAlert = pipe(
      err.devAlert,
      O.map(str.append('\n\n-# Encountered while processing command: ')),
      O.map(str.append(cmd.name))
    );

    const userAlert = pipe(
      err.userAlert,
      O.orElse(() => {
        if (O.isNone(err.devAlert)) return O.none;
        return O.some(
          'An error was encountered while processing your command. ' +
            'This incident has been reported.'
        );
      })
    );

    return { devAlert, userAlert, reason };
  };
