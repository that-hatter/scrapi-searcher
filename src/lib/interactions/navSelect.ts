import { pipe, RA, RTE } from '@that-hatter/scrapi-factory/fp';
import { Err, Menu, Nav } from '../modules';

export const navSelect = Menu.interaction({
  name: 'navSelect',
  execute: (_, interaction, [name]) =>
    Nav.apply(interaction, (nav) =>
      pipe(
        RTE.Do,
        RTE.bind('item', () =>
          pipe(
            nav.items,
            RA.findFirst((t) => nav.itemName(t) === name),
            RTE.fromOption(() => Err.forDev('Could not find item: ' + name))
          )
        ),
        RTE.bind('embed', ({ item }) =>
          pipe(
            nav.itemEmbed ? nav.itemEmbed(item) : RTE.right(undefined),
            RTE.mapError(Err.forDev)
          )
        ),
        RTE.bind('comps', ({ item }) =>
          pipe(
            nav.itemComponents
              ? nav.itemComponents(item)
              : RTE.right(undefined),
            RTE.mapError(Err.forDev)
          )
        ),
        RTE.flatMap(({ item, comps, embed }) =>
          Nav.updateDisplay(embed, comps, nav.itemName(item))(interaction)
        )
      )
    ),
});
