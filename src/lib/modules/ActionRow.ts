import { flow, RA } from '@that-hatter/scrapi-factory/fp';
import { dd } from '.';

export type Row = dd.ActionRow;

export const isRow = (c: dd.Component): c is Row =>
  c.type === dd.MessageComponentTypes.ActionRow;

export const rows = flow(RA.filter(isRow), RA.takeLeft(5));
