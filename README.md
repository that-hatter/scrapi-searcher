<h1 align="center">scrapi-searcher</h1>
<p align="center">
  <img src="/assets/scrap-searcher-artwork.jpg" />
</p>
<p align="center">
  <strong>Utility bot for EDOPro scripting and development</strong>
</p>

Displays [scrapiyard](https://github.com/ProjectIgnis/scrapiyard) documentation and [BabelCDB](https://github.com/ProjectIgnis/BabelCDB) _Yu-Gi-Oh!_ card information on [Discord](https://discord.com/), and provides other useful commands for EDOPro-related development.

---

Searcher primarily serves as a Project Ignis devtool for scripters and developers. The project does not aim to be a general-use _Yu-Gi-Oh!_ information bot. Auxiliary data that are not relevant to EDOPro are considered non-goals. These include, but are not limited to card prices, release dates, pack information, and translations (while the simulator does support other languages, the BabelCDB repository only maintains English cdbs).

## Usage

The bot is only available in the [Project Ignis Discord server](https://discord.gg/ygopro-percy) and in direct messages. It is set to private and cannot be added to other servers. A full list of commands can be accessed using `,commands`. Cards can be searched from within messages using square brackets, e.g. `[Silhouhatte Rabbit]`.

For further inquiries, you can reach out to [@that-hatter](https://github.com/that-hatter) (or `@that.hatter` on Discord).

## Contributing

The project is written in [Typescript](https://www.typescriptlang.org/) with the [`discordeno`](https://github.com/discordeno/discordeno) Discord API library and targets [Node.js](https://nodejs.org/en/) v20. The codebase also heavily employs functional programming using [`fp-ts`](https://gcanti.github.io/fp-ts/).

### Building

```
git clone https://github.com/that-hatter/scrapi-searcher/
cd scrapi-searcher
npm i
npm run build
```

### Running

The process will expect the following environment variables:

- `BOT_PREFIX` - the prefix to use for the bot's commands.
- `BOT_TOKEN` - the bot's token.
- `DEV_ADMIN` - the Discord ID of the user to set as the bot's administrator.
- `DEV_GUILD` - the Discord ID of the guild (server) to set as the "dev server".
- `DEV_USERS` - a list of names and Discord IDs for users to set as developers. Format: `name1:ID1, name2:ID2, name3:ID3`, and so on.
- `DEV_LOGS_CHANNEL` - the Discord ID of the channel to send bot logs in.
- `GITHUB_ACCESS_TOKEN` - the token to use for Github API requests.
- `GITHUB_WEBHOOK_PORT` - the port to listen in for Github webhooks.
- `GITHUB_WEBHOOK_SECRET` - the Github webhook secret.

It's recommended to create a `.env` file containing these variables then run the bot by pointing to that file:

```
node --env-file=.env dist
```

It can also be ran via Docker, either by building the image locally or pulling [pre-built images from the registry](https://github.com/that-hatter/scrapi-searcher/pkgs/container/scrapi-searcher).

## Acknowledgments

- **Lilac** (Satellaa), for thoroughly testing the bot before public release and writing the [documentation for the commands](https://github.com/that-hatter/scrapi-searcher/blob/master/docs/commands.md).
- **DyXel** and **edo9300**, for helping with the bot's hosting and deployment setup, as well as other early feedback and suggestions.
- **AlphaKretin**, for their work on [old Bastion](https://github.com/AlphaKretin/bastion-bot). A good portion of Searcher's initial functionality are reimplementations of old Bastion commands. The initial versions of the [card search shortcuts](https://github.com/that-hatter/scrapi-searcher/blob/master/data/shortcuts.json) and scrapiyard entries were also generated from old Bastion's data files.
- **oldfishstick**, **Risk**, and **JustPassingThru** for additional pre-release testing and feedback.
- The rest of the Project Ignis staff and outside contributors helping out in the `scrapi` group of projects (including Lilac, oldfishstick, and Risk).
