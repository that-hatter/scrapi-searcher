import {
  flow,
  O,
  pipe,
  RA,
  RNEA,
  RR,
  RTE,
  TE,
} from '@that-hatter/scrapi-factory/fp';
import { readerTask } from 'fp-ts';
import { sequenceS } from 'fp-ts/lib/Apply';
import { updateYard } from '../../../yard/loader';
import { updateBabel } from '../../../ygo/Babel';
import { updateBanlists } from '../../../ygo/Banlist';
import { updatePedia } from '../../../ygo/Pedia';
import { updateSystrings } from '../../../ygo/systrings';
import { Command, Ctx, dd, Err, Menu, Op, str } from '../../modules';

type UpdateFn<T> = () => TE.TaskEither<string, T>;
type Key = keyof typeof descriptions;
type Keys = RNEA.ReadonlyNonEmptyArray<Key>;
type Status = Record<Key, string>;

const descriptions = {
  babel: 'Card databases from BabelCDB.',
  banlists: 'Banlist data from LFLists.',
  pedia: 'Auxiliary card information from Yugipedia.',
  systrings: 'Strings from strings.conf files from Distribution and Delta.',
  yard: 'API documentation from scrapiyard.',
} as const;

const editStatusMessage = (status: Status, msg: dd.Message) =>
  flow(
    RNEA.map((s: Key) => status[s]),
    str.joinParagraphs,
    Op.editMessage(msg.channelId)(msg.id)
  );

export const executeUpdates =
  (opts: Keys) =>
  (msg: dd.Message): Op.Op<Ctx.Update> => {
    const status = {
      babel: 'Updating ' + str.inlineCode('babel') + '.',
      banlists: 'Updating ' + str.inlineCode('banlists') + '.',
      pedia: 'Updating ' + str.inlineCode('pedia') + '.',
      systrings: 'Updating ' + str.inlineCode('systrings') + '.',
      yard: 'Updating ' + str.inlineCode('yard') + '.',
    };

    const editStatus = (key: Key, s: string) => {
      status[key] = s;
      return editStatusMessage(status, msg)(opts);
    };

    const updater = <T>(key: Key, updateFn: UpdateFn<T>) => {
      if (!opts.includes(key)) return readerTask.of(O.none);

      const name = str.inlineCode(key);
      return pipe(
        updateFn,
        RTE.mapError(Err.forDev),
        RTE.tapError(() =>
          editStatus(key, `❌ Failed to update ${name}. Rolled back.`)
        ),
        RTE.mapError(Command.err(update, msg)),
        RTE.tapError(Err.sendAlerts),
        RTE.tap(() => editStatus(key, `✅ Successfully updated ${name}.`)),
        readerTask.map(O.fromEither)
      );
    };

    return pipe(
      editStatusMessage(status, msg)(opts),
      RTE.flatMapReaderTask(() =>
        sequenceS(readerTask.ApplyPar)({
          babel: updater('babel', updateBabel),
          banlists: updater('banlists', updateBanlists),
          pedia: updater('pedia', updatePedia),
          systrings: updater('systrings', updateSystrings),
          yard: updater('yard', updateYard),
        })
      ),
      RTE.map(Ctx.asUpdate)
    );
  };

export const parseKeys = (params: ReadonlyArray<string>) => {
  const keys = RR.keys(descriptions);
  const opts = params.includes('all')
    ? keys
    : keys.filter((p) => params.includes(p));
  return RNEA.fromReadonlyArray(opts);
};

const menu = pipe(
  descriptions,
  RR.toEntries,
  RA.map(([label, description]) => ({
    value: label,
    label,
    description,
  })),
  (options) =>
    Menu.row({
      customId: 'update',
      placeholder: 'Select data to update',
      maxValues: 3,
      options,
    })
);

export const update: Command.Command = {
  name: 'update',
  description: "Update the bot's data.",
  syntax: 'update <data-names...?>',
  aliases: [],
  devOnly: true,
  execute: (parameters, message) => {
    const keys = parseKeys(parameters);
    if (O.isNone(keys)) return Op.sendReply(message)({ components: [menu] });

    return pipe(
      Op.sendReply(message)({ content: 'Starting update...' }),
      RTE.flatMap(executeUpdates(keys.value))
    );
  },
};
