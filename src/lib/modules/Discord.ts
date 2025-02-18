export type * from '@discordeno/bot' with { "resolution-mode": "import" };

import type * as dd from '@discordeno/bot' with { "resolution-mode": "import" };

export type DesiredProperties = dd.CompleteDesiredProperties<{}, true>;

export type EventHandlers = dd.EventHandlers<
  DesiredProperties,
  dd.DesiredPropertiesBehavior.RemoveKey
>;

export type Interaction = dd.SetupDesiredProps<
  dd.Interaction,
  DesiredProperties
>;

export type Bot = dd.Bot<DesiredProperties>;
