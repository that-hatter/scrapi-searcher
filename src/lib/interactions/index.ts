import { pipe } from '@that-hatter/scrapi-factory/fp';
import { Collection } from '../modules';

import { cardSelect } from './cardSelect';
import { rawvalMode } from './rawValMode';

import { signature } from './signature';

import { navPageSwitch } from './navPageSwitch';
import { navSelect } from './navSelect';

import { glCardClaim } from './glCardClaim';
import { glCardStage } from './glCardStage';
import { glCardUnstage } from './glCardUnstage';
import { glFinishStage } from './glFinishStage';
import { glIssueSelect } from './glIssueSelect';
import { glPackSelect } from './glPackSelect';
import { glStatusSelect } from './glStatusSelect';
import { glThemeSelect } from './glThemeSelect';

import { update } from './update';

const list = [
  cardSelect,
  rawvalMode,

  signature,

  navPageSwitch,
  navSelect,

  glCardClaim,
  glFinishStage,
  glIssueSelect,
  glPackSelect,
  glThemeSelect,
  glCardStage,
  glCardUnstage,
  glStatusSelect,

  update,
] as const;

export const collection = pipe(
  list,
  Collection.fromList((ix) => ix.name)
);
