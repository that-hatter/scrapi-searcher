import * as sy from '@that-hatter/scrapi-factory';
import { E, flow, O, pipe, RA, RTE, TE } from '@that-hatter/scrapi-factory/fp';
import { sequenceS } from 'fp-ts/lib/Apply';
import { dd, Decoder, Err, Github, Op, str } from '.';
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

const pullRepos = ({ sources }: CtxWithoutResources) =>
  pipe(
    [sources.base, ...sources.expansions, sources.yard],
    RA.map(O.some),
    RA.concat([sources.banlists, sources.misc]),
    RA.compact,
    RA.map((src) => Github.pullOrClone(Github.localRelativePath(src), src)),
    TE.sequenceSeqArray
  );

const loadAll = sequenceS(RTE.ApplyPar)({
  yard: Yard.load,
  babel: Babel.load,
  systrings: Systrings.load,
  banlists: Banlists.load,
  betaIds: BetaIds.load,
  konamiIds: KonamiIds.load,
  shortcuts: Shortcuts.load,
  pics: Pics.load,
  scripts: Scripts.load,
});

export const init = (ctx: CtxWithoutResources) =>
  pipe(
    ctx,
    pullRepos,
    TE.flatMap(() => loadAll(ctx))
  );

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

const getApplicableUpdates =
  (sources: ReadonlyArray<Github.Source>) =>
  (ctx: Ctx): TE.TaskEither<Err.Err, Update> => {
    const pulledRepos = pipe(sources, RA.map(Github.localRelativePath));

    const updater = <T>(
      repos: ReadonlyArray<Github.Source>,
      updateFn: Op.SubOp<T>
    ): TE.TaskEither<string, T | undefined> => {
      const check = pipe(
        repos,
        RA.map(Github.localRelativePath),
        RA.intersection(str.Eq)(pulledRepos),
        RA.isNonEmpty
      );
      return check ? updateFn(ctx) : TE.right(undefined);
    };

    const optionalRepo = flow(
      O.map(RA.of),
      O.getOrElseW(() => [])
    );

    const baseAndExpansionRepos = [ctx.sources.base, ...ctx.sources.expansions];
    const miscRepo = optionalRepo(ctx.sources.misc);

    return pipe(
      {
        yard: updater([ctx.sources.yard], Yard.load),
        babel: updater(baseAndExpansionRepos, Babel.load),
        systrings: updater(baseAndExpansionRepos, Systrings.load),
        banlists: updater(optionalRepo(ctx.sources.banlists), Banlists.load),
        betaIds: updater(ctx.sources.expansions, BetaIds.load),
        konamiIds: updater(miscRepo, KonamiIds.load),
        shortcuts: updater(miscRepo, Shortcuts.load),
        pics: updater(miscRepo, Pics.load),
        scripts: updater(baseAndExpansionRepos, Scripts.load),
      },
      sequenceS(TE.ApplicativePar),
      TE.map(asUpdate),
      TE.mapError(Err.forDev)
    );
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

const performUpdate = (trigger: string) => (src: Github.Source) => {
  const statusMessage = str.append('\nTrigger: ' + trigger + '.');
  const repo = str.link(str.inlineCode(src.repo), Github.treeURL(src));
  return pipe(
    `Pulling ${repo}...`,
    statusMessage,
    Op.sendLog,
    RTE.flatMap((msg) => {
      const editStatus = flow(
        statusMessage,
        Op.editMessage(msg.channelId)(msg.id)
      );
      return pipe(
        Github.pullOrClone(Github.localRelativePath(src), src),
        RTE.fromTaskEither,
        RTE.mapError(Err.forDev),
        RTE.flatMap(() =>
          pipe(
            `Successfully pulled ${repo}. Updating related resources...`,
            editStatus,
            RTE.flatMap(() => getApplicableUpdates([src])),
            RTE.tap(() =>
              editStatus(`✅ Successfully updated related to ${repo}.`)
            ),
            RTE.tapError(() =>
              editStatus(`❌ Failed to update resources related to ${repo}.`)
            )
          )
        ),
        RTE.tapError(() => editStatus(`❌ Failed to pull ${repo}.`))
      );
    })
  );
};

export const autoUpdate = (commitUrl: string) =>
  performUpdate(str.link('Github Push', commitUrl));

export const manualUpdate = (msg: dd.Message) => {
  const link = msg.guildId
    ? `https://discord.com/channels/${msg.guildId}/${msg.channelId}/${msg.id}`
    : '(Direct Message)';
  return performUpdate('Manual Update: ' + link);
};
