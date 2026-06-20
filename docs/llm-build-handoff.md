# Magnus 100 Food Tracker LLM Build Handoff

## 1. Read This First

This is the single authoritative build specification for a fresh LLM/Codex instance. It supersedes older split planning notes if they conflict with it.

Build a small, polished, installable PWA for two parents with iPhones. It lets them paste or type a list of foods their infant son was offered, choose the date, and records only ingredient names that have never been tracked before. The family goal is to reach 100 distinct ingredients.

The core input is deliberately low friction:

~~~
blended prawns, carrot, and corn
~~~

For a selected date of 2026-06-17, the app should normalize this to prawn, carrot, and corn, create only missing ingredient records, and clearly show which ones were new. If prawn and carrot already exist, only corn is newly introduced and counted.

### Users and constraints

- Users: two parents, both on iPhones.
- Cost: zero incremental cost.
- Data store: one shared Airtable base owned by one parent.
- Frontend: a mobile-first PWA hosted on GitHub Pages.
- Backend/proxy: Google Apps Script Web App, because Airtable tokens must never enter browser code.
- Authentication: one shared family passcode checked by Apps Script.
- Scope: first exposure of each distinct ingredient, not a general meal diary.
- Counting rule: every ingredient intentionally entered is tracked and counts. If something should not count, do not enter it.
- No structured allergy/reaction tracking in v1.
- No parent identity or author tracking in v1.

### Explicit non-goals

- No meal, recipe, feeding-event, or raw-text history.
- No Meals, Aliases, or linked-record Airtable tables.
- No per-parent accounts, individual Airtable accounts, or app login.
- No offline writes, notifications, nutrition data, portion sizes, images, or medical guidance.
- No synonym database in v1. Conservative singular/plural normalization is enough.

The raw pasted text exists only in the browser input. It is not stored in Airtable after a save. This is intentional: the product is an ingredient tracker, not a meal logger.

## 2. Confirmed Architecture

~~~
iPhone PWA on GitHub Pages
        |
        | HTTPS POST, JSON body sent as text/plain
        v
Google Apps Script Web App (/exec)
        |
        | Airtable REST API with token held only in Script Properties
        v
One Airtable table: Ingredients
~~~

### Why this architecture

| Decision | Premise | Choice | Logic | Revisit when |
| --- | --- | --- | --- | --- |
| One Airtable table | The required durable fact is each ingredient's first exposure date. | Ingredients only. | It avoids linked records, event history, and manual data maintenance while preserving the 100-food count. | The family genuinely wants to browse past feeding events or recipes. |
| Airtable as source of truth | The base should remain visible and editable without running infrastructure. | Airtable Free plan. | It is familiar, shared through one account's token, and enough for roughly 100 ingredients. | Free-plan limits or product requirements change. |
| Apps Script proxy | Browser JavaScript is inspectable. | Google Apps Script. | It keeps the Airtable token server-side without a paid backend. | CORS/deployment behavior blocks anonymous browser requests. |
| GitHub Pages PWA | The users need an installable iPhone interface, not a native app. | Static PWA. | Free hosting, easy updates, good enough for this focused workflow. | Native-only features become necessary. |
| Shared passcode | There are two trusted family users and no account system. | One shared passcode. | It is lightweight protection for a private family tool, not high-security identity verification. | More users or sensitive data require individual accounts. |
| Conservative normalization | False merges are worse than separately counting two possibly related foods. | Trim, split, preparation-prefix removal, singular/plural rules only. | Prawns becomes prawn; shrimp and prawn remain separate. | Repeated duplicate patterns justify a deliberate alias feature. |

### Security boundary

The PWA, its JavaScript, GitHub Pages repository, and browser network requests are inspectable. Never put an Airtable token, passcode hash, salt, or private family data into frontend source, build output, GitHub Actions secrets used to generate frontend code, screenshots, or markdown examples.

Store these only in Google Apps Script Script Properties:

~~~
AIRTABLE_TOKEN
AIRTABLE_BASE_ID
FAMILY_PASSCODE_HASH
FAMILY_PASSCODE_SALT
~~~

FAMILY_PASSCODE_HASH must be a salted SHA-256 hash of the shared passcode. The builder must provide a local-only helper to generate it and must never print the actual passcode in logs. Use a timing-safe comparison where practical. Rate-limit failed passcode attempts by a short-lived key in CacheService and return PASSCODE_THROTTLED after the selected threshold.

If the Airtable token leaks, revoke it in Airtable, create a replacement restricted to this base, update AIRTABLE_TOKEN in Script Properties, and redeploy/retest the proxy. If the passcode leaks, choose a new passcode, generate a new salt/hash, update both Script Properties, and clear remembered passcodes from the two devices.

## 3. Airtable Data Model

Create one base named exactly:

~~~
Magnus 100 Food Tracker
~~~

Create one table named exactly Ingredients.

| Field name | Type | Required behavior |
| --- | --- | --- |
| Name | Single line text | Primary field. Display name, for example Prawn. |
| Key | Single line text | Canonical lowercase dedupe key, for example prawn. Apps Script enforces uniqueness. |
| First Exposure Date | Date | Date only, no time. The earliest selected exposure date for that key. |
| Notes | Long text | Optional. Do not use for structured allergy tracking. |
| Created At | Created time | Airtable-generated timestamp. |

The app does not write Created At. It does not record who made an entry. Airtable cannot enforce uniqueness on Key, so the Apps Script lock and server-side lookup are the authority for duplicate prevention.

## 4. Critical Phase 0: Prove The Proxy Before Building UI

Do this before polishing the frontend. The browser must be able to call the deployed proxy anonymously without exposing Airtable credentials.

### Apps Script deployment requirements

- Implement doGet(e) and doPost(e).
- Deploy as a Web App that executes as the script owner.
- Set access to Anyone (anonymous), not Anyone with Google account.
- Use the deployed /exec URL, never /dev in the PWA.
- After changing code, update the existing deployment with New version and retest /exec.
- Add https://www.googleapis.com/auth/script.external_request to appsscript.json if Apps Script does not add the UrlFetchApp scope automatically.
- Browser POSTs must use Content-Type: text/plain;charset=utf-8 and a JSON body. Do not add custom headers; this avoids a CORS preflight that Apps Script does not reliably handle.

### Minimum spike router

Implement only these actions first:

| Method | Action | Passcode | Purpose |
| --- | --- | --- | --- |
| GET | health | No | Returns reachability and non-sensitive configuration booleans only. |
| POST | snapshot | Yes | Reads the ingredient list and summary. |
| POST | saveIngredients | Yes | Performs the safe ingredient upsert. |

Use a JSON body containing an action field for all POSTs. Health must return no ingredient names, counts, base IDs, token fragments, passcode material, or table metadata.

### Phase 0 acceptance test

From an anonymous/private browser session, call the deployed /exec endpoint:

1. GET ?action=health returns a JSON ok: true response with no family data or secrets.
2. POST with text/plain JSON and a correct passcode can call snapshot.
3. A missing or wrong passcode returns INVALID_PASSCODE and no data.
4. A saveIngredients call can create a disposable test ingredient, then read it back.

Stop and use the fallback below if any of these fail. Do not build the polished UI against an unproven proxy.

### Phase 0 fallback

If anonymous browser POSTs to Apps Script are blocked or unreliable, do not embed the Airtable token in GitHub Pages. First try an Apps Script response/body adjustment and verify /exec deployment settings. If that still fails, pause and choose a different secret-holding proxy before building the client. A GitHub secret cannot protect a value delivered to browser JavaScript.

## 5. Load-Bearing Assumptions And Pre-Build Tests

Run these after the Airtable base and Apps Script properties exist, before implementing the full PWA.

| Assumption | Why it matters | Programmatic test | Pass criteria | Fallback |
| --- | --- | --- | --- | --- |
| Apps Script accepts cross-origin simple POSTs. | The PWA depends on it. | apps-script-http.test.ts sends text/plain JSON to /exec. | snapshot and saveIngredients work from an anonymous origin. | Fix deployment/response behavior; otherwise replace the proxy. |
| Protected reads are actually protected. | Anonymous web-app access must not expose the child's food history. | Call snapshot with absent/wrong passcode. | It returns INVALID_PASSCODE and no ingredient data. | Fix the shared router guard. |
| Script Properties and UrlFetchApp can reach Airtable. | The proxy has no other data path. | airtable-contract.test.ts performs a disposable read/create/read/delete cycle. | Correct records are read and written with no token in output. | Correct scopes, base restriction, property names, or field names. |
| The one-table schema matches code. | A misspelled field causes silent corruption or failure. | Read Airtable schema in a pre-build check. | Ingredients has exactly the five required fields/types. | Fix the table before build continues. |
| Date-only values round-trip safely. | A one-day shift corrupts first-exposure history. | Save 2026-06-17, read it back through API. | The exact string 2026-06-17 returns in the UI contract. | Store/parse date-only strings without UTC timestamp conversion. |
| Upserts are safe under retries. | Mobile responses can be dropped. | Send the same save payload twice. | One record exists per key and its earliest date is preserved. | Strengthen the locked lookup/create/update algorithm. |
| The script lock prevents cross-device duplicates. | Both parents may submit the same new ingredient together. | Send two near-simultaneous save requests for the same key. | One Airtable record exists for that key. | Re-read inside LockService and retry the bounded lock. |
| GitHub Pages works under a project path. | PWA asset paths often fail after deployment. | Deploy a test build and run Playwright against Pages. | App shell, manifest, icons, and service worker load from the real base path. | Configure the bundler base path and service-worker scope. |
| Usage remains free. | Zero incremental cost is a hard constraint. | Instrument client calls in development and inspect Airtable/API usage. | No polling; typical save is one read plus at most one create and one update batch. | Cache the snapshot and remove accidental refresh loops. |
| No secrets enter the repository/build. | Static hosting exposes generated assets. | Run the secret scan below. | No actual secret values or property values are present. | Revoke leaked material and remove it before deployment. |

### Required pre-build test harnesses

The builder must create runnable tests rather than leave these as prose:

~~~
tests/unit/normalize.test.ts
tests/unit/date-only.test.ts
tests/integration/save-ingredients.test.ts
tests/integration/concurrent-save.test.ts
tests/prebuild/apps-script-http.test.ts
tests/prebuild/airtable-contract.test.ts
e2e/ingredient-entry.spec.ts
~~~

Use mocked fetch/Airtable fixtures for ordinary unit and integration tests. Gate live tests behind environment variables so they cannot accidentally alter the production base:

~~~
RUN_LIVE_PREBUILD_TESTS=true
APPS_SCRIPT_URL=https://script.google.com/macros/s/.../exec
TEST_FAMILY_PASSCODE=<only in local shell or CI secret>
TEST_AIRTABLE_BASE_ID=<disposable test base only>
~~~

Live tests must target a disposable Airtable base, never the family's real base. They must clean up any test rows they create and must not print credentials.

## 6. Repository Shape

Adapt names to the selected frontend toolchain only where necessary. Keep secrets out of the repository.

~~~
/
  src/
    app/
    components/
    lib/
      normalize.ts
      dateOnly.ts
      api.ts
      types.ts
  public/
    icons/
  apps-script/
    Code.gs
    airtable.gs
    auth.gs
    normalization.gs
    appsscript.json
  scripts/
    make-passcode-hash.mjs
    secret-scan.mjs
  tests/
    unit/
    integration/
    prebuild/
  e2e/
  package.json
  README.md
~~~

src/ and apps-script/ are handwritten source. Bundler output, test reports, screenshots, coverage, and deployment directories are generated and must be ignored. Keep the browser and Apps Script normalizers behaviorally identical with shared fixtures, even if toolchain boundaries require separate source files.

## 7. API Contract

### Request transport

For POSTs, the frontend calls the /exec URL with Content-Type: text/plain;charset=utf-8, no custom headers, and JSON in the body. All protected actions include passcode in the body. Do not put the passcode in a URL/query string.

### GET ?action=health

Response example:

~~~json
{
  "ok": true,
  "service": "magnus-food-tracker",
  "configured": {
    "airtableToken": true,
    "airtableBaseId": true,
    "familyPasscode": true
  }
}
~~~

No data values, counts, IDs, or secrets may appear here.

### POST action=snapshot

Request:

~~~json
{
  "action": "snapshot",
  "passcode": "typed family passcode"
}
~~~

Response:

~~~json
{
  "summary": {
    "totalIngredients": 37,
    "goal": 100
  },
  "ingredients": [
    {
      "id": "rec...",
      "name": "Prawn",
      "key": "prawn",
      "firstExposureDate": "2026-06-17",
      "notes": ""
    }
  ]
}
~~~

### POST action=saveIngredients

The browser parses the textarea into candidates and sends those candidates. It does not send or persist the original raw phrase. The server independently normalizes every candidate and is authoritative.

Request:

~~~json
{
  "action": "saveIngredients",
  "passcode": "typed family passcode",
  "exposureDate": "2026-06-17",
  "ingredients": ["blended prawns", "carrot", "corn"]
}
~~~

Success response:

~~~json
{
  "summary": {
    "totalIngredients": 38,
    "goal": 100
  },
  "created": [
    { "name": "Corn", "key": "corn", "firstExposureDate": "2026-06-17" }
  ],
  "alreadyKnown": [
    { "name": "Prawn", "key": "prawn", "firstExposureDate": "2026-06-10" },
    { "name": "Carrot", "key": "carrot", "firstExposureDate": "2026-06-12" }
  ],
  "dateCorrected": [],
  "allIngredientKeys": ["prawn", "carrot", "corn"]
}
~~~

If an existing ingredient is submitted with an earlier exposureDate, update its First Exposure Date and include it in dateCorrected. Do not put it in created; it is not a new distinct ingredient.

### Error contract

Return JSON with a stable machine-readable code, a short user-safe message, and no sensitive detail.

~~~
INVALID_PASSCODE
PASSCODE_THROTTLED
INVALID_ACTION
INVALID_DATE
INVALID_INGREDIENTS
CONFLICT_RETRY
AIRTABLE_ERROR
CONFIGURATION_ERROR
~~~

All actions except health must pass through one shared requirePasscode guard before branching. Snapshot is protected just like writes.

## 8. Save Algorithm

Implement this in Apps Script for saveIngredients.

1. Parse JSON body and run the shared passcode guard.
2. Validate exposureDate strictly as a real YYYY-MM-DD date.
3. Validate 1 to 20 candidate strings; reject empty/oversized input.
4. Normalize candidates on the server, remove duplicates by key, and reject if none remain.
5. Acquire LockService.getScriptLock() with a bounded wait. Return CONFLICT_RETRY if unavailable.
6. While holding the lock, fetch existing Ingredients records and index them by Key.
7. For each normalized key:
   - if no record exists, add it to created and prepare a create record;
   - if a record exists with an earlier or equal date, add it to alreadyKnown and do not modify it;
   - if a record exists with a later date, prepare an update to the earlier date and add it to dateCorrected.
8. Batch-create missing Airtable records and batch-update date corrections. Airtable REST batch operations have a maximum record count per request; chunk safely.
9. Fetch or construct the refreshed summary count and return the authoritative classifications.
10. Release the lock in finally.

### Retry policy

There is intentionally no durable request-replay log in this ingredient-only design. Such a log would reintroduce a second data model that the product does not need.

The persisted operation is idempotent: retrying the same candidates and date cannot create a second record for a key, and it cannot move a first-exposure date later. If a mobile network loses a successful response, a retry may report all ingredients as already known rather than re-reporting them as newly created. That is acceptable because the data is correct; the client should refresh the snapshot after any uncertain save and state that the ingredient list is up to date.

## 9. Normalization Contract

The app must normalize predictably and conservatively. The browser preview is advisory; Apps Script's result determines what is stored.

1. Split the input on commas, semicolons, new lines, and the standalone word and.
2. Trim whitespace, lowercase, collapse internal whitespace, and strip leading preparation words such as blended, pureed, puree, mashed, steamed, boiled, roasted, cooked, and raw.
3. Remove punctuation around the candidate.
4. Apply singularization only after trimming:
   - do not singularize keys shorter than four characters;
   - do not singularize endings ss, us, or is;
   - ies becomes y (berries -> berry);
   - oes becomes o only for allowlisted tomatoes and potatoes;
   - otherwise remove a trailing s when the key is longer than three characters;
   - preserve explicit exceptions including bass, cress, and asparagus.
5. Convert the canonical key into display Name using title case, except known acronym/punctuation cases if later needed.

Expected fixtures:

| Input | Keys |
| --- | --- |
| blended prawns, carrot, and corn | prawn, carrot, corn |
| berries; tomatoes; potatoes | berry, tomato, potato |
| bass, cress, asparagus | bass, cress, asparagus |
| corn, CORNS, corn | corn |
| shrimp, prawn | shrimp, prawn |

Do not automatically merge synonyms. In particular, shrimp and prawn remain separate by design. A future alias feature is a separately approved scope addition, not an informal normalizer change.

## 10. Frontend Requirements

Build the actual intake experience first, not a landing page.

### Main screen

- Show progress to the goal: current distinct ingredient count out of 100.
- Make the date control compact and default it to the user's local today, with easy selection of yesterday.
- Make the text input the visual focus. It must comfortably accept pasted lists.
- Show a clear parsed preview before save with New, Already tracked, and unresolved/invalid states.
- Use the locally cached snapshot for preview; after save, use the server response as authoritative.
- The save result must prominently list newly introduced ingredient names and separately list already tracked names.
- If the selected date corrected an existing ingredient to an earlier date, show a concise confirmation.
- Include a simple searchable ingredient list with first-exposure dates.
- Provide an unobtrusive settings/diagnostics area for endpoint configuration state, refresh, and passcode reset on that device. Never display secret values.

### Interaction and quality

- Optimize for one-handed mobile use and iPhone Safari safe areas.
- Use accessible labels, semantic form elements, visible focus states, and minimum 44px touch targets.
- Avoid a modal-heavy flow and do not make the user manually select individual parsed ingredients in the normal case.
- Treat saving as online-only in v1. When offline, retain the typed text locally until the user retries, but do not claim it was saved.
- The service worker may cache the app shell only. It must not cache API responses containing food history or any passcode-bearing request/response data.

## 11. Implementation Phases

### Phase 0: Base and proxy spike

Create the one-table Airtable base following docs/airtable-setup.md. Implement the minimal Apps Script router, Script Properties validation, passcode guard, and a disposable-base contract test.

Acceptance: all Phase 0 tests in Sections 4 and 5 pass from a browser origin before frontend work begins.

### Phase 1: Frontend with mock API

Implement the mobile PWA UI against a mock snapshot/saveIngredients client. Build the parser, preview states, date selection, count, result summary, and ingredient list. Add unit tests before integrating live services.

Acceptance: the input fixture blended prawns, carrot, and corn previews exactly three canonical keys and a mocked save labels only missing ones as new.

### Phase 2: Production Apps Script upsert

Implement Airtable fetch helpers, the locked save algorithm, batching, errors, date correction, and secret-safe logs. Add the live contract harness against a disposable base.

Acceptance: a correct passcode reads and writes; a bad passcode reads nothing; retry and concurrent save tests prove one record per key.

### Phase 3: Wire frontend to proxy

Connect the PWA to /exec, send JSON as text/plain, handle stable errors, persist only non-secret UI state, and refresh the snapshot after saves or uncertain failures.

Acceptance: a real three-item submission creates only missing records in Airtable and the browser shows the server's classifications.

### Phase 4: PWA and GitHub Pages

Configure the manifest, icons, service worker shell caching, project-path-safe asset URLs, and GitHub Pages deployment. Verify installed behavior on an iPhone-sized viewport and a real iPhone if available.

Acceptance: the deployed Pages URL installs, reloads, and saves online without broken assets or service-worker API caching.

### Phase 5: Final QA

Run the full automated suite, live disposable-base pre-build checks, browser E2E checks, secret scan, and the manual acceptance script below. Fix failures before handoff.

## 12. QA Matrix

### Unit tests: required and automated

tests/unit/normalize.test.ts must cover:

- the primary prawn/carrot/corn fixture;
- delimiter handling and duplicate input;
- singular/plural rules and explicit exceptions;
- preparation-word stripping;
- conservative non-merging of shrimp and prawn;
- invalid/empty candidates.

tests/unit/date-only.test.ts must cover:

- valid leap-day and ordinary YYYY-MM-DD dates;
- invalid dates such as 2026-02-30;
- date comparisons without timezone conversion;
- selecting a date earlier than a stored first-exposure date.

### Integration tests: required and automated

With a fake Airtable adapter and deterministic clock/lock:

- first save of prawn, carrot, corn creates exactly three records;
- second save of the same candidates creates zero records and does not change dates;
- duplicate values within one request create one record;
- a later selected date does not overwrite an earlier date;
- an earlier selected date updates exactly that ingredient's first date and reports dateCorrected;
- retrying the same save produces no duplicate keys;
- two concurrent saves for the same new key leave one record;
- a bounded lock timeout returns CONFLICT_RETRY with no partial write;
- a bad/missing passcode cannot call snapshot or saveIngredients;
- health returns no private ingredient data.

### Live pre-build tests: required before production configuration

Against the disposable base only:

~~~powershell
$env:RUN_LIVE_PREBUILD_TESTS='true'
$env:APPS_SCRIPT_URL='https://script.google.com/macros/s/.../exec'
$env:TEST_FAMILY_PASSCODE='<set locally, never commit>'
$env:TEST_AIRTABLE_BASE_ID='<disposable base id>'
npm run test:prebuild
~~~

The harness must verify a text/plain POST, rejected protected read, create/read/update-earlier-date behavior, and cleanup. It must fail closed if the target base does not equal TEST_AIRTABLE_BASE_ID.

### Browser E2E: required and automated

Use Playwright at iPhone-sized and desktop viewports:

- paste blended prawns, carrot, and corn, select yesterday, and see three parsed ingredients;
- mock prawn and carrot as known, save, and assert that only corn appears under new;
- assert keyboard focus and labels work for the date field, input, and save control;
- assert no text overlaps or clips at 320px and iPhone-sized widths;
- assert offline save is visibly blocked/pending, not falsely successful;
- assert the deployed app's manifest, icons, and service worker load.

### API budget check

- No polling or automatic health request on every app load.
- Cache the most recent snapshot locally only as a convenience for preview; refresh after successful saves and when the user explicitly refreshes.
- Measure one ordinary save: expected Airtable calls are one list/read plus at most one batch create and one batch update.
- Do not implement per-keystroke server validation.

### Secret scan: required and automated

Create and run a script that scans tracked source and generated deploy output for known secret prefixes and actual configured values supplied only by a local test environment. The script must not print secret values.

~~~powershell
npm run secret:scan
rg -n -i -g '!node_modules/**' -g '!coverage/**' 'pat[a-zA-Z0-9]|AIRTABLE_TOKEN|FAMILY_PASSCODE_HASH|FAMILY_PASSCODE_SALT' .
~~~

The second command may find property names/placeholders but must never find an actual token, passcode, hash, or salt. Inspect any match manually.

### Required QA command sequence

The builder must define these package scripts: `lint`, `test`, `test:e2e`, `test:prebuild`, `secret:scan`, and `build`. Before declaring the build complete, run:

~~~powershell
npm ci
npm run lint
npm run test
npm run test:e2e
npm run secret:scan
npm run build
~~~

Run `npm run test:prebuild` separately only with the disposable-base environment variables set as shown above. Record pass/fail results in the implementation handoff or PR; do not substitute a mock-only test result for the live proxy check.

### Manual acceptance script

1. On phone A, unlock the app and submit blended prawns, carrot, and corn for yesterday.
2. Confirm Airtable contains exactly three ingredient rows and the count increased by three.
3. On phone B, submit prawns, carrot, banana for today.
4. Confirm the count increases only by one and banana is the only newly introduced result.
5. Submit carrot with an earlier date than its stored date.
6. Confirm only carrot's First Exposure Date moves earlier and the count stays unchanged.
7. Put a device offline, try a save, and confirm the app does not claim it succeeded; reconnect and retry.
8. Open the GitHub Pages deployment in a private browser and inspect network/source: no Airtable token, Script Property value, or passcode material appears.

## 13. Completion Criteria

The build is complete only when all of these are true:

- The only Airtable data table required by v1 is Ingredients with the exact fields in Section 3.
- The deployed PWA works on both iPhones through the shared passcode and shared Airtable base.
- Pasting blended prawns, carrot, and corn records only missing normalized ingredients and identifies them as new in the result.
- Repeating a save or making concurrent saves cannot create duplicate Key records.
- Backdating safely retains the earliest first-exposure date without changing the ingredient count.
- All protected reads and writes reject a bad passcode; health reveals no family data.
- The full unit, integration, Playwright, live disposable-base, and secret-scan checks pass.
- The GitHub Pages production build installs as a PWA and does not cache API data or secrets.
- No token, passcode, hash, salt, or test credential is committed or included in frontend output.
