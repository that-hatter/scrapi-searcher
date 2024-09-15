---

## Definitions

**Query**: The search term used to find results by name or value. This can be a partial or complete match depending on the command.

**Value**: The specific numeric or string value used in commands to retrieve detailed information.

## Commands

- [`;constant`](#constant)
- [`;enum`](#enum)
- [`;function`](#function)
- [`;namespace`](#namespace)
- [`;tag`](#tag)
- [`;type`](#type)
- [`;constantval`](#constantval)
- [`;enumbits`](#enumbits)
- [`;archetype`](#archetype)
- [`;counter`](#counter)

## `;constant`

Search constants by name. Results are case-insensitive and can be partial matches.

### Parameters

| Name    | Required? | Description                               | Type  |
|---------|-----------|-------------------------------------------|-------|
| `query` | ✔         | Search term for the constant name.        | text  |

### Aliases

- `;c`
- `;const`

## `;enum`

Search enums by name. Results are case-insensitive and can be partial matches.

### Parameters

| Name    | Required? | Description                               | Type  |
|---------|-----------|-------------------------------------------|-------|
| `query` | ✔         | Search term for the enum name.            | text  |

### Aliases

- `;e`

## `;function`

Search functions by name. Results are case-insensitive and can be partial matches.

### Parameters

| Name    | Required? | Description                               | Type  |
|---------|-----------|-------------------------------------------|-------|
| `query` | ✔         | Search term for the function name.        | text  |

### Aliases

- `;f`
- `;fn`
- `;func`

## `;namespace`

Search namespaces by name. Results are case-insensitive and can be partial matches.

### Parameters

| Name    | Required? | Description                               | Type  |
|---------|-----------|-------------------------------------------|-------|
| `query` | ✔         | Search term for the namespace name.       | text  |

### Aliases

- `;n`
- `;ns`

## `;tag`

Search tags by name. Results are case-insensitive and can be partial matches.

### Parameters

| Name    | Required? | Description                               | Type  |
|---------|-----------|-------------------------------------------|-------|
| `query` | ✔         | Search term for the tag name.             | text  |

### Aliases

- None

## `;type`

Search types by name. Results are case-insensitive and can be partial matches.

### Parameters

| Name    | Required? | Description                               | Type  |
|---------|-----------|-------------------------------------------|-------|
| `query` | ✔         | Search term for the type name.            | text  |

### Aliases

- `;t`

## `;constantval`

Search constants by value. Number values must be exact.

### Parameters

| Name    | Required? | Description                               | Type  |
|---------|-----------|-------------------------------------------|-------|
| `query` | ✔         | Exact numeric value to search for.        | number|

### Aliases

- `;cval`

## `;enumbits`

Show which constants in a bit enum (except Archetype) make up an integer value. If no enum name is provided, all constants for the value are displayed.

### Parameters

| Name        | Required? | Description                                              | Type  |
|-------------|-----------|----------------------------------------------------------|-------|
| `value`     | ✔         | The integer value to check.                             | number|
| `enum-name` | ⭘         | The optional name of the enum to filter results by.     | text  |

### Aliases

- `;ebits`

## `;archetype`

Show which archetypes make up an integer value or search archetype strings (set names) by name. Name matches are case-insensitive and can be partial.

### Parameters

| Name    | Required? | Description                                          | Type  |
|---------|-----------|------------------------------------------------------|-------|
| `query` | ✔         | Search term or integer value for archetype strings. | text  |

### Aliases

- `;arch`
- `;set`;

## `;counter`

Search counters by name or value. Name and value matches are case-insensitive and can be partial.

### Parameters

| Name    | Required? | Description                                  | Type  |
|---------|-----------|----------------------------------------------|-------|
| `query` | ✔         | Search term or value for the counter.        | text  |

### Aliases

- None

---