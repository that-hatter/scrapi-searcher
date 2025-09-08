import { E, O, pipe, RA, RNEA, RR, TE } from '@that-hatter/scrapi-factory/fp';
import { collection as commands } from './lib/commands';
import { list as events } from './lib/events';
import { collection as componentInteractions } from './lib/interactions';
import {
  dd,
  Decoder,
  Err,
  Event,
  Github,
  Op,
  Resource,
  str,
} from './lib/modules';
import { utils } from './lib/utils';
import { BitNames } from './ygo';

const envDecoder = pipe(
  Decoder.struct({
    DEV_ADMIN: Decoder.string,
    DEV_GUILD: Decoder.string,
    DEV_USERS: Decoder.string,
    DEV_LOGS_CHANNEL: Decoder.string,

    BOT_PREFIX: Decoder.string,
    BOT_TOKEN: Decoder.string,

    GITHUB_ACCESS_TOKEN: Decoder.string,
    GITHUB_WEBHOOK_PORT: Decoder.numString,
    GITHUB_WEBHOOK_SECRET: Decoder.string,

    REPO_YARD: Github.sourceDecoder,
    REPO_BABEL: Github.sourceDecoder,
    REPO_SCRIPTS: Github.sourceDecoder,
    REPO_CORE: Github.sourceDecoder,
    REPO_BANLISTS: Github.sourceDecoder,
    REPO_DELTA: Github.sourceDecoder,
    REPO_DISTRIBUTION: Github.sourceDecoder,
  }),
  Decoder.intersect(
    Decoder.partial({
      REPO_MISC: Github.sourceDecoder,

      PICS_DEFAULT_SOURCE: Decoder.string,
      PICS_UPLOAD_CHANNEL: Decoder.bigintString,

      GIT_REF: Decoder.string,
    })
  ),
  Decoder.parse((env) => {
    const error = (msg: string) => Decoder.failure(env, msg);

    if (!!env.PICS_DEFAULT_SOURCE !== !!env.PICS_UPLOAD_CHANNEL) {
      return error(
        'PICS_DEFAULT_SOURCE and PICS_UPLOAD_CHANNEL must be provided together'
      );
    }

    if (env.PICS_DEFAULT_SOURCE && !env.REPO_MISC) {
      return error(
        'REPO_MISC must be provided if PICS_DEFAULT_SOURCE and PICS_UPLOAD_CHANNEL are provided'
      );
    }
    return Decoder.success(env);
  })
);

const program = pipe(
  TE.Do,
  TE.bind('env', () =>
    pipe(process.env, Decoder.decode(envDecoder), TE.fromEither)
  ),
  TE.bind('github', ({ env }) =>
    Github.init(
      env.GITHUB_ACCESS_TOKEN,
      env.GITHUB_WEBHOOK_PORT,
      env.GITHUB_WEBHOOK_SECRET
    )
  ),
  TE.bind('dd', () => utils.taskify(() => import('@discordeno/bot'))),
  TE.let('bot', ({ dd, env }) =>
    dd.createBot({
      intents:
        dd.GatewayIntents.Guilds |
        dd.GatewayIntents.GuildMessages |
        dd.GatewayIntents.MessageContent |
        dd.GatewayIntents.DirectMessages,
      token: env.BOT_TOKEN,
      desiredPropertiesBehavior: dd.DesiredPropertiesBehavior.RemoveKey,
      desiredProperties: dd.createDesiredPropertiesObject({}, true),
    })
  ),
  TE.bind('emojis', ({ bot }) => Op.getAppEmojis(bot)),
  TE.map(({ bot, emojis, env, github }) => ({
    bot,

    prefix: env.BOT_PREFIX,
    dev: {
      admin: env.DEV_ADMIN,
      guild: env.DEV_GUILD,
      users: pipe(
        env.DEV_USERS,
        str.split(', '),
        RNEA.map(str.split(':')),
        RNEA.map(([name, id]) => [String(id), name] as const),
        RR.fromEntries
      ),
      logs: env.DEV_LOGS_CHANNEL,
    },

    commands,
    componentInteractions,

    gitRef: O.fromNullable(env.GIT_REF),
    github: github.rest,
    webhook: github.webhook,
    webhookServer: github.webhookServer,

    sources: {
      yard: env.REPO_YARD,
      babel: env.REPO_BABEL,
      scripts: env.REPO_SCRIPTS,
      core: env.REPO_CORE,
      banlists: env.REPO_BANLISTS,
      delta: env.REPO_DELTA,
      distribution: env.REPO_DISTRIBUTION,
      misc: env.REPO_MISC
        ? O.some({
            repo: env.REPO_MISC,
            pics:
              env.PICS_DEFAULT_SOURCE && env.PICS_UPLOAD_CHANNEL
                ? O.some({
                    url: env.PICS_DEFAULT_SOURCE,
                    channel: env.PICS_UPLOAD_CHANNEL,
                  })
                : O.none,
          })
        : O.none,
    },

    emojis: pipe(
      emojis,
      RA.filterMap(({ id, name }) => {
        if (!id || !name) return O.none;
        return O.some([name, `<:${name}:${id}>`] as const);
      }),
      RR.fromEntries
    ),
  })),
  TE.flatMap((preCtx) =>
    pipe(
      preCtx,
      Resource.init,
      TE.map((data) => ({ ...preCtx, ...data }))
    )
  ),
  TE.flatMap((preCtx) => {
    // TODO: clean up unused properties such (webhook, webhookServer)
    const ctx = {
      ...preCtx,
      bitNames: BitNames.load(
        preCtx.yard.api.constants.array,
        preCtx.systrings
      ),
    };

    const runHandler = async (handler: Op.Op<unknown>) => {
      const res = await handler(ctx)();
      if (E.isLeft(res)) return Err.sendAlerts(res.left)(ctx)();

      if (!Resource.isUpdate(res.right)) return;
      const update = res.right;
      ctx.babel = update.babel ?? ctx.babel;
      ctx.yard = update.yard ?? ctx.yard;
      ctx.systrings = update.systrings ?? ctx.systrings;
      ctx.banlists = update.banlists ?? ctx.banlists;
      ctx.betaIds = update.betaIds ?? ctx.betaIds;
      ctx.konamiIds = update.konamiIds ?? ctx.konamiIds;
      ctx.shortcuts = update.shortcuts ?? ctx.shortcuts;
      ctx.pics = update.pics ?? ctx.pics;
      ctx.scripts = update.scripts ?? ctx.scripts;

      if (!update.yard && !update.systrings) return;
      ctx.bitNames = BitNames.load(ctx.yard.api.constants.array, ctx.systrings);
    };

    const toDiscordHandler = <K extends keyof dd.EventHandlers>(
      event: Event.Event<K>
    ): Partial<dd.EventHandlers> => ({
      [event.name]: (...params: Parameters<dd.EventHandlers[K]>) =>
        runHandler(event.handle(...params)),
    });

    ctx.bot.events = events.reduce(
      (acc, ev) => ({ ...acc, ...toDiscordHandler(ev) }),
      ctx.bot.events
    );

    preCtx.webhook.on('push', ({ payload }) => {
      const { ref, commits } = payload;
      if (commits.length === 1 && commits[0]?.message.startsWith('[auto] '))
        return;

      const source: Github.Source = {
        owner: payload.repository.owner?.name ?? '',
        repo: payload.repository.name,
        branch: pipe(ref, str.split('/'), RNEA.last),
      };

      pipe(
        commits,
        RA.flatMap((c) => [
          ...(c.added ?? []),
          ...(c.modified ?? []),
          ...(c.removed ?? []),
        ]),
        (files) => Resource.autoUpdate(payload.compare, source, files),
        runHandler
      );
    });

    process.on('SIGINT', () => {
      preCtx.webhookServer.close();
      process.exit(1);
    });

    return utils.taskify(() => {
      console.log('Starting bot...');
      return ctx.bot.start();
    });
  }),
  TE.mapError(utils.tapLog)
);

void program();
