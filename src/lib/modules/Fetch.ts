import fetch from 'node-fetch';
import { utils } from '../utils';

export const raw = (url: string) => utils.taskify(() => fetch(url));

const then =
  <T>(fn: (resp: fetch.Response) => Promise<T>) =>
  (url: string) =>
    utils.taskify(() => fetch(url).then(fn));

export const json = then((resp) => resp.json());

export const text = then((resp) => resp.text());

export const buffer = then((resp) => resp.buffer());

export const arrayBuffer = then((resp) => resp.arrayBuffer());
