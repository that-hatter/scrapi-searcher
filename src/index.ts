import { E, pipe, RA, TE } from '@that-hatter/scrapi-factory/fp';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { collection as commands } from './lib/commands';
import { PATHS } from './lib/constants';
import { list as events } from './lib/events';
import { collection as componentInteractions } from './lib/interactions';
import { Data, dd, Decoder, Err, Event, Github, Op } from './lib/modules';
import { utils } from './lib/utils';
import { BitNames } from './ygo';

const CONFIG_PATH = path.join(PATHS.CWD, 'config.json');

const configDecoder = Decoder.struct({
  dev: Decoder.struct({
    admin: Decoder.string,
    guild: Decoder.string,
    logs: Decoder.string,
    users: Decoder.record(Decoder.string),
  }),
  prefix: Decoder.string,
  github: Github.configDecoder,
  token: Decoder.string,
});

const program = pipe(
  TE.Do,
  TE.bind('config', () =>
    pipe(
      utils.taskify(() => fs.readFile(CONFIG_PATH, 'utf-8')),
      TE.flatMapIOEither((s) => utils.fallibleIO(() => JSON.parse(s))),
      TE.flatMapEither(Decoder.parse(configDecoder))
    )
  ),
  TE.bind('github', ({ config }) => Github.init(config.github)),
  TE.bind('data', () => Data.init),
  TE.flatMap(({ config, github, data }) => {
    const bot = dd.createBot({
      intents:
        dd.GatewayIntents.Guilds |
        dd.GatewayIntents.GuildMessages |
        dd.GatewayIntents.MessageContent |
        dd.GatewayIntents.DirectMessages,
      token: config.token,
    });

    const ctx = {
      bot,
      prefix: config.prefix,
      dev: config.dev,
      commands,
      componentInteractions,
      bitNames: BitNames.load(data.yard.api.constants.array, data.systrings),
      github: github.rest,
      ...data,
    };

    const runHandler = async (handler: Op.Op<unknown>) => {
      const res = await handler(ctx)();
      if (E.isLeft(res)) return Err.sendAlerts(res.left)(ctx)();

      if (!Data.isUpdate(res.right)) return;
      const update = res.right;
      ctx.babel = update.babel ?? ctx.babel;
      ctx.yard = update.yard ?? ctx.yard;
      ctx.systrings = update.systrings ?? ctx.systrings;
      ctx.banlists = update.banlists ?? ctx.banlists;
      ctx.betaIds = update.betaIds ?? ctx.betaIds;
      ctx.konamiIds = update.konamiIds ?? ctx.konamiIds;
      ctx.shortcuts = update.shortcuts ?? ctx.shortcuts;

      if (!update.yard && !update.systrings) return;
      ctx.bitNames = BitNames.load(ctx.yard.api.constants.array, ctx.systrings);
    };

    const toDiscordHandler = <K extends keyof dd.EventHandlers>(
      event: Event.Event<K>
    ): Partial<dd.EventHandlers> => ({
      [event.name]: (...params: Parameters<dd.EventHandlers[K]>) =>
        runHandler(event.handle(...params)),
    });

    bot.events = events.reduce(
      (acc, ev) => ({ ...acc, ...toDiscordHandler(ev) }),
      bot.events
    );

    github.webhook.on('push', ({ payload }) => {
      if (payload.ref !== 'refs/heads/master') return;
      pipe(
        payload.commits,
        RA.flatMap((c) => [...c.added, ...c.modified, ...c.removed]),
        (files) =>
          Data.autoUpdate(payload.compare, payload.repository.name, files),
        runHandler
      );
    });

    process.on('SIGINT', () => {
      github.webhookServer.close();
      process.exit(1);
    });

    return utils.taskify(() => {
      console.log('Starting bot...');
      return dd.startBot(bot);
    });
  }),
  TE.mapError(utils.tapLog)
);

void program();
