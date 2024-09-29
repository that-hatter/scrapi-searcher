import { pipe } from '@that-hatter/scrapi-factory/fp';
import { Collection } from '../modules';

import { card } from './general/card';
import { cdb } from './general/cdb';
import { id } from './general/id';
import { limits } from './general/limits';
import { rawvals } from './general/rawvals';
import { rulings } from './general/rulings';
import { script } from './general/script';
import { search } from './general/search';
import { strfind } from './general/strfind';
import { strings } from './general/strings';

import { cmd as constant } from '../../yard/Constant';
import { cmd as enum_ } from '../../yard/Enum';
import { cmd as func } from '../../yard/Function';
import { cmd as namespace } from '../../yard/Namespace';
import { cmd as tag } from '../../yard/Tag';
import { cmd as type_ } from '../../yard/Type';
import { constantval } from './general/constantval';
import { enumbits } from './general/enumbits';
import { progress } from './general/progress';

import { archetype } from './general/archetype';
import { counter } from './general/counter';
import { systrings } from './general/systrings';
import { victory } from './general/victory';

import { about } from './general/about';
import { commands } from './general/commands';
import { help } from './general/help';
import { ping } from './general/ping';

import { claim } from './dev/claim';
import { stage } from './dev/stage';

import { update } from './dev/update';

const list = [
  card,
  cdb,
  id,
  limits,
  rawvals,
  rulings,
  script,
  search,
  strfind,
  strings,

  constant,
  enum_,
  func,
  namespace,
  tag,
  type_,
  constantval,
  enumbits,
  progress,

  archetype,
  counter,
  systrings,
  victory,

  about,
  commands,
  help,
  ping,

  claim,
  stage,

  update,
];

export const collection = pipe(
  list,
  Collection.fromList((cmd) => [cmd.name, ...cmd.aliases])
);
