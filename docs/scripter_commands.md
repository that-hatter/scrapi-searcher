# Scripter Commands Documentation

## Table of Contents
1. [Commands](#commands)
   - [cdb](#cdb)
   - [rawvals](#rawvals)
   - [script](#script)
   - [strfind](#strfind)
   - [strings](#strings)
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

## Commands

### cdb

Link to a card's database file in the BabelCDB repo.

#### Aliases
- `;db`
- `;dbfind`

#### Parameters

| Name    | Required | Description                   | Type |
|---------|----------|-------------------------------|------|
| `query` | Yes      | Search term for the card name | text |

#### Example
```
;cdb Sky Striker Ace - Raye
```
This will provide a link to the database file for "Sky Striker Ace - Raye" in the BabelCDB repo.

---

### rawvals

Display a card's raw values from the database.

#### Aliases
- `;raws`

#### Parameters

| Name    | Required | Description                   | Type |
|---------|----------|-------------------------------|------|
| `query` | Yes      | Search term for the card name | text |

#### Example
```
;rawvals Sky Striker Ace - Raye
```
This will display the raw database values for "Sky Striker Ace - Raye".

---

### script

Link to a card's script file in the CardScript repo.

#### Aliases
- None

#### Parameters

| Name    | Required | Description                   | Type |
|---------|----------|-------------------------------|------|
| `query` | Yes      | Search term for the card name | text |

#### Example
```
;script Sky Striker Ace - Raye
```
This will provide a link to the script file for "Sky Striker Ace - Raye" in the CardScript repo.

---

### strfind

Search card database strings. Matches are case-insensitive and can be partial.

#### Aliases
- None

#### Parameters

| Name    | Required | Description                             | Type |
|---------|----------|-----------------------------------------|------|
| `query` | Yes      | Search term for card database strings   | text |

#### Example
```
;strfind negate
```
This will search for all card database strings containing "negate".

---

### strings

Show a card's database strings.

#### Aliases
- `;strs`

#### Parameters

| Name    | Required | Description                   | Type |
|---------|----------|-------------------------------|------|
| `query` | Yes      | Search term for the card name | text |

#### Example
```
;strings Sky Striker Ace - Raye
```
This will display the database strings for "Sky Striker Ace - Raye".

### constant

Search constants by name. Results are case-insensitive and can be partial matches.

#### Aliases
- `;c`
- `;const`

#### Parameters

| Name    | Required | Description                        | Type |
|---------|----------|------------------------------------|------|
| `query` | Yes      | Search term for the constant name  | text |

#### Example
```
;constant DRAW
```
This will search for all constants with "DRAW" in their name.

---

### enum

Search enums by name. Results are case-insensitive and can be partial matches.

#### Aliases
- `;e`

#### Parameters

| Name    | Required | Description                   | Type |
|---------|----------|-------------------------------|------|
| `query` | Yes      | Search term for the enum name | text |

#### Example
```
;enum Type
```
This will search for all enums with "Type" in their name.

---

### function

Search functions by name. Results are case-insensitive and can be partial matches.

#### Aliases
- `;f`
- `;fn`
- `;func`

#### Parameters

| Name    | Required | Description                       | Type |
|---------|----------|-----------------------------------|------|
| `query` | Yes      | Search term for the function name | text |

#### Example
```
;function draw
```
This will search for all functions with "draw" in their name.

---

### namespace

Search namespaces by name. Results are case-insensitive and can be partial matches.

#### Aliases
- `;n`
- `;ns`

#### Parameters

| Name    | Required | Description                        | Type |
|---------|----------|------------------------------------|------|
| `query` | Yes      | Search term for the namespace name | text |

#### Example
```
;namespace card
```
This will search for all namespaces with "card" in their name.

---

### tag

Search tags by name. Results are case-insensitive and can be partial matches.

#### Parameters

| Name    | Required | Description                   | Type |
|---------|----------|-------------------------------|------|
| `query` | Yes      | Search term for the tag name  | text |

#### Example
```
;tag related
```
This will search for all tags with "related" in their name.

---

### type

Search types by name. Results are case-insensitive and can be partial matches.

#### Aliases
- `;t`

#### Parameters

| Name    | Required | Description                   | Type |
|---------|----------|-------------------------------|------|
| `query` | Yes      | Search term for the type name | text |

#### Example
```
;type group
```
This will search for all types with "group" in their name.

---

### constantval

Search constants by value. Number values can be in decimal, hexadecimal (0x prefix), or binary (0b prefix) format.

#### Aliases
- `;cval`

#### Parameters

| Name    | Required | Description                                           | Type   |
|---------|----------|-------------------------------------------------------|--------|
| `query` | Yes      | Numeric value to search for (decimal, hex, or binary) | number |

#### Examples
```
;constantval 255        # Decimal
;constantval 0xFF       # Hexadecimal
;constantval 0b11111111 # Binary
```
These examples will search for constants with the value 255 (in decimal, hexadecimal, and binary representations respectively).

---

### enumbits

Show which constants in a bit enum (except Archetype) make up an integer value. If no enum name is provided, all constants for the value are displayed. The value can be in decimal, hexadecimal (0x prefix), or binary (0b prefix) format.

#### Aliases
- `;ebits`

#### Parameters

| Name        | Required | Description                                          | Type   |
|-------------|----------|------------------------------------------------------|--------|
| `value`     | Yes      | The integer value to check (decimal, hex, or binary) | number |
| `enum-name` | No       | The optional name of the enum to filter results by   | text   |

#### Examples
```
;enumbits 3    Type # Decimal
;enumbits 0x3  Type # Hexadecimal
;enumbits 0b11 Type # Binary
```
These examples will show which constants in the Type enum make up the value 3 (in decimal, hexadecimal, and binary representations respectively).

---

### archetype

Show which archetypes make up an integer value or search archetype strings (set names) by name. When searching by value, the input can be in decimal, hexadecimal (0x prefix), or binary (0b prefix) format. Name matches are case-insensitive and can be partial.

#### Aliases
- `;arch`
- `;set`

#### Parameters

| Name    | Required | Description                                                        | Type        |
|---------|----------|--------------------------------------------------------------------|-------------|
| `query` | Yes      | Search term or integer value (decimal, hex, or binary) for archetypes | text/number |

#### Examples
```
;archetype 7     # Decimal
;archetype 0x7   # Hexadecimal
;archetype 0b111 # Binary
```
These examples will show which archetypes make up the value 7 (in decimal, hexadecimal, and binary representations respectively).

```
;archetype sky striker
```
This will search for archetype strings containing "sky striker".

---

### counter

Search counters by name or value. When searching by value, the input can be in decimal, hexadecimal (0x prefix), or binary (0b prefix) format. Name and value matches are case-insensitive and can be partial.

#### Parameters

| Name    | Required | Description                                                     | Type        |
|---------|----------|-----------------------------------------------------------------|-------------|
| `query` | Yes      | Search term or value (decimal, hex, or binary) for the counter  | text/number |

#### Examples
```
;counter spell
```
This will search for counters with "spell" in their name.

```
;counter 13     # Decimal
;counter 0xd    # Hexadecimal
;counter 0b1101 # Binary
```
These examples will search for counters with a value of 13 (in decimal, hexadecimal, and binary representations respectively).
