import * as sy from '@that-hatter/scrapi-factory';
import { E, pipe, RA, RNEA, RTE } from '@that-hatter/scrapi-factory/fp';
import { sequenceS } from 'fp-ts/lib/Apply';
import { Decoder, Err, Interaction, Op, str } from '.';
import { Ctx, CtxWithoutResources } from '../../Ctx';
import { Yard } from '../../yard';
import {
  Babel,
  Banlists,
  BetaIds,
  KonamiIds,
  Pics,
  Scripts,
  Shortcuts,
  Systrings,
} from '../../ygo';

export const init = sequenceS(RTE.ApplyPar)({
  babel: Babel.resource.init,
  yard: Yard.resource.init,
  systrings: Systrings.resource.init,
  banlists: Banlists.resource.init,
  betaIds: BetaIds.resource.init,
  konamiIds: KonamiIds.resource.init,
  shortcuts: Shortcuts.resource.init,
  pics: Pics.resource.init,
  scripts: Scripts.resource.init,
});

export type Loaded = {
  readonly yard: sy.Yard;
  readonly babel: Babel.Babel;
  readonly systrings: Systrings.Systrings;
  readonly banlists: Banlists.Banlists;
  readonly betaIds: BetaIds.BetaIds;
  readonly konamiIds: KonamiIds.KonamiIds;
  readonly shortcuts: Shortcuts.Shortcuts;
  readonly pics: Pics.Pics;
  readonly scripts: Scripts.Scripts;
};

export type Resource<K extends keyof Loaded> = {
  readonly key: K;
  readonly description: string;
  readonly update: RTE.ReaderTaskEither<Ctx, string, Loaded[K]>;
  readonly init: RTE.ReaderTaskEither<CtxWithoutResources, string, Loaded[K]>;
  readonly commitFilter: (
    repo: string,
    files: ReadonlyArray<string>
  ) => boolean;
};

const UPDATE_SYMBOL = Symbol();
export type Update = Partial<Loaded> & {
  readonly _tag: typeof UPDATE_SYMBOL;
};

const updateDecoder = Decoder.struct({
  _tag: Decoder.fromRefinement(
    (v): v is Update => v === UPDATE_SYMBOL,
    'update symbol'
  ),
});

export const isUpdate = (val: unknown): val is Update =>
  E.isRight(updateDecoder.decode(val));

export const asUpdate = (resource: Partial<Loaded>): Update => ({
  _tag: UPDATE_SYMBOL,
  ...resource,
});

export const array = [
  Babel.resource,
  Yard.resource,
  Systrings.resource,
  Banlists.resource,
  BetaIds.resource,
  KonamiIds.resource,
  Shortcuts.resource,
  Pics.resource,
  Scripts.resource,
] as const;

const getIndividualUpdate = <K extends keyof Loaded>(
  trigger: string,
  resource: Resource<K>
) => {
  const statusMessage = str.append(' Trigger: ' + trigger + '.');
  const name = str.inlineCode(resource.key);
  return pipe(
    statusMessage('Updating ' + name + '.'),
    Op.sendLog,
    RTE.flatMap((msg) =>
      pipe(
        resource.update,
        RTE.mapError(Err.forDev),
        RTE.tap(() =>
          Op.editMessage(msg.channelId)(msg.id)(
            statusMessage(`✅ Successfully updated ${name}.`)
          )
        ),
        RTE.tapError(() =>
          Op.editMessage(msg.channelId)(msg.id)(
            statusMessage(`❌ Failed to update ${name}. Rolled back.`)
          )
        )
      )
    ),
    RTE.map((d) => ({ [resource.key]: d }))
  );
};

const performUpdates =
  (trigger: string) =>
  (resource: ReadonlyArray<Resource<keyof Loaded>>): Op.Op<Update> =>
    pipe(
      resource,
      RNEA.fromReadonlyArray,
      RTE.fromOption(Err.ignore),
      RTE.map(RNEA.map((d) => getIndividualUpdate(trigger, d))),
      RTE.flatMap(RTE.sequenceArray),
      RTE.map(RA.reduce(asUpdate({}), (agg, curr) => ({ ...agg, ...curr })))
    );

export const manualUpdate = (
  ixn: Interaction.WithMsg,
  keys: ReadonlyArray<string>
): Op.Op<Update> => {
  const trigger = ixn.guildId
    ? str.link(
        'Manual Update',
        'https://discord.com/channels/' +
          `${ixn.guildId}/${ixn.message.channelId}/${ixn.message.id}`
      )
    : 'Manual Update (Direct Message)';
  return pipe(
    array,
    RA.filter(({ key }) => keys.includes(key)),
    performUpdates(trigger)
  );
};

export const autoUpdate = (
  triggerUrl: string,
  repo: string,
  files: ReadonlyArray<string>
) =>
  pipe(
    array,
    RA.filter((resource) => resource.commitFilter(repo, files)),
    performUpdates(str.link('Github Push', triggerUrl))
  );
