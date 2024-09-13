import * as sf from '@that-hatter/scrapi-factory';
import { pipe, TE } from '@that-hatter/scrapi-factory/fp';
import * as path from 'node:path';
import { simpleGit } from 'simple-git';
import { utils } from '../lib/utils';

const GITHUB_URL = 'https://github.com/ProjectIgnis/scrapiyard.git';
const DATA_PATH = path.join(process.cwd(), 'data');
const REPO_PATH = path.join(DATA_PATH, 'scrapiyard');

const YARD_OPTIONS: sf.YardOptions = {
  ...sf.DEFAULT_OPTIONS,
  directory: path.join(REPO_PATH, 'api'),
};

const git = simpleGit();

export const updateYard = (): TE.TaskEither<string, sf.Yard> =>
  pipe(
    utils.taskify(() => git.cwd(REPO_PATH).pull()),
    TE.orElseW(() => utils.taskify(() => git.cwd(DATA_PATH).clone(GITHUB_URL))),
    TE.flatMap(() => sf.loadYard(YARD_OPTIONS)),
    TE.mapError(utils.stringify)
  );

export const initYard = () =>
  pipe(sf.loadYard(YARD_OPTIONS), TE.orElse(updateYard));
