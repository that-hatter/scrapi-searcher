import { flow } from '@that-hatter/scrapi-factory/fp';
import * as buffer from 'node:buffer';
import { dd } from '.';
import { utils } from '../utils';

export const create = (name: string) =>
  flow(
    utils.stringify,
    (content): dd.FileContent => ({
      name,
      blob: new buffer.Blob([content]),
    })
  );

export const normalize = (
  file?: dd.FileContent | dd.FileContent[]
): dd.FileContent[] => {
  if (!file) return [];
  if (file instanceof Array) return file;
  return [file];
};
