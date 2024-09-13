import { interactionCreate } from './interactionCreate';
import { messageCreate } from './messageCreate';
import { messageDelete } from './messageDelete';
import { messageUpdate } from './messageUpdate';
import { ready } from './ready';

export const list = [
  interactionCreate,
  messageCreate,
  messageDelete,
  messageUpdate,
  ready,
] as const;
