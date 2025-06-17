import { pipe, R, RTE, TE } from '@that-hatter/scrapi-factory/fp';
import { Babel, Card, Scripts } from '../../../ygo';
import { Button, Command, Err, Op, str } from '../../modules';

const showScriptButton = Button.row([
  {
    style: Button.Styles.Primary,
    label: 'Show script',
    customId: 'showScript',
  },
]);

const noScriptError = (c: Babel.Card) =>
  Err.forUser(
    'There is no script for ' +
      str.bold(c.name) +
      ' ' +
      str.parenthesized(str.inlineCode(c.id.toString()))
  );

export const script: Command.Command = {
  name: 'script',
  description: "Get a link to a card's script in the CardScript repo.",
  syntax: 'script <query>',
  aliases: [],
  execute: (parameters, message) =>
    pipe(
      Card.bestMatch(parameters.join(' ')),
      RTE.flatMap((c) =>
        pipe(
          Scripts.getUrl(c.id),
          R.map(TE.fromOption(() => noScriptError(c))),
          RTE.map(str.clamped('<', '>')),
          RTE.map(str.prepend(str.bold(c.name) + '\n'))
        )
      ),
      RTE.flatMap((content) =>
        Op.sendReply(message)({
          content,
          components: [showScriptButton],
        })
      )
    ),
};
