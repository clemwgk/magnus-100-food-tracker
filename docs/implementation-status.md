# Implementation Status — 2026-06-19

The PWA, Apps Script proxy source, Pages workflow, and automated test harnesses have been implemented from `docs/llm-build-handoff.md`.

## Verified locally

| Check | Result |
| --- | --- |
| `npm.cmd ci` | Passed; 0 audited vulnerabilities reported. |
| `npm.cmd run lint` | Passed. |
| `npm.cmd run test` | Passed: 4 files, 13 tests. |
| `npm.cmd run test:e2e` | Passed: 6 tests across desktop Chromium and iPhone-sized WebKit. |
| `npm.cmd run secret:scan` | Passed for source and generated `dist`. |
| `npm.cmd run build` | Passed. |
| `npm.cmd run test:prebuild` without live variables | Safely skipped: no external calls or writes. |

The local Vite server is running at `http://127.0.0.1:5173/`.

## Required remaining gate: live disposable-base check

No Apps Script deployment URL or disposable-base credentials were supplied, and the family base must not be used for this test. Deploy a separate Apps Script project configured to a disposable base, then set only process-local variables and run the command documented in `README.md`:

```powershell
$env:RUN_LIVE_PREBUILD_TESTS='true'
$env:APPS_SCRIPT_URL='https://script.google.com/macros/s/.../exec'
$env:TEST_FAMILY_PASSCODE='your passcode'
$env:TEST_AIRTABLE_BASE_ID='app...'
$env:TEST_AIRTABLE_TOKEN='the disposable base token'
npm.cmd run test:prebuild
```

The harness verifies the anonymous `/exec` health response, text/plain protected POST, invalid-passcode rejection, configured-base match, create/read/backdate behavior, schema, and cleanup. It refuses to mutate the proxy unless its configured base exactly matches `TEST_AIRTABLE_BASE_ID`.
