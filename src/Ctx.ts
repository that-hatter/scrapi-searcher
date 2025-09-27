import type { O, RR } from '@that-hatter/scrapi-factory/fp';
import type { Command, Github, Interaction, Resource, dd } from './lib/modules';
import type { BitNames } from './ygo';

export type CtxWithoutResources = {
  readonly bot: dd.Bot;
  readonly commands: Command.Collection;
  readonly componentInteractions: Interaction.ComponentCollection;
  readonly github: Github.Github['rest'];
  readonly prefix: string;
  readonly dev: {
    readonly admin: string;
    readonly guild: string;
    readonly logs: string;
    readonly users: RR.ReadonlyRecord<string, string>;
  };
  readonly emojis: RR.ReadonlyRecord<string, string>;
  readonly gitRef: O.Option<string>;

  readonly sources: {
    readonly yard: Github.Source;
    readonly babel: Github.Source;
    readonly scripts: Github.Source;
    readonly core: Github.Source;
    readonly banlists: O.Option<Github.Source>;
    readonly delta: O.Option<Github.Source>;
    readonly distribution: O.Option<Github.Source>;
    readonly greenlight: O.Option<Github.Source>;
    readonly misc: O.Option<{
      readonly repo: Github.Source;
      readonly pics: O.Option<{
        readonly url: string;
        readonly channel: bigint;
      }>;
    }>;
  };
};

export type Ctx = {
  readonly bitNames: BitNames.BitNames;
} & CtxWithoutResources &
  Resource.Loaded;
