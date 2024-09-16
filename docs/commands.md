# Regular Bot Commands

## Commands
   - [card](#card)
   - [id](#id)
   - [rulings](#rulings)
   - [limits](#limits)
   - [search](#search)
   - [commands](#commands)
   - [help](#help)
   - [about](#about)
   - [ping](#ping)

---

### card

Search cards by name. Matches can be fuzzy.

#### Parameters

| Name    | Required | Description          | Type |
|---------|----------|----------------------|------|
| `query` | Yes      | Card name to search  | text |

#### Example
```
;card Raye
```
This will search for cards with names similar to "Raye".

---

### id

Show a card's name and id (passcode) without other information.

#### Aliases
- `;password`
- `;passcode`

#### Parameters

| Name    | Required | Description          | Type |
|---------|----------|----------------------|------|
| `query` | Yes      | Card name to search  | text |

#### Example
```
;id Sky Striker Ace - Raye
```
This will display the name and id (passcode) for "Sky Striker Ace - Raye".

---

### rulings

Link to a card's ruling page(s).

#### Aliases
- `;ruling`

#### Parameters

| Name    | Required | Description          | Type |
|---------|----------|----------------------|------|
| `query` | Yes      | Card name to search  | text |

#### Example
```
;rulings Kaiser Colosseum
```
This will provide links to the ruling pages for "Kaiser Colosseum".

---

### limits

Show a card's limit status across every applicable banlist.

#### Aliases
- `;limit`

#### Parameters

| Name    | Required | Description          | Type |
|---------|----------|----------------------|------|
| `query` | Yes      | Card name to search  | text |

#### Example
```
;limits Sky Striker Ace - Raye
```
This will display the limit status of "Sky Striker Ace - Raye" across all applicable banlists.

---

### search

Search cards by name and text. Matches are case-insensitive and can be partial.

#### Aliases
- `;cardsearch`

#### Parameters

| Name    | Required | Description                        | Type |
|---------|----------|------------------------------------|------|
| `query` | Yes      | Search term for card name and text | text |

#### Example
```
;search zombie
```
This will search for cards with "zombie" in their name or text.

---

### commands

Show a list of commands.

#### Aliases
- `;cmds`

#### Example
```
;commands
```
This will display a list of available commands.

---

### help

Display a basic help message on how to use the bot.

#### Example
```
;help
```
This will show a help message explaining how to use the bot.

---

### about

Show information about the bot. Equivalent to mentioning it.

#### Example
```
;about
```
This will display information about the bot.

---

### ping

Ping the bot.

#### Example
```
;ping
```
This will ping the bot to check its response time.
