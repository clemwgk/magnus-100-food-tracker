# QA And Verification Plan

This file defines the checks a future Codex/LLM build agent should run before calling the app complete.

## Unit Tests

### Ingredient Parser

- `blended prawns, carrot, and corn` returns `prawn`, `carrot`, `corn`.
- `Prawns` returns `prawn`.
- `corn, corn, corn` returns one `corn`.
- `carrots and prawns` returns `carrot`, `prawn`.
- `berries, tomatoes, potatoes` returns `berry`, `tomato`, `potato`.
- `bass, cress, asparagus` stays `bass`, `cress`, `asparagus`.
- `prawn + carrot` returns `prawn`, `carrot`.
- Empty input disables save.
- Punctuation-only input disables save.
- Alias mapping overrides singularization.
- Multiword ingredients such as `sweet corn` are preserved.

### Save Algorithm

- Existing ingredient is linked to a meal but not marked new.
- New ingredient gets `First Exposure Date` equal to selected meal date.
- Same ingredient twice in one meal creates one ingredient link.
- Backdated meal uses the selected date, not today's date.
- Meal label is deterministic.
- Wrong passcode blocks writes.
- Airtable read/write failure returns a controlled error.

### Date Helpers

- Today uses the device local calendar date.
- Yesterday subtracts one local calendar day.
- Dates serialize as `YYYY-MM-DD`.
- Date-only values are not converted through UTC timestamps.

## Apps Script Contract Tests

- `GET?action=health` returns JSON envelope.
- `GET?action=snapshot` returns summary, ingredients, aliases, and recent meals.
- `GET?action=listIngredients` returns ingredients and aliases.
- `GET?action=listMeals` returns recent meals.
- `POST?action=unlock` accepts correct passcode and rejects wrong passcode.
- `POST?action=saveMeal` rejects missing passcode.
- `POST?action=saveMeal` rejects invalid date.
- `POST?action=saveMeal` rejects empty ingredient list.
- `POST?action=saveMeal` works with `Content-Type: text/plain`.
- No custom headers are required.
- Every error response uses `{ ok: false, error: { code, message } }`.
- No response includes token, passcode, raw Airtable headers, or stack trace.

## Airtable Integration Tests

Use a test base or clearly marked disposable records.

1. Start with empty `Ingredients`, `Meals`, and `Aliases` tables.
2. Save meal `blended prawns, carrot, and corn` for `2026-06-17`.
3. Verify `Ingredients` contains exactly keys `prawn`, `carrot`, `corn`.
4. Verify `Meals` contains one meal.
5. Verify `Meals.Ingredients` links all three ingredients.
6. Verify `Meals.New Ingredients` links all three ingredients.
7. Save meal `carrot and banana` for `2026-06-18`.
8. Verify only `banana` is newly created.
9. Verify second meal links `carrot` and `banana`.
10. Verify second meal's `New Ingredients` links only `banana`.
11. Add alias `shrimp -> Prawn`.
12. Save meal `shrimp`.
13. Verify no new `shrimp` ingredient is created.

## Concurrency Test

Simulate two near-simultaneous `saveMeal` calls with the same new ingredient.

Expected result:

- only one `Ingredients` record for the key;
- both meals link that ingredient;
- at most one meal marks it as new;
- no partial records remain after failure.

If this cannot be fully automated, document the manual test and the observed result.

## PWA And Mobile QA

Test viewports:

- iPhone SE width.
- Current standard iPhone width.
- Landscape mobile.

Checks:

- No horizontal scrolling.
- Text does not overlap.
- Date controls fit.
- Ingredient chips wrap cleanly.
- Save button remains reachable when keyboard is open.
- Tap targets are at least 44px high.
- Safe-area padding works on iPhone-style screens.
- App shell loads after refresh.
- Cached data is visibly stale if offline.
- Saving while offline is blocked with a clear message unless an offline queue has been intentionally implemented.
- App can be added to iPhone home screen after deployment.

## GitHub Pages QA

- Static build succeeds.
- App works under the repository base path.
- Manifest paths are correct.
- Service worker scope is correct.
- Refreshing a routed page does not produce a 404, or the app avoids client-side routes that require fallback support.
- No secrets are present in built assets.

## Security And Secrets QA

Run before handoff:

```text
rg -n "pat|AIRTABLE|Bearer|FAMILY_PASSCODE|app[A-Za-z0-9]{10,}|secret|token" .
```

Expected:

- Docs may mention variable names like `AIRTABLE_TOKEN`.
- No real token values appear.
- No Airtable token appears in `src`, `public`, `dist`, source maps, GitHub Pages config, or committed Apps Script files.

Verify manually:

- Airtable token exists only in Apps Script Script Properties.
- Passcode hash exists only in Apps Script Script Properties.
- Plain passcode is not logged.
- Apps Script errors do not reveal secrets.
- The frontend does not send an `Authorization` header.

## Accessibility QA

- Inputs have labels.
- Buttons have clear text or accessible labels.
- Focus states are visible.
- Color contrast is readable.
- Error/success states are obvious.
- Dynamic text size does not break the layout.

## Manual Acceptance Test

1. Parent opens the PWA on an iPhone-sized viewport.
2. Parent enters passcode.
3. Parent selects `Yesterday`.
4. Parent enters `blended prawns, carrot, and corn`.
5. App previews `prawn`, `carrot`, and `corn`.
6. Parent saves.
7. Dashboard shows `3 / 100`.
8. Airtable has three ingredients and one meal.
9. Second parent logs `prawn and banana`.
10. Dashboard shows `4 / 100`.
11. Airtable second meal marks only `banana` as new.

