import { pipe, R, RTE, TE } from '@that-hatter/scrapi-factory/fp';
import { Card } from '../../../ygo';
import { URLS } from '../../constants';
import { Command, Err, Op, str } from '../../modules';

export const cdb: Command.Command = {
  name: 'cdb',
  description: "Get a link to a card's BabelCDB database file.",
  syntax: 'cdb <query>',
  aliases: ['db', 'dbfind'],
  execute: (parameters, message) =>
    pipe(
      Card.bestMatch(parameters.join(' ')),
      R.map(TE.fromOption(Err.ignore)),
      RTE.map(
        (c) =>
          str.bold(c.name) +
          '\nFound in ' +
          str.link(
            str.inlineCode(c.cdb),
            URLS.BABEL_CDB + 'blob/master/' + c.cdb
          )
      ),
      RTE.flatMap(Op.sendReply(message))
    ),
};
