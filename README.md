# Magnus 100 Food Tracker

An installable, mobile-first web app for recording the first time a child tries each ingredient. Parents type a short list, choose the date, and keep one shared record moving toward 100 foods.

The public PWA is deliberately unconfigured: it contains no family data, Airtable credentials, shared passcode, or pre-filled service endpoint.

## Documentation

Choose the document for the question you have:

| Document | Use it for |
| --- | --- |
| [Technical guide](docs/TECHNICAL_GUIDE.md) | Implementing or maintaining the project: architecture, data model, API behaviour, deployment, tests, and safe-change rules. |
| [Product brief](docs/PRODUCT_BRIEF.md) | Understanding the original problem, constraints, scope decisions, options considered, trade-offs, and delivery approach. |

## What it does

- Accepts a quick ingredient list such as `blended prawns, carrot, and corn`.
- Previews a conservative parse: `Prawn`, `Carrot`, and `Corn`.
- Tracks one record per ingredient and its earliest exposure date.
- Prevents duplicate records and preserves an earlier corrected date.
- Shows progress toward 100 ingredients and supports searching the saved list.
- Works as an iPhone home-screen PWA.

It is intentionally not a meal diary, recipe parser, nutrition app, or allergy tracker. For a mixed dish, enter its actual ingredients: `chicken, rice, carrot`, rather than `chicken porridge`.

## Architecture in one line

```text
React PWA on GitHub Pages -> Google Apps Script proxy -> Airtable Ingredients table
```

The browser never talks directly to Airtable. The proxy owns the Airtable token, checks the shared passcode, and applies the server-side de-duplication and date rules.

## Try it or run it

The public shell is available at [clemwgk.github.io/magnus-100-food-tracker](https://clemwgk.github.io/magnus-100-food-tracker/). It needs a family's own proxy URL and passcode before it can read or save data.

To work locally on this Windows setup:

```powershell
npm.cmd ci
npm.cmd run dev
```

The technical guide covers setup, deployment, test commands, and secret-handling rules.

## Privacy note

No Airtable token, base ID, passcode, hash, salt, deployed proxy URL, or real ingredient history belongs in this repository or its static deployment. The shared passcode is a lightweight family access gate, not individual authentication or healthcare-grade security.

## License

This project is shared as a portfolio artifact. No license has been granted for reuse.
