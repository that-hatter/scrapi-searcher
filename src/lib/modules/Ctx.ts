import { Octokit } from '@octokit/rest';
import * as sy from '@that-hatter/scrapi-factory';
import { E, O, pipe, TE } from '@that-hatter/scrapi-factory/fp';
import { sequenceS } from 'fp-ts/lib/Apply';
import { Collection, Command, dd, Decoder, Interaction } from '.';
import { initYard } from '../../yard/loader';
import { Babel, Banlist, BitNames, Pedia, Systrings } from '../../ygo';
import { DeepReadonly, Optional } from '../utils';

// -----------------------------------------------------------------------------
// types
// -----------------------------------------------------------------------------

export const configDecoder = Decoder.struct({
  dev: Decoder.struct({
    admin: Decoder.string,
    guild: Decoder.string,
    logs: Decoder.string,
    users: Decoder.record(Decoder.string),
  }),
  prefix: Decoder.string,
  github: Decoder.string,
  token: Decoder.string,
});

export type Config = Decoder.TypeOf<typeof configDecoder>;

type Updateable = {
  readonly yard: sy.Yard;
  readonly babel: Babel.Babel;
  readonly pedia: Pedia.IdsList;
  readonly systrings: Systrings.Systrings;
  readonly banlists: Banlist.Banlists;
};

export type Ctx = {
  readonly bot: dd.Bot;
  readonly commands: Collection.Collection<Command.Command>;
  readonly componentInteractions: Collection.Collection<Interaction.Component>;
  readonly octokit: Octokit;
  readonly bitNames: BitNames.BitNames;
} & Updateable &
  DeepReadonly<Config>;

// -----------------------------------------------------------------------------
// updating
// -----------------------------------------------------------------------------

const CTX_UPDATE_SYMBOL = Symbol();
export type Update = Optional<Updateable> & {
  readonly _tag: typeof CTX_UPDATE_SYMBOL;
};

const updateDecoder = Decoder.struct({
  _tag: Decoder.fromRefinement(
    (v): v is Update => v === CTX_UPDATE_SYMBOL,
    'update symbol'
  ),
});

export const isUpdate = (val: unknown): val is Update =>
  E.isRight(updateDecoder.decode(val));

export const asUpdate = (up: Optional<Updateable>): Update => ({
  _tag: CTX_UPDATE_SYMBOL,
  ...up,
});

export const applyUpdate =
  (up: Update) =>
  (ctx: Ctx): Ctx => {
    const newCtx = {
      ...ctx,
      yard: O.getOrElse(() => ctx.yard)(up.yard),
      babel: O.getOrElse(() => ctx.babel)(up.babel),
      pedia: O.getOrElse(() => ctx.pedia)(up.pedia),
      systrings: O.getOrElse(() => ctx.systrings)(up.systrings),
      banlists: O.getOrElse(() => ctx.banlists)(up.banlists),
    };
    if (ctx.yard === newCtx.yard) return newCtx;
    return {
      ...newCtx,
      bitNames: BitNames.load(
        newCtx.yard.api.constants.array,
        newCtx.systrings
      ),
    };
  };

// -----------------------------------------------------------------------------
// initialization
// -----------------------------------------------------------------------------

type Inits = {
  readonly config: unknown;
  readonly commands: Collection.Collection<Command.Command>;
  readonly componentInteractions: Collection.Collection<Interaction.Component>;
};

export const init = (inits: Inits) => (bot: dd.Bot) =>
  pipe(
    Decoder.parse(configDecoder)(inits.config),
    TE.fromEither,
    TE.flatMap((cfg) =>
      pipe(
        {
          babel: Babel.initBabel(),
          yard: initYard(),
          pedia: Pedia.initPedia(),
          systrings: Systrings.initSystrings(),
          banlists: Banlist.initBanlists(),
        },
        sequenceS(TE.ApplyPar),
        TE.map((up) => ({
          bot,
          componentInteractions: inits.componentInteractions,
          commands: inits.commands,
          bitNames: BitNames.load(up.yard.api.constants.array, up.systrings),
          octokit: new Octokit({ auth: cfg.github }),
          ...up,
          ...cfg,
        }))
      )
    )
  );
