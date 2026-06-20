# Magnus 100 Food Tracker State

## Last Updated

2026-06-18

## Workspace

```text
C:\Users\cleme\Documents\Codex\magnus-100-food-tracker
```

## Current Files

- `idea.md`: original project seed and goals.
- `docs/decisions.md`: running record of product, architecture, and security decisions.
- `docs/state.md`: lightweight state file for future handoff.
- `docs/airtable-setup.md`: manual Airtable setup runbook.
- `docs/build-plan.md`: formal LLM-executable build plan.
- `docs/llm-build-handoff.md`: single consolidated build handoff for upload/copy/paste into a fresh LLM.
- `docs/api-contract.md`: Apps Script API contract.
- `docs/normalization.md`: ingredient parser and normalization spec.
- `docs/qa.md`: QA and verification matrix.
- `docs/subagent-review.md`: summary of the GPT-5.5 subagent review and incorporated findings.

## Current Status

Planning and architecture discovery. No app has been scaffolded yet. The consolidated handoff has been hardened after external review and is the primary execution spec.

## Chosen Direction

Build a custom mobile PWA for iPhones with Airtable as the source of truth and Google Apps Script as a tiny server-side proxy.

Confirmed decisions:

- Use Google Apps Script as the Airtable proxy.
- Host the PWA on GitHub Pages if no secrets are bundled into the frontend.
- Use a shared family passcode checked by Apps Script.
- Set up Airtable manually for v1.

## Important Constraints

- Zero incremental cost.
- Minimize new accounts or services.
- Primary users are two parents on iPhones.
- Polished intake UI is central.
- Shared sync matters.
- Do not expose Airtable tokens in frontend code.

## Open Decisions

- Decide whether export is required in v1 or whether Airtable export is enough.

## Next Build-Plan Work

Before implementation, the next builder should:

- Follow `docs/airtable-setup.md` or create a disposable test Airtable base.
- For a fresh LLM build instance, pass `docs/llm-build-handoff.md` as the primary single-file handoff and source of truth.
- Run the Phase 0 CORS/proxy spike from `docs/build-plan.md`.
- Treat older split docs as supporting notes if needed; if they conflict with `docs/llm-build-handoff.md`, follow the consolidated handoff.
