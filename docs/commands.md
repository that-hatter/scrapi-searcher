# Commands

- [General Commands](#general-commands)

  - [card](#card)
  - [id](#id)
  - [rulings](#rulings)
  - [limits](#limits)
  - [search](#search)
  - [commands](#commands)
  - [help](#help)
  - [about](#about)
  - [ping](#ping)

- [Scripting Commands](#scripting-commands)

  - [cdb](#cdb)
  - [rawvals](#rawvals)
  - [script](#script)
  - [strfind](#strfind)
  - [strings](#strings)
  - [systrings](#systrings)
  - [constant](#constant)
  - [enum](#enum)
  - [function](#function)
  - [namespace](#namespace)
  - [tag](#tag)
  - [type](#type)
  - [constantval](#constantval)
  - [enumbits](#enumbits)
  - [archetype](#archetype)
  - [counter](#counter)

---

## General Commands

### card

Search cards by name. Matches can be fuzzy.

#### Parameters

| Name    | Required | Description         | Type |
| ------- | -------- | ------------------- | ---- |
| `query` | Yes      | Card name to search | text |

#### Example

```
,card Raye
```

This will search for cards with names similar to "Raye".

---

### id

Show a card's name and id (passcode) without other information.

#### Aliases

- `,password`
- `,passcode`

#### Parameters

| Name    | Required | Description         | Type |
| ------- | -------- | ------------------- | ---- |
| `query` | Yes      | Card name to search | text |

#### Example

```
,id Sky Striker Ace - Raye
```

This will display the name and id (passcode) for "Sky Striker Ace - Raye".

---

### rulings

Link to a card's ruling page(s).

#### Aliases

- `,ruling`

#### Parameters

| Name    | Required | Description         | Type |
| ------- | -------- | ------------------- | ---- |
| `query` | Yes      | Card name to search | text |

#### Example

```
,rulings Kaiser Colosseum
```

This will provide links to the ruling pages for "Kaiser Colosseum".

---

### limits

Show a card's limit status across every applicable banlist.

#### Aliases

- `,limit`

#### Parameters

| Name    | Required | Description         | Type |
| ------- | -------- | ------------------- | ---- |
| `query` | Yes      | Card name to search | text |

#### Example

```
,limits Sky Striker Ace - Raye
```

This will display the limit status of "Sky Striker Ace - Raye" across all applicable banlists.

---

### search

Search cards by name and text. Matches are case-insensitive and can be partial.

#### Aliases

- `,cardsearch`

#### Parameters

| Name    | Required | Description                        | Type |
| ------- | -------- | ---------------------------------- | ---- |
| `query` | Yes      | Search term for card name and text | text |

#### Example

```
,search zombie
```

This will search for cards with "zombie" in their name or text.

---

### commands

Show a list of commands.

#### Aliases

- `,cmds`

#### Example

```
,commands
```

This will display a list of available commands.

---

### help

Display a basic help message on how to use the bot.

#### Example

```
,help
```

This will show a help message explaining how to use the bot.

---

### about

Show information about the bot. Equivalent to mentioning it.

#### Example

```
,about
```

This will display information about the bot.

---

### ping

Ping the bot.

#### Example

```
,ping
```

This will ping the bot to check its response time.

---

## Scripting Commands

### cdb

Link to a card's database file in the BabelCDB repo.

#### Aliases

- `,db`
- `,dbfind`

#### Parameters

| Name    | Required | Description                   | Type |
| ------- | -------- | ----------------------------- | ---- |
| `query` | Yes      | Search term for the card name | text |

#### Example

```
,cdb Sky Striker Ace - Raye
```

This will provide a link to the database file for "Sky Striker Ace - Raye" in the BabelCDB repo.

---

### rawvals

Display a card's raw values from the database.

#### Aliases

- `,raws`

#### Parameters

| Name    | Required | Description                   | Type |
| ------- | -------- | ----------------------------- | ---- |
| `query` | Yes      | Search term for the card name | text |

#### Example

```
,rawvals Sky Striker Ace - Raye
```

This will display the raw database values for "Sky Striker Ace - Raye".

---

### script

Link to a card's script file in the CardScript repo.

#### Parameters

| Name    | Required | Description                   | Type |
| ------- | -------- | ----------------------------- | ---- |
| `query` | Yes      | Search term for the card name | text |

#### Example

```
,script Sky Striker Ace - Raye
```

This will provide a link to the script file for "Sky Striker Ace - Raye" in the CardScript repo.

---

### strfind

Search card database strings. Matches are case-insensitive and can be partial.

#### Parameters

| Name    | Required | Description                           | Type |
| ------- | -------- | ------------------------------------- | ---- |
| `query` | Yes      | Search term for card database strings | text |

#### Example

```
,strfind negate
```

This will search for all card database strings containing "negate".

---

### strings

Show a card's database strings.

#### Aliases

- `,strs`

#### Parameters

| Name    | Required | Description                   | Type |
| ------- | -------- | ----------------------------- | ---- |
| `query` | Yes      | Search term for the card name | text |

#### Example

```
,strings Sky Striker Ace - Raye
```

This will display the database strings for "Sky Striker Ace - Raye".

---

### constant

Search constants by name. Results are case-insensitive and can be partial matches.

#### Aliases

- `,c`
- `,const`

#### Parameters

| Name    | Required | Description                       | Type |
| ------- | -------- | --------------------------------- | ---- |
| `query` | Yes      | Search term for the constant name | text |

#### Example

```
,constant DRAW
```

This will search for all constants with "DRAW" in their name.

---

### enum

Search enums by name. Results are case-insensitive and can be partial matches.

#### Aliases

- `,e`

#### Parameters

| Name    | Required | Description                   | Type |
| ------- | -------- | ----------------------------- | ---- |
| `query` | Yes      | Search term for the enum name | text |

#### Example

```
,enum Type
```

This will search for all enums with "Type" in their name.

---

### function

Search functions by name. Results are case-insensitive and can be partial matches.

#### Aliases

- `,f`
- `,fn`
- `,func`

#### Parameters

| Name    | Required | Description                       | Type |
| ------- | -------- | --------------------------------- | ---- |
| `query` | Yes      | Search term for the function name | text |

#### Example

```
,function draw
```

This will search for all functions with "draw" in their name.

---

### namespace

Search namespaces by name. Results are case-insensitive and can be partial matches.

#### Aliases

- `,n`
- `,ns`

#### Parameters

| Name    | Required | Description                        | Type |
| ------- | -------- | ---------------------------------- | ---- |
| `query` | Yes      | Search term for the namespace name | text |

#### Example

```
,namespace card
```

This will search for all namespaces with "card" in their name.

---

### tag

Search tags by name. Results are case-insensitive and can be partial matches.

#### Parameters

| Name    | Required | Description                  | Type |
| ------- | -------- | ---------------------------- | ---- |
| `query` | Yes      | Search term for the tag name | text |

#### Example

```
,tag related
```

This will search for all tags with "related" in their name.

---

### type

Search types by name. Results are case-insensitive and can be partial matches.

#### Aliases

- `,t`

#### Parameters

| Name    | Required | Description                   | Type |
| ------- | -------- | ----------------------------- | ---- |
| `query` | Yes      | Search term for the type name | text |

#### Example

```
,type group
```

This will search for all types with "group" in their name.

---

### constantval

Search constants by value. Number values can be in decimal, hexadecimal (0x prefix), or binary (0b prefix) format.

#### Aliases

- `,cval`

#### Parameters

| Name    | Required | Description                                           | Type   |
| ------- | -------- | ----------------------------------------------------- | ------ |
| `query` | Yes      | Numeric value to search for (decimal, hex, or binary) | number |

#### Examples

```
,constantval 255            # Value in decimal
;constantval 0xFF           # Value in hexadecimal
;constantval 0b11111111     # Value in binary
```

These examples will search for constants with the value 255 (in decimal, hexadecimal, and binary representations respectively).

---

### enumbits

Show which constants in a bit enum (except Archetype) make up an integer value. If no enum name is provided, all constants for the value are displayed. The value can be in decimal, hexadecimal (0x prefix), or binary (0b prefix) format.

#### Aliases

- `,ebits`

#### Parameters

| Name        | Required | Description                                          | Type   |
| ----------- | -------- | ---------------------------------------------------- | ------ |
| `value`     | Yes      | The integer value to check (decimal, hex, or binary) | number |
| `enum-name` | No       | The optional name of the enum to filter results by   | text   |

#### Examples

```
,enumbits 3    Type     # Value in decimal
;enumbits 0x3  Type     # Value in hexadecimal
;enumbits 0b11 Type     # Value in binary
```

These examples will show which constants in the Type enum make up the value 3 (in decimal, hexadecimal, and binary representations respectively).

---

### archetype

Show which archetypes make up an integer value or search archetype strings (set names) by name. When searching by value, the input can be in decimal, hexadecimal (0x prefix), or binary (0b prefix) format. Name matches are case-insensitive and can be partial.

#### Aliases

- `,arch`
- `,set`

#### Parameters

| Name    | Required | Description                                                           | Type        |
| ------- | -------- | --------------------------------------------------------------------- | ----------- |
| `query` | Yes      | Search term or integer value (decimal, hex, or binary) for archetypes | text/number |

#### Examples

```
,archetype 7         # Value in decimal
;archetype 0x7       # Value in hexadecimal
;archetype 0b111     # Value in binary
```

These examples will show which archetypes make up the value 7 (in decimal, hexadecimal, and binary representations respectively).

```
,archetype sky striker
```

This will search for archetype strings containing "sky striker".

---

### counter

Search counters by name or value. When searching by value, the input can be in decimal, hexadecimal (0x prefix), or binary (0b prefix) format. Name matches are case-insensitive and can be partial.

#### Parameters

| Name    | Required | Description                                                    | Type        |
| ------- | -------- | -------------------------------------------------------------- | ----------- |
| `query` | Yes      | Search term or value (decimal, hex, or binary) for the counter | text/number |

#### Examples

```
,counter spell
```

This will search for counters with "spell" in their name.

```
,counter 13         # Value in decimal
;counter 0xd        # Value in hexadecimal
;counter 0b1101     # Value in binary
```

These examples will search for counters with a value of 13 (in decimal, hexadecimal, and binary representations respectively).

---

### victory

Search victory strings (alternate win conditions) by name or value. When searching by value, the input can be in decimal, hexadecimal (0x prefix), or binary (0b prefix) format. Name matches are case-insensitive and can be partial.

#### Parameters

| Name    | Required | Description                                                           | Type        |
| ------- | -------- | --------------------------------------------------------------------- | ----------- |
| `query` | Yes      | Search term or value (decimal, hex, or binary) for the victory string | text/number |

#### Example

```
,victory EXODIA
```

This will search for victory strings with "EXODIA" in their name.

```
,victory 16          # Value in decimal
;victory 0x10        # Value in hexadecimal
;victory 0b10000     # Value in binary
```

These examples will search for victory strings with a value of 16 (in decimal, hexadecimal, and binary representations respectively).

---

### systrings

Search system strings by name or value. Name matches are case-insensitive and can be partial.

#### Parameters

| Name    | Required | Description                            | Type        |
| ------- | -------- | -------------------------------------- | ----------- |
| `query` | Yes      | Search term or value for the sysstring | text/number |

#### Example

```
,systrings end
```

This will search for systrings with "end" in their description.

```
,systring 1001
```

This will search for systrings with a value of 1001.
