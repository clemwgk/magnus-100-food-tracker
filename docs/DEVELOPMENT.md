# Development and deployment

This document covers the repeatable setup and verification work needed to run or change the project. It intentionally names configuration keys but never includes their values.

## Prerequisites

- Node.js and npm
- An Airtable base that you control
- A Google account for Apps Script
- A GitHub repository with Pages enabled

On the Windows environment used for this project, invoke npm as `npm.cmd` in PowerShell:

```powershell
npm.cmd ci
npm.cmd run dev
```

## Airtable setup

Create a base with one table named `Ingredients`. It must have exactly these fields:

| Field | Airtable type |
| --- | --- |
| `Name` | Single line text (primary field) |
| `Key` | Single line text |
| `First Exposure Date` | Date with time disabled |
| `Notes` | Long text |
| `Created At` | Created time |

Create a Personal Access Token restricted to this base with record read/write access. The optional live test also uses schema-read access to check the disposable test base. Do not grant schema-write access.

Keep the token and base ID in a password manager until the Apps Script deployment is ready. Neither value belongs in GitHub, frontend environment variables, source code, or chat.

## Deploy the Apps Script proxy

1. In Google Apps Script, create a standalone project.
2. Copy `Code.gs`, `airtable.gs`, `auth.gs`, and `normalization.gs` from `apps-script/` into matching script files. Replace the project manifest with `apps-script/appsscript.json`.
3. In **Project Settings -> Script Properties**, create these four properties:

   ```text
   AIRTABLE_TOKEN
   AIRTABLE_BASE_ID
   FAMILY_PASSCODE_HASH
   FAMILY_PASSCODE_SALT
   ```

4. Generate the two passcode verifier values locally:

   ```powershell
   npm.cmd run make:passcode-hash
   ```

   The helper hides typed input and does not write the passcode to disk. Copy only its generated salt and hash into Script Properties.
5. Deploy as a Web app. Choose **Execute as: Me** and an access setting that permits the PWA to reach the endpoint. Copy the production URL ending in `/exec`, not the development `/dev` URL.
6. Open `GET /exec?action=health` to confirm the configuration flags are true. The response should reveal only boolean status, never values.

The endpoint URL is saved separately in each browser or installed PWA. The shared passcode is intentionally not saved beyond the current session.

After any change under `apps-script/`, copy the changed script into Apps Script and update the existing web-app deployment with a new version before testing. The source repository cannot deploy Apps Script automatically.

## Test locally

Run the normal checks before publishing a behavior change:

```powershell
npm.cmd run lint
npm.cmd run test
npm.cmd run test:e2e
npm.cmd run secret:scan
npm.cmd run build
```

The suite covers normalisation, date handling, proxy-facing save behavior, concurrent-save expectations, mobile viewport interactions, and a scan of source and build output for secrets.

### Disposable live-test gate

Automated live checks are intentionally disabled unless explicitly enabled. Never use a family base for automated writes. Instead, create a disposable base with the same five-field `Ingredients` schema and deploy a separate Apps Script project configured only for that base.

Set values only in the current PowerShell session, then run the pre-build test:

```powershell
$env:RUN_LIVE_PREBUILD_TESTS='true'
$env:APPS_SCRIPT_URL='https://script.google.com/macros/s/.../exec'
$env:TEST_FAMILY_PASSCODE='your passcode'
$env:TEST_AIRTABLE_BASE_ID='app...'
$env:TEST_AIRTABLE_TOKEN='a token restricted to the disposable base'
npm.cmd run test:prebuild
```

The test first calls the protected `verifyTestTarget` action. It will not write unless the script's configured base exactly matches `TEST_AIRTABLE_BASE_ID`. It then checks health, invalid-passcode handling, the expected Airtable schema, create/read/backdate behavior, and cleanup.

## Publish the PWA

The GitHub Actions workflow at `.github/workflows/deploy-pages.yml` runs install, lint, unit/integration tests, secret scan, and production build on every push to `main`, then deploys `dist` to GitHub Pages under the repository path.

For a local production-path check:

```powershell
$env:VITE_BASE_PATH='/magnus-100-food-tracker/'
npm.cmd run build
```

No Airtable or passcode values should be provided as Vite build variables. A static Pages deployment must remain safe to view and inspect without any family configuration.

## Contribution checklist

Before committing:

1. Keep the ingredient-only scope unless the product boundary is intentionally changed.
2. Update the relevant tests and public documentation with the implementation.
3. Run the checks above, including `npm.cmd run secret:scan`.
4. Inspect the diff for endpoint values, credentials, passcodes, hashes, salts, or family records.
5. Use a neutral commit identity if the repository is public:

   ```powershell
   git -c user.name='Magnus Food Tracker' -c user.email='noreply@users.noreply.github.com' commit -m 'Describe the change'
   ```
