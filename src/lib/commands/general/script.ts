import { pipe, RTE } from '@that-hatter/scrapi-factory/fp';
import { Card } from '../../../ygo';
import { Button, Command, Op, str } from '../../modules';

const showScriptButton = Button.row([
  {
    style: Button.Styles.Primary,
    label: 'Show script',
    customId: 'showScript',
  },
]);

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
          Card.scriptURL(c),
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
