import { flow, O, pipe, RA, RNEA, TE } from '@that-hatter/scrapi-factory/fp';
import { Predicate } from 'fp-ts/lib/Predicate';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { str } from '.';
import { utils } from '../utils';

// TODO: move all path and fs-related operations to this file

export const getAllFilepaths = (
  dir: string
): TE.TaskEither<string, ReadonlyArray<string>> =>
  pipe(
    utils.taskify(() =>
      fs.readdir(dir, { withFileTypes: true, recursive: true })
    ),
    TE.map(
      RA.filterMap((f) =>
        f.isDirectory() ? O.none : O.some(path.join(f.path, f.name))
      )
    )
  );

export const getMatchingFilepaths = (fn: Predicate<string>) =>
  flow(getAllFilepaths, TE.map(RA.filter(fn)));

export const getFilepathsWithExt = flow(str.endsWith, getMatchingFilepaths);

export const joinPath = (components: ReadonlyArray<string>) =>
  path.join(...components);

export const normalizePath = path.normalize;

export const splitFilepath = flow(
  normalizePath,
  str.split(path.sep),
  RA.filter((s) => s.length > 0)
);

export const filenameFromPath = flow(splitFilepath, RA.last);

export const removeExt = flow(str.split('.'), RNEA.init, str.join('.'));

export const readFile = (path: string) =>
  utils.taskify(() => fs.readFile(path));

export const readTextFile = flow(
  readFile,
  TE.map((buf) => buf.toString())
);

export const readJsonFile = flow(readTextFile, TE.map(JSON.parse));
