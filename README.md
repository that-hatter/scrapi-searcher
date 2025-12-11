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

The project is written in [Typescript](https://www.typescriptlang.org/) with the [`discordeno`](https://github.com/discordeno/discordeno) Discord API library and targets [Node.js](https://nodejs.org/en/) v24. The codebase also heavily employs functional programming using [`fp-ts`](https://gcanti.github.io/fp-ts/).

### Building

After cloning the repo, you can either build directly with NPM, to be ran as Node.js program:

```
npm i
npm run build
```

Or build an image to be ran via Docker (recommended):

```
docker build -t NAME_OF_IMAGE .
```

To host the bot, refer to this [guide](./docs/hosting.md).

## Acknowledgments

- **Lilac** (Satellaa), for thoroughly testing the bot before public release and writing the [documentation for the commands](https://github.com/that-hatter/scrapi-searcher/blob/master/docs/commands.md).
- **DyXel** and **edo9300**, for helping with the bot's hosting and deployment setup, as well as other early feedback and suggestions.
- **AlphaKretin**, for their work on [old Bastion](https://github.com/AlphaKretin/bastion-bot). A good portion of Searcher's initial functionality are reimplementations of old Bastion commands. The initial versions of the [card search shortcuts](https://github.com/that-hatter/scrapi-searcher-data/blob/master/data/shortcuts.json) and scrapiyard entries were also generated from old Bastion's data files.
- **oldfishstick**, **Risk**, and **JustPassingThru** for additional pre-release testing and feedback.
- The rest of the Project Ignis staff and outside contributors helping out in the `scrapi` group of projects (including Lilac, oldfishstick, and Risk).
