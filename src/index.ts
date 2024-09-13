import { pipe, TE } from '@that-hatter/scrapi-factory/fp';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { collection as commands } from './lib/commands';
import { list as events } from './lib/events';
import { collection as componentInteractions } from './lib/interactions';
import { Ctx, dd, Decoder, Event } from './lib/modules';
import { utils } from './lib/utils';

const CONFIG_PATH = path.join(process.cwd(), 'config.json');
const intents =
  dd.GatewayIntents.Guilds |
  dd.GatewayIntents.GuildMessages |
  dd.GatewayIntents.MessageContent |
  dd.GatewayIntents.DirectMessages;

const program = pipe(
  utils.taskify(() => fs.readFile(CONFIG_PATH, 'utf-8')),
  TE.map(JSON.parse),
  TE.flatMapEither(Decoder.parse(Ctx.configDecoder)),
  TE.flatMap((config) =>
    pipe(
      dd.createBot({ intents, token: config.token }),
      Ctx.init({ config, commands, componentInteractions })
    )
  ),
  TE.flatMap((ctx) =>
    utils.taskify(() => {
      const handlers = Event.asHandlers(events, ctx);
      ctx.bot.events = { ...ctx.bot.events, ...handlers };
      return dd.startBot(ctx.bot);
    })
  ),
  TE.mapError(utils.tapLog)
);

console.log('Starting bot...');
void program();
