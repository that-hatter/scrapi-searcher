# Hosting

> [!NOTE]
> This guide assumes you already have a Discord Application set up.

The bot can be ran directly with Node.js or using Docker.

You'll first have to either build the program following the instructions [here](./README/#building), or, if you plan to use Docker, pull one of the images hosted [here](https://github.com/that-hatter/scrapi-searcher/pkgs/container/scrapi-searcher). The following command pulls the latest image:

```
docker pull ghcr.io/that-hatter/scrapi-searcher:master
```

## Environment variables

The program expects the following environment variables to run:

- `BOT_PREFIX`
  The prefix to use for the bot's commands.
- `BOT_TOKEN`
  The bot's token.
- `DEV_ADMIN`
  The Discord ID of the user to set as the bot's administrator.
- `DEV_GUILD`
  The Discord ID of the guild (server) to set as the "dev server".
  Developer commands can be by any user in any channel inside this server.
- `DEV_USERS`
  A list of names and Discord IDs for users to set as developers.
  These users can use developer commands even outside the developer server (except direct messages).
  **Format:** A user should have a name followed by a colon (`:`) then their Discord ID, and each entry can be separated by a comma (`,`).

  > `name1:ID1, name2:ID2, name3:ID3, ...`

- `DEV_LOGS_CHANNEL`
  The Discord ID of the channel to send bot logs in.
  **Make sure the bot has access to this channel.**

- `GITHUB_ACCESS_TOKEN`
  The token to use for Github API requests.

- `GITHUB_WEBHOOK_PORT`
  The port to listen in for Github webhooks, which is used for auto-updates.

- `GITHUB_WEBHOOK_SECRET`
  The Github webhook secret.

- `REPO_YARD`
  The repository for API documentation, expected to have the same file and folder structure as [`ProjectIgnis/scrapiyard`](https://github.com/ProjectIgnis/scrapiyard/).

  > `owner/repo branch`, where `branch` is optional and defaults to `master`

- `REPO_BASE`
  The repository for the base client resources (i.e., the resources available on initial download), expected to have the same file and folder structure as [`ProjectIgnis/Distribution`](https://github.com/ProjectIgnis/Distribution/).

  > `owner/repo branch`, where `branch` is optional and defaults to `master`

- `REPO_EXPANSIONS`
  _(Optional)_
  Additional repositories for client resources, such as the ones used for live updates.
  Each repository is expected to have the same file and folder structure as [`ProjectIgnis/DeltaBagooska`](https://github.com/ProjectIgnis/DeltaBagooska/).

  > `owner1/repo1 branch1, owner2/repo2 branch2, owner3/repo3 branch3, ...`
  > where each `branch_` is optional and defaults to `master`

- `REPO_BANLISTS`
  _(Optional)_
  The repository containing banlist files.
  Any file inside the repository with the `.lflist.conf` extension will be read.

  > `owner/repo branch`, where `branch` is optional and defaults to `master`

- `REPO_MISC`
  _(Optional)_
  The repository containing miscellaneous card data, expected to have a `/data/` folder with the same file structure as the one in [`that-hatter/scrapi-searcher-data`](https://github.com/that-hatter/scrapi-searcher-data/).

  > `owner/repo branch`, where `branch` is optional and defaults to `master`

- `REPO_GREENLIGHT`
  _(Optional)_
  The repository containing unreleased cards and issues for coordinating scripters.
  This is mainly used internally by the Project Ignis staff.

  > `owner/repo branch`, where `branch` is optional and defaults to `master`

- `REPO_CDB_LINK`
  _(Optional)_
  The repository to use when linking to cdbs, expected to have the same file and folder structure as [`ProjectIgnis/BabelCDB`](https://github.com/ProjectIgnis/BabelCDB/).
  The bot will **not** read cdbs from this repository; it is only used for linking.

  > `owner/repo branch`, where `branch` is optional and defaults to `master`

- `REPO_SCRIPT_LINK`
  _(Optional)_
  The repository to use when linking to scripts, expected to have the same file and folder structure as [`ProjectIgnis/CardScripts`](https://github.com/ProjectIgnis/CardScripts/).
  The bot will **not** read cdbs from this repository; it is only used for linking.

  > `owner/repo branch`, where `branch` is optional and defaults to `master`

- `PICS_DEFAULT_SOURCE`
  _(Optional)_
  The URL to to use when linking to a card image.
  It can have a placeholder `%id%` which will be replaced with each card's ID.

  > `https://example/%id%.jpg`

- `PICS_REUPLOAD_CHANNEL`
  _(Optional)_
  The Discord ID of the channel to reupload card pics to.
  The bot has a feature that reuploads images to a Discord channel and will link to the reuploaded image going forward.
  This is used to hide the image provider's URL and minimize downloads from it.
  If this option is not provided, the bot will directly link to the URL provided in `PICS_DEFAULT_SOURCE`.
  **Make sure the bot has access to this channel.**

It is recommended to create a `.env` file containing these variables then run the bot by pointing to that file.

Using Node:

```
node --env-file=.env dist
```

Using Docker:

```
docker run -d --env-file=.env NAME_OF_IMAGE
```

If you pulled the latest image provided in , `NAME_OF_IMAGE` would be `ghcr.io/that-hatter/scrapi-searcher:master`.

## Emojis

The bot uses custom emojis for certain visuals such as attribute and monster type icons. These need to be uploaded per bot account (in your Discord Application's settings).

You can find all the emojis used by the bot in [this folder](/assets/emojis).
