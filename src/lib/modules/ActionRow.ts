import { flow, RA } from '@that-hatter/scrapi-factory/fp';
import { dd } from '.';

export const MessageComponentType: dd.MessageComponentTypes.ActionRow = 1;

export type Row = dd.ActionRow;

export const isRow = (c: dd.Component): c is Row =>
  c.type === MessageComponentType;

export const rows = flow(RA.filter(isRow), RA.takeLeft(5));
