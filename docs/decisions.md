# Magnus 100 Food Tracker Decisions

## Context

The app is for tracking food exposure for an infant born on 31 Dec 2025. The family goal is to record 100 different ingredients introduced during early feeding, with very low friction on iPhones for two parents.

The central workflow is: enter a meal or paste a list of ingredients, such as "blended prawns, carrot, and corn", select the date, and have the app record only ingredients that are newly introduced while still preserving the full meal record.

## Current Product Decisions

- Build a custom mobile-friendly PWA because the polished intake flow is central to the product.
- Use a conservative ingredient normalization approach: trim, lowercase, dedupe, and handle simple singular/plural cases such as "prawns" to "prawn".
- Track all entered ingredients and count all entered ingredients toward the 100 goal.
- Do not include structured allergy or reaction tracking in v1.
- Allow backdated logging because meals may be recorded after the fact.
- Prefer reducing the number of accounts and services to manage.
- Use Google Apps Script as the Airtable proxy.
- Host the PWA on GitHub Pages if no secrets are bundled into the frontend.
- Use a shared family passcode checked by Apps Script.
- Set up Airtable manually for v1.

## Current Architecture Direction

Use Airtable as the data store because the user already has an Airtable account, but do not call Airtable directly from browser JavaScript.

Preferred shape:

```text
iPhone PWA
  -> Google Apps Script proxy
  -> Airtable base
```

The PWA can be installed on both parents' iPhones. Airtable remains the source of truth. Google Apps Script acts as a tiny server-side API so the Airtable token is not exposed in the frontend bundle.

The proxy contract should be intentionally boring: use `GET` for reads and simple `POST` requests for writes, with no custom request headers. Send JSON as `text/plain` or send form-encoded payloads so browser requests avoid CORS preflight issues, which can be awkward with Google Apps Script web app endpoints. Any shared passcode should be included in the request body and checked by Apps Script, not sent as an `Authorization` header.

## Token And Secret Handling

The Airtable token should live only in a server-side environment, not in the PWA source code, not in built JavaScript, and not in a public static hosting config.

Preferred location:

```text
Google Apps Script Script Properties
```

The PWA calls the deployed Apps Script web app endpoint. The Apps Script reads the Airtable token from Script Properties and uses it to call the Airtable API.

GitHub Secrets are not sufficient for protecting a token used by GitHub Pages frontend code. Secrets can protect values during build or deployment, but if a secret is inserted into browser JavaScript, it becomes visible to anyone who can load or inspect the app.

If a shared passcode is used, it is access control for the family API, not a true browser-side secret. It should be stored as `FAMILY_PASSCODE_HASH` in Apps Script Script Properties and compared there. The PWA may remember the passcode locally on the phone for convenience.

## Airtable Account Decision

A single Airtable account can be enough if only the custom PWA needs to access Airtable data. The wife does not need her own Airtable account to use the PWA, because the PWA writes through the server-side proxy.

The wife would need an Airtable account only if she needs direct access to the Airtable base, Airtable app, or Airtable interface as a collaborator.

Writes through the proxy will be performed using the Airtable token owner's access. The app intentionally does not record which parent entered a meal or ingredient.

## Revised Planning Notes

- Do not over-prioritize offline write support in v1. Show cached last-known data if possible, but treat saving as an online operation unless offline logging becomes a real pain.
- Make the PWA work without an app login. Use a shared family passcode checked by the Apps Script proxy if any protection is needed.
- Keep Airtable schema simple enough that the base remains useful directly: `Ingredients`, `Meals`, and optionally `Aliases`.
- Put duplicate prevention in the Apps Script proxy, not only in the frontend, so two devices cannot easily create duplicate first-exposure ingredients.

## Options Considered

### Google Sheets

Google Sheets is familiar and free, and the existing attempt suggests it is the right level of data simplicity. It is not ideal as the primary mobile UX because direct sheet entry is mobile-unfriendly. It remains viable if paired with Google Apps Script, but the data model is more brittle than Airtable.

### Firebase

Firebase is a clean technical fit for auth, sync, and offline behavior, but it adds another platform/account surface. It is no longer the preferred default because reducing account sprawl is a stated goal.

### Airtable Direct From Frontend

Rejected because an Airtable personal access token in frontend code would be exposed. Airtable can still be the backend if accessed through a proxy.

### Airtable Native Interface Or Form

Useful as an admin fallback, but not enough for the core polished intake flow with ingredient parsing, dedupe, and first-exposure tagging.
