# Apps Script API Contract

This contract is for the Google Apps Script web app that sits between the PWA and Airtable.

The frontend must not call Airtable directly.

## Transport Rules

- Use the deployed Apps Script `/exec` URL for production-like testing.
- Use `GET` for read actions.
- Use `POST` for write actions.
- Do not send custom request headers.
- Do not send an `Authorization` header.
- For `POST`, send JSON as `text/plain` or form-encoded data to avoid unnecessary CORS preflight.
- The Airtable token must live only in Apps Script Script Properties.

Required Apps Script properties:

```text
AIRTABLE_TOKEN
AIRTABLE_BASE_ID
FAMILY_PASSCODE_HASH
```

Optional Apps Script properties:

```text
FAMILY_PASSCODE_SALT
```

The build agent should provide a setup helper or documented one-off method to compute the passcode hash. Do not store the plain family passcode in the repository.

## Response Envelope

Every response should use this shape:

```json
{
  "ok": true,
  "data": {},
  "error": null
}
```

Error response:

```json
{
  "ok": false,
  "data": null,
  "error": {
    "code": "INVALID_PASSCODE",
    "message": "Invalid passcode."
  }
}
```

Do not return raw stack traces, Airtable headers, Airtable tokens, passcodes, or Apps Script property values.

## Actions

Use an `action` parameter to route all requests.

### `GET?action=health`

Purpose: confirm the Apps Script endpoint is reachable.

Response data:

```json
{
  "service": "magnus-100-food-tracker",
  "version": "v1",
  "airtableConfigured": true
}
```

### `POST?action=unlock`

Purpose: validate the family passcode without writing data.

Request body:

```json
{
  "passcode": "typed passcode"
}
```

Response data:

```json
{
  "valid": true
}
```

### `GET?action=getSummary`

Purpose: fetch dashboard summary.

Response data:

```json
{
  "totalIngredients": 37,
  "goal": 100,
  "recentIntroductions": [
    {
      "key": "prawn",
      "name": "Prawn",
      "firstExposureDate": "2026-06-17"
    }
  ]
}
```

### `GET?action=listIngredients`

Purpose: fetch ingredients and aliases for preview/dedupe.

Response data:

```json
{
  "ingredients": [
    {
      "id": "rec...",
      "key": "prawn",
      "name": "Prawn",
      "firstExposureDate": "2026-06-17"
    }
  ],
  "aliases": [
    {
      "id": "rec...",
      "aliasKey": "prawns",
      "ingredientKey": "prawn"
    }
  ]
}
```

### `GET?action=listMeals`

Purpose: fetch recent meal history.

Optional query parameters:

```text
limit=20
```

Response data:

```json
{
  "meals": [
    {
      "id": "rec...",
      "mealDate": "2026-06-17",
      "mealLabel": "2026-06-17 - prawn, carrot, corn",
      "rawInput": "blended prawns, carrot, and corn",
      "ingredientKeys": ["prawn", "carrot", "corn"],
      "newIngredientKeys": ["prawn", "carrot", "corn"],
      "notes": ""
    }
  ]
}
```

### `GET?action=snapshot`

Purpose: fetch all data required for the app's initial load.

Response data:

```json
{
  "summary": {
    "totalIngredients": 37,
    "goal": 100
  },
  "ingredients": [],
  "aliases": [],
  "recentMeals": []
}
```

### `POST?action=saveMeal`

Purpose: create a meal and any newly introduced ingredients.

Request body:

```json
{
  "passcode": "typed passcode",
  "mealDate": "2026-06-17",
  "rawInput": "blended prawns, carrot, and corn",
  "parsedIngredients": [
    {
      "key": "prawn",
      "name": "Prawn"
    },
    {
      "key": "carrot",
      "name": "Carrot"
    },
    {
      "key": "corn",
      "name": "Corn"
    }
  ],
  "notes": ""
}
```

Response data:

```json
{
  "meal": {
    "id": "rec...",
    "mealDate": "2026-06-17"
  },
  "allIngredientKeys": ["prawn", "carrot", "corn"],
  "newIngredientKeys": ["prawn", "carrot", "corn"]
}
```

## Error Codes

Use stable error codes so the frontend can show useful messages.

```text
UNKNOWN_ACTION
INVALID_PASSCODE
MISSING_REQUIRED_FIELD
INVALID_DATE
EMPTY_INGREDIENT_LIST
AIRTABLE_NOT_CONFIGURED
AIRTABLE_SCHEMA_MISMATCH
AIRTABLE_READ_FAILED
AIRTABLE_WRITE_FAILED
CONFLICT_RETRY
INTERNAL_ERROR
```

## Save Algorithm

For `saveMeal`, Apps Script is authoritative:

1. Validate passcode against `FAMILY_PASSCODE_HASH`.
2. Validate `mealDate` as a date-only `YYYY-MM-DD` string.
3. Validate `parsedIngredients` is non-empty.
4. Acquire `LockService` lock.
5. Fetch aliases from Airtable.
6. Canonicalize parsed keys using aliases.
7. Re-read existing ingredients by key while holding the lock.
8. Create missing ingredient records.
9. Create the meal record linking all ingredients.
10. Link only newly created ingredients in `Meals.New Ingredients`.
11. Update `Ingredients.First Meal` for newly created ingredients.
12. Release lock.
13. Return all ingredient keys and new ingredient keys.

If schema fields are missing, return `AIRTABLE_SCHEMA_MISMATCH` and do not partially write data.

## Date And Timezone Rule

- Store meal dates as date-only strings: `YYYY-MM-DD`.
- Use the selected meal date as the source of truth.
- The frontend defaults Today/Yesterday using the device's local calendar date.
- Do not convert meal dates through UTC timestamps before sending to Apps Script.
