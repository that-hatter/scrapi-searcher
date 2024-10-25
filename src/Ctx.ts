import type { O, RR } from '@that-hatter/scrapi-factory/fp';
import type { Command, Data, dd, Github, Interaction } from './lib/modules';
import type { BitNames } from './ygo';

export type Ctx = {
  readonly bot: dd.Bot;
  readonly commands: Command.Collection;
  readonly componentInteractions: Interaction.ComponentCollection;
  readonly github: Github.Github['rest'];
  readonly bitNames: BitNames.BitNames;
  readonly prefix: string;
  readonly dev: {
    readonly admin: string;
    readonly guild: string;
    readonly logs: string;
    readonly users: RR.ReadonlyRecord<string, string>;
  };
  readonly picsSource: O.Option<string>;
  readonly picsChannel: O.Option<bigint>;
  readonly emojis: RR.ReadonlyRecord<string, string>;
} & Data.Loaded;
