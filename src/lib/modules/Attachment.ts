import * as buffer from 'node:buffer';
import { dd } from '.';

export const text =
  (name: string) =>
  (content: string): dd.FileContent => ({
    name,
    blob: new buffer.Blob([content]),
  });

export const normalize = (
  file?: dd.FileContent | dd.FileContent[]
): dd.FileContent[] => {
  if (!file) return [];
  if (file instanceof Array) return file;
  return [file];
};
