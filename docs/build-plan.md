# Magnus 100 Food Tracker Build Plan

This is the implementation handoff for a future Codex/LLM build agent. It should be executable without relying on hidden chat history.

## 1. Project Context

Magnus 100 Food Tracker is a small family app for tracking infant food exposure. The infant was born on 31 Dec 2025. The family wants to expose him to a wide variety of ingredients and track progress toward 100 ingredients.

Primary users:

- two parents;
- both use iPhones;
- both need shared access to the same ingredient history.

Core example:

```text
Input: blended prawns, carrot, and corn
Date: yesterday
Expected behavior: parse prawn, carrot, corn; create first-exposure ingredient records only for ingredients not previously logged; create a meal record preserving the full input.
```

## 2. Product Requirements

### Must Have

- Mobile-first PWA usable from an iPhone home screen.
- Fast ingredient intake with one large text box.
- Date selector with `Today`, `Yesterday`, and manual date selection.
- Ingredient chip preview before save.
- Conservative dedupe:
  - lowercase;
  - trim;
  - remove extra punctuation;
  - dedupe repeated ingredients in one input;
  - handle simple plurals;
  - respect explicit aliases from Airtable.
- Save a meal with all parsed ingredients.
- Mark only newly introduced ingredients as new for that meal.
- Show progress toward `100` unique ingredients.
- Show recent introductions.
- Use Airtable as source of truth.
- Use Google Apps Script as a server-side proxy.
- Keep Airtable token out of frontend code and repository files.
- Use a shared family passcode checked by Apps Script.

### Should Have

- Search ingredient history.
- Show whether parsed chips are already known or new before save.
- Cache last-read data for a more pleasant mobile experience.
- Display clear sync/save/error states.

### Non-Goals For v1

- Structured allergy/reaction tracking.
- Medical advice or feeding recommendations.
- App Store native iOS app.
- Full offline write queue.
- Multi-household support.
- Complex user accounts.
- Automatic food taxonomy or nutrition analysis.
- Editing/recalculating historical first exposures.

## 3. Chosen Architecture

```text
iPhone PWA on GitHub Pages
  -> Google Apps Script web app proxy
  -> Airtable base
```

### Frontend

- Vite + React + TypeScript.
- PWA manifest and service worker.
- Static deployment to GitHub Pages.
- No secrets in `src`, `public`, build output, or GitHub Pages config.

### Proxy

- Google Apps Script web app.
- Stores server-side properties:

```text
AIRTABLE_TOKEN
AIRTABLE_BASE_ID
FAMILY_PASSCODE_HASH
```

- Executes as the script owner.
- Calls Airtable API with the Airtable token.
- Performs authoritative dedupe before writing.

### Data Store

- Airtable base named `Magnus 100 Food Tracker`.
- Manual setup follows `docs/airtable-setup.md`.
- Tables:
  - `Ingredients`
  - `Meals`
  - `Aliases`

## 4. Architecture Rationale

### Airtable As Source Of Truth

Premises:

- The user already has an Airtable account.
- Zero incremental cost and fewer managed accounts are important.
- The data is relational enough to benefit from linked records.
- The parents may want to inspect or repair data manually.

Decision:

- Use Airtable instead of Firebase or raw Google Sheets.

Logic:

- Airtable gives a spreadsheet-like admin surface while supporting linked ingredients/meals/aliases. That fits the data model better than a flat sheet and avoids adding Firebase as another account surface.

Premise to revisit:

- If Airtable free limits become restrictive or direct Airtable admin access becomes undesirable, Firebase or Google Sheets may become better.

### Apps Script Proxy

Premises:

- Airtable personal access tokens must not be exposed in browser JavaScript.
- The user already has a Google account.
- Avoiding another backend account is valuable.

Decision:

- Use Google Apps Script as the token-holding proxy.

Logic:

- The PWA can remain static and free while Apps Script holds secrets server-side and calls Airtable. This satisfies shared sync without exposing the Airtable token.

Premise to revisit:

- Apps Script web apps can be awkward with browser CORS. The build must prove the GitHub Pages PWA can read/write through Apps Script before investing in the full UI.

### GitHub Pages Hosting

Premises:

- The PWA is static.
- GitHub Pages is free.
- Secrets will not be bundled into frontend assets.

Decision:

- Host the PWA on GitHub Pages.

Logic:

- Static hosting is enough for the client app. Server-side responsibilities are isolated in Apps Script.

Premise to revisit:

- If Apps Script CORS cannot be made reliable from GitHub Pages, either host the frontend inside Apps Script HTMLService or replace the proxy with another free serverless option such as Cloudflare Workers.

### Shared Family Passcode

Premises:

- Only two trusted users need access.
- Full auth would add friction and platform complexity.
- The app stores family food records, not high-risk financial or medical data.

Decision:

- Use a shared passcode checked by Apps Script.

Logic:

- A passcode prevents casual misuse if the endpoint leaks while preserving the low-friction family workflow.

Premise to revisit:

- If the app later stores more sensitive health information or is shared beyond the family, real user authentication should replace this.

## 5. Critical Spike Before Full Build

Before building the polished UI, implement a minimal proof of life:

1. Create a temporary Apps Script `doGet` endpoint returning JSON.
2. Create a temporary Apps Script `doPost` endpoint that accepts a simple request body and returns JSON.
3. From a local or GitHub Pages-like frontend origin, call both endpoints with `fetch`.
4. Confirm the browser can read the response body.
5. Confirm no custom headers are required.
6. Confirm the deployed `/exec` URL works, not just the `/dev` test URL.

Acceptance:

- If the browser can read JSON from both `GET` and `POST`, continue with GitHub Pages + Apps Script.
- If `POST` writes work but response reading fails, do not proceed blindly. Choose one fallback:
  - host the frontend in Apps Script HTMLService;
  - use a different no/low-cost proxy;
  - use Apps Script for write-only plus Airtable API for read only only if no secret exposure is introduced, which is unlikely.

## 6. Load-Bearing Assumptions To Test Before Build

Test these before the main UI build. Prefer programmatic tests where credentials/endpoints are available.

| Assumption | Test | Programmatic? | Pass criteria | Fallback |
| --- | --- | --- | --- | --- |
| Apps Script `/exec` supports browser GET/POST from a GitHub Pages-like origin. | Deploy tiny `doGet`/`doPost`; call both with `fetch`. | Yes, after deployment. | Browser can read JSON from both. | Host frontend in Apps Script or use another proxy. |
| Simple POST avoids CORS preflight issues. | POST with no custom headers and `text/plain` JSON or form body. | Yes. | Request succeeds with readable JSON response. | Keep requests simple or change proxy. |
| Apps Script can read Script Properties and call Airtable. | `GET?action=health` verifies config and performs a read-only Airtable call. | Mostly yes. | `{ ok: true }`, no secret values returned. | Fix properties/scopes or change proxy. |
| Airtable token scopes are sufficient and narrow. | Read, create, update, and delete disposable test records. | Yes. | Test operations succeed only on intended base. | Regenerate token. |
| Airtable schema matches expected tables/fields/links. | Inspect schema or smoke-test each field by reading tables. | Yes. | `Ingredients`, `Meals`, `Aliases` and required fields exist. | Fix manual schema before app build. |
| Linked-record writes behave correctly. | Create disposable ingredients and linked meal, then read back. | Yes. | `Meals.Ingredients` and `Meals.New Ingredients` links read back correctly. | Adjust schema/write logic. |
| Duplicate prevention works under concurrent saves. | Fire two near-simultaneous `saveMeal` requests for the same new key. | Yes. | One ingredient record; both meals linked; at most one meal marks it new. | Strengthen `LockService`/re-read logic. |
| Date-only values survive round trips. | Save `2026-06-17`, read back from Airtable and UI. | Yes. | Date remains `2026-06-17`. | Store date strings or adjust Airtable date handling. |
| GitHub Pages base path will not break PWA assets. | Build with intended base path and run Playwright. | Yes. | Assets, manifest, service worker, and refresh behavior work. | Adjust Vite base/scope/routes. |
| Secrets never enter frontend or build output. | Run `rg` scan before and after build. | Yes. | No real token/passcode values found. | Remove/rotate exposed secret. |

Suggested pre-build harness files:

```text
tests/prebuild/appsScriptCors.test.ts
tests/prebuild/airtableSchema.test.ts
tests/prebuild/airtableLinkedRecords.test.ts
tests/prebuild/dateRoundTrip.test.ts
tests/prebuild/noSecrets.test.ts
```

Use local environment variables only, never committed values:

```text
APPS_SCRIPT_EXEC_URL
TEST_FAMILY_PASSCODE
AIRTABLE_BASE_ID
AIRTABLE_TOKEN
```

## 7. Repository Shape To Build

Recommended final structure:

```text
docs/
  airtable-setup.md
  api-contract.md
  build-plan.md
  decisions.md
  normalization.md
  qa.md
  state.md
  subagent-review.md
apps-script/
  Code.gs
  appsscript.json
src/
  app/
  components/
  lib/
    apiClient.ts
    date.ts
    ingredientParser.ts
    types.ts
public/
  manifest.webmanifest
  icons/
tests/
  ingredientParser.test.ts
  apiContract.test.ts
  e2e/
    mobile-log-meal.spec.ts
package.json
vite.config.ts
tsconfig.json
```

The exact component layout may vary, but parser, API client, and shared types must be separated enough to test without rendering the UI.

## 8. Airtable Schema

Use `docs/airtable-setup.md` as the authoritative manual setup guide.

Implementation assumptions:

- `Ingredients.Key` is the dedupe key.
- `Meals.Meal Date` is the date of exposure.
- `Meals.Ingredients` links all parsed ingredients.
- `Meals.New Ingredients` links only first-time ingredients introduced by that meal.
- `Aliases.Alias Key` maps to an `Ingredients` record.
- Airtable does not enforce uniqueness for `Ingredients.Key`; Apps Script must enforce it.

## 9. Apps Script API Contract

Use `docs/api-contract.md` as the authoritative API contract. The summary below is included to keep this build plan readable.

Use simple requests to reduce browser/API friction.

### Request Rules

- No custom headers.
- Do not use an `Authorization` header.
- Include passcode in the request body for write requests.
- Prefer `GET` query parameters for reads.
- Prefer `POST` body as plain text containing JSON, or form-encoded data, for writes.
- Return JSON with a consistent envelope.

### Response Envelope

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

### Endpoints

Apps Script exposes one web app URL. Route using an `action` parameter.

#### `GET?action=snapshot`

Returns:

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
      "aliasKey": "prawns",
      "ingredientKey": "prawn"
    }
  ],
  "recentMeals": []
}
```

#### `POST action=saveMeal`

Input body:

```json
{
  "passcode": "family passcode typed by user",
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

Output:

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

### Save Algorithm

Use `docs/api-contract.md` for the authoritative save algorithm.

In Apps Script:

1. Validate passcode against `FAMILY_PASSCODE_HASH`.
2. Validate `mealDate` is `YYYY-MM-DD`.
3. Validate `parsedIngredients` is non-empty and already normalized.
4. Fetch aliases.
5. Remap alias keys to canonical ingredient keys.
6. Fetch existing ingredients matching candidate keys.
7. For each missing key, create an `Ingredients` record.
8. Create a `Meals` record linking all ingredient records and only newly created ingredients as `New Ingredients`.
9. Update each newly created ingredient's `First Meal` to the new meal record.
10. Return meal ID plus `allIngredientKeys` and `newIngredientKeys`.

Concurrency note:

- Apps Script should use `LockService` around `saveMeal` to reduce duplicate first-exposure writes when both phones submit at nearly the same time.
- Even with `LockService`, the code must re-read existing ingredients while holding the lock before creating missing ones.

## 10. Frontend UX

### Primary Screen: Log

Elements:

- Progress summary: `N / 100`.
- Date selector:
  - `Today`
  - `Yesterday`
  - date picker
- Large ingredient input.
- Optional notes field.
- Parsed chips preview.
- Status per chip:
  - `new`
  - `seen`
  - `alias`
  - `duplicate in input`
- Save button.
- Clear saved state: saved meal and new ingredients.

Mobile expectations:

- One-handed use.
- No horizontal scrolling.
- Tap targets at least 44px high.
- Text must not overlap on iPhone SE width.
- Avoid dense spreadsheet-like UI.

### Secondary Screen: History

Elements:

- Search field.
- Ingredient list sorted by first exposure date.
- Recent meals grouped by date.

### Settings Screen

Elements:

- Apps Script endpoint URL configuration if not compiled in.
- Parent label selection.
- Passcode entry/reset on device.
- Diagnostics:
  - endpoint reachable;
  - Airtable reachable through proxy;
  - last sync time.

## 11. Ingredient Parsing Rules

Implement parser as a pure function.

Input transformations:

- lowercase;
- convert ampersand to `and`;
- split on comma, newline, semicolon, plus, and standalone `and`;
- trim whitespace;
- remove leading descriptors only when obvious and safe, such as `blended`;
- remove trailing punctuation;
- remove empty tokens;
- singularize simple plurals:
  - `prawns` -> `prawn`;
  - `carrots` -> `carrot`;
  - `berries` -> `berry`;
  - avoid unsafe transformations for words ending in `ss`, `us`, or very short words.

Do not infer categories. For example, do not turn `yogurt` into `dairy`, or `bread` into `wheat`.

The alias table is authoritative over generic singularization.

## 12. Implementation Phases

### Phase 0: CORS And Proxy Spike

Build the minimal Apps Script proof of life from section 5.

Stop and document the result if this fails.

### Phase 1: Local Frontend With Mock API

Build the PWA UI with an in-memory/mock API.

Acceptance:

- Parser tests pass.
- User can log the sample meal locally.
- Progress and recent introductions update.
- iPhone viewport screenshot is readable.

### Phase 2: Apps Script Proxy

Build `apps-script/Code.gs` and `apps-script/appsscript.json`.

Acceptance:

- Endpoint can return a snapshot from Airtable.
- Endpoint can log a meal.
- Invalid passcode is rejected.
- No Airtable token is present in repo.

### Phase 3: Wire Frontend To Proxy

Replace mock API with real API client.

Acceptance:

- App loads snapshot.
- App previews seen/new ingredients.
- App logs meal through Apps Script.
- Airtable reflects the correct linked records.

### Phase 4: PWA And GitHub Pages

Add manifest, icons, service worker, and deployment config.

Acceptance:

- App builds as static assets.
- App works when served from the same base path GitHub Pages will use.
- PWA install metadata is valid.

### Phase 5: Final QA And Handoff

Run the full test matrix and update docs with setup/deploy instructions.

## 13. QA Test Matrix

### Unit Tests

Parser:

- `blended prawns, carrot, and corn` -> `prawn`, `carrot`, `corn`.
- `corn, corn, corn` -> one `corn`.
- `carrots and prawns` -> `carrot`, `prawn`.
- `berries, tomatoes` -> `berry`, `tomato`.
- `bass` stays `bass`.
- empty/whitespace input returns no ingredients and disables save.
- punctuation-only chunks are ignored.

Date helpers:

- Today uses local date, not UTC date.
- Yesterday subtracts one local calendar day.
- Selected meal date serializes as `YYYY-MM-DD`.

API client:

- Does not send custom headers.
- Does not send Airtable token.
- Handles `{ ok: false }` errors.
- Handles network failure with a user-visible error.

### Apps Script Tests

These may be manual or scripted with a test harness.

- `snapshot` returns ingredients, aliases, and recent meals.
- `saveMeal` rejects missing passcode.
- `saveMeal` rejects wrong passcode.
- `saveMeal` accepts correct passcode.
- First meal `prawn, carrot, corn` creates three ingredients and one meal.
- Second meal `carrot, banana` creates only `banana` as new.
- Alias `prawns -> prawn` does not create a second `prawns` ingredient.
- Two rapid `saveMeal` calls for the same new ingredient do not create duplicate `Ingredients.Key` records.
- Airtable API errors return `{ ok: false, error }` instead of raw stack traces.

### Integration Tests

Use a test Airtable base or clearly marked test records.

- Load app, enter passcode, fetch snapshot.
- Log `prawn, carrot, corn` for `2026-06-17`.
- Verify UI shows `3 / 100`.
- Verify Airtable `Ingredients` has keys `prawn`, `carrot`, `corn`.
- Verify Airtable `Meals.New Ingredients` links all three.
- Log `carrot, banana` for `2026-06-18`.
- Verify UI shows `4 / 100`.
- Verify second meal has `New Ingredients = banana` only.

### Mobile/PWA QA

Use Playwright or browser devtools with these viewports:

- iPhone SE width.
- iPhone 13/14/15 width.
- landscape mobile.

Checks:

- No horizontal scrolling.
- No overlapping text.
- Save button remains reachable.
- Date controls fit.
- Parsed chips wrap cleanly.
- Tap targets are large enough.
- App can be added to iPhone home screen after deployment.
- Reload from home-screen-like route works.

### Security/Secrets QA

Run before any commit or handoff:

```text
rg -n "pat|AIRTABLE_TOKEN|Bearer|key[A-Za-z0-9_]*=|secret|token" .
```

Expected:

- Documentation may mention variable names such as `AIRTABLE_TOKEN`.
- No real token values appear.
- No Airtable token appears in `src`, `public`, `dist`, or GitHub Pages config.

Also verify:

- Apps Script token is in Script Properties only.
- Passcode is not logged.
- Error responses do not include Airtable request headers.

### Deployment QA

- Build succeeds.
- Static preview works under the GitHub Pages base path.
- Deployed app can fetch `snapshot`.
- Deployed app can log a meal.
- Deployed app shows a useful error if Apps Script is unavailable.

## 14. Completion Criteria

The build is complete only when:

- Airtable setup guide has been followed or a test Airtable base is available.
- Apps Script proxy is deployed and configured with server-side properties.
- PWA is deployed or locally previewable with production-like config.
- The sample `blended prawns, carrot, and corn` workflow works end to end.
- Duplicate/new ingredient behavior is proven by tests.
- The security scan finds no real secrets.
- Mobile QA screenshots show the interface is usable on iPhone-sized screens.

## 15. Known Risks

- Apps Script CORS behavior may force an architecture adjustment.
- Airtable uniqueness is not enforced by the database.
- Manual Airtable schema setup can drift from field names expected by code.
- Shared passcode is lightweight access control only.
- GitHub Pages exposes all frontend code and config.
- iOS PWA behavior differs from desktop browser behavior, so mobile QA matters.
