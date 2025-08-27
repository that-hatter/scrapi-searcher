import * as Decoder from './Decoder';

import { string } from '@that-hatter/scrapi-factory/fp';
import * as str_ from './str';
export const str = { ...string, ...str_ };

export * as Github from './Github';

export type * as dd from './Discord';

export * as ActionRow from './ActionRow';
export * as Attachment from './Attachment';
export * as Button from './Button';
export * as Cache from './Cache';
export * as Collection from './Collection';
export * as Command from './Command';
export * as Err from './Err';
export * as Event from './Event';
export * as Interaction from './Interaction';

export * as Menu from './Menu';
export * as Nav from './Nav';
export * as Op from './Operation';
export * as SearchCommand from './SearchCommand';

export * as Resource from './Resource';

export { Decoder };
