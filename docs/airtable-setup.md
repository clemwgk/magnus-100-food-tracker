# Airtable Setup Runbook

This guide creates the one-table Airtable base for Magnus 100 Food Tracker before the PWA is built.

The product is an ingredient tracker. It does not store meals, recipes, raw pasted text, parent identities, aliases, or linked records in v1.

Do not paste an Airtable token into this repository, GitHub Pages, frontend code, screenshots, or chat. The token will eventually live only in Google Apps Script Script Properties.

## Before You Start

You need:

- one Airtable account: only the base owner needs one;
- a private password-manager entry for the Airtable token;
- the consolidated builder handoff at docs/llm-build-handoff.md.

Your wife does not need an Airtable account to use the finished PWA. The PWA talks to the Apps Script proxy, which uses the owner's Airtable token.

## Step 1: Create The Base

1. Open Airtable.
2. Create a new empty base.
3. Name it exactly:

~~~
Magnus 100 Food Tracker
~~~

4. Airtable will create a starter table. Rename it exactly:

~~~
Ingredients
~~~

There must be no Meals, Aliases, or other data tables for v1. Do not add forms, interfaces, automations, lookup fields, or linked-record fields.

## Step 2: Create The Ingredients Fields

The primary field is the first column in Airtable. Rename it to Name and set its field type to Single line text.

Add the remaining fields exactly as shown. The spelling and capitalization are part of the app contract, so do not improvise alternatives.

| Field name | Airtable field type | What it is for |
| --- | --- | --- |
| Name | Single line text | Primary field. The display name, for example Prawn. |
| Key | Single line text | Canonical lowercase dedupe key, for example prawn. |
| First Exposure Date | Date | Date only. Turn off time. This is the earliest date the ingredient was offered. |
| Notes | Long text | Optional free text. Do not use it for structured allergy/reaction tracking. |
| Created At | Created time | Airtable-generated timestamp. Do not fill it yourself. |

Do not create any Lookup or Link to another record fields. None are required by this design.

At the end, the Ingredients table should have exactly the five fields above.

## Step 3: Set Up Simple Views

These views are optional for the PWA but make the Airtable base pleasant to inspect directly.

1. Keep the default grid and name it All ingredients.
2. Duplicate it and name the new view By first exposure:
   - sort First Exposure Date from oldest to newest;
   - then sort Name from A to Z.
3. Duplicate it and name the new view Recent introductions:
   - sort First Exposure Date from newest to oldest.

Do not add a test row to the real family base. The PWA's first successful save should establish the real count. The builder's automated integration tests must use a disposable test base instead.

## Step 4: Create The Airtable Token

Create a Personal Access Token for the future Google Apps Script proxy.

Use the narrowest permissions Airtable permits for only this base:

~~~
data.records:read
data.records:write
schema.bases:read
~~~

The schema read scope is needed only for the builder's automated schema check. Do not grant schema write access: the app does not need permission to create, rename, or delete tables/fields.

Restrict access to:

~~~
Only the Magnus 100 Food Tracker base
~~~

After Airtable shows the token:

1. Copy it once.
2. Store it in your password manager.
3. Do not put it in a repository, Markdown file, browser frontend, GitHub secret used by frontend code, screenshot, or chat.
4. Later, when the Apps Script project exists, paste it into Script Properties under this exact name:

~~~
AIRTABLE_TOKEN
~~~

## Step 5: Record The Base ID

The Apps Script proxy needs the base ID. Find it in Airtable's developer/API page for this base. It normally begins with app.

Store it in your password manager for now. Later add it to Apps Script Script Properties as:

~~~
AIRTABLE_BASE_ID
~~~

The future builder will also ask you to set these properties:

~~~
FAMILY_PASSCODE_HASH
FAMILY_PASSCODE_SALT
~~~

The builder must give you a local helper to generate the salt and hash. Do not store the plain family passcode in the repository or in Apps Script source code.

## Final Checklist

Before giving the project to the builder LLM, confirm:

- The base is named Magnus 100 Food Tracker.
- The only data table is Ingredients.
- Ingredients has exactly Name, Key, First Exposure Date, Notes, and Created At.
- First Exposure Date is date-only, with no time.
- There are no Meals, Aliases, lookup, or linked-record fields.
- The token is restricted to this base and has read/write record access plus schema read only.
- The token and base ID are stored outside the repository.
- No token value, passcode, passcode hash, or salt appears in a source file, Markdown file, screenshot, or chat.

## What The Builder Will Do

The PWA will send candidate ingredient names and a chosen date to Google Apps Script. The proxy will:

1. normalize singular/plural variants conservatively;
2. check existing Ingredients records by Key while holding a script lock;
3. create only missing records;
4. keep the earliest First Exposure Date when an older date is entered later;
5. return which ingredients were new, already known, or had their date corrected.

The automated tests described in docs/llm-build-handoff.md must run against a disposable test base, never this family base.

