# Improvements backlog

Open work found while building PRs [#4](https://github.com/Genesy-AI/technical-task-rodrigo/pull/4), [#5](https://github.com/Genesy-AI/technical-task-rodrigo/pull/5), [#6](https://github.com/Genesy-AI/technical-task-rodrigo/pull/6) and [#7](https://github.com/Genesy-AI/technical-task-rodrigo/pull/7). File paths assume those PRs are merged.

**Priority:** P1 = data is wrong or the build/team is blocked · P2 = wrong or slow behaviour users notice · P3 = polish

**Size:** S = under a day · M = 1–3 days · L = a week or more

## Index

**Now**

| ID    | Title                                          | Area     | Priority | Size | Deferred in                                                      |
| ----- | ---------------------------------------------- | -------- | -------- | ---- | ---------------------------------------------------------------- |
| IMP-1 | Bulk import dedupes by name instead of email   | API      | P1       | S–M  | —                                                                |
| IMP-2 | `pnpm build` is broken by dead API client code | Frontend | P1       | S    | —                                                                |
| IMP-3 | `dev.db` is tracked in git                     | Repo     | P1       | S    | —                                                                |
| IMP-4 | Email verification blocks the HTTP request     | API      | P2       | S–M  | [#5](https://github.com/Genesy-AI/technical-task-rodrigo/pull/5) |
| IMP-5 | No loading state while emails are verified     | UI       | P2       | S    | [#5](https://github.com/Genesy-AI/technical-task-rodrigo/pull/5) |
| IMP-6 | Templates skip any lead with an empty field    | Composer | P2       | M    | [#6](https://github.com/Genesy-AI/technical-task-rodrigo/pull/6) |

**Next**

| ID     | Title                                               | Area     | Priority | Size | Deferred in                                                                                                                        |
| ------ | --------------------------------------------------- | -------- | -------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------- |
| IMP-7  | Existing leads keep non-ISO country codes           | Data     | P2       | S    | [#4](https://github.com/Genesy-AI/technical-task-rodrigo/pull/4)                                                                   |
| IMP-8  | Orion gets the email domain as company website      | Temporal | P2       | S–M  | [#7](https://github.com/Genesy-AI/technical-task-rodrigo/pull/7)                                                                   |
| IMP-9  | Stale Temporal workers on `myQueue` pick up work    | Temporal | P2       | S    | [#5](https://github.com/Genesy-AI/technical-task-rodrigo/pull/5), [#7](https://github.com/Genesy-AI/technical-task-rodrigo/pull/7) |
| IMP-10 | Validation logic duplicated in frontend and backend | Shared   | P3       | M    | [#4](https://github.com/Genesy-AI/technical-task-rodrigo/pull/4), [#6](https://github.com/Genesy-AI/technical-task-rodrigo/pull/6) |
| IMP-11 | `/leads/bulk` doesn't report dropped values         | API      | P3       | S    | [#6](https://github.com/Genesy-AI/technical-task-rodrigo/pull/6)                                                                   |
| IMP-12 | Phones are not normalized (E.164)                   | Data     | P3       | M    | [#6](https://github.com/Genesy-AI/technical-task-rodrigo/pull/6), [#7](https://github.com/Genesy-AI/technical-task-rodrigo/pull/7) |
| IMP-13 | No integration test for `enrichPhoneWorkflow`       | Tests    | P3       | S    | [#7](https://github.com/Genesy-AI/technical-task-rodrigo/pull/7)                                                                   |
| IMP-14 | `pnpm lint` is broken                               | Tooling  | P3       | S    | —                                                                                                                                  |

**Later**

| ID     | Title                                      | Area     | Priority | Size | Deferred in                                                      |
| ------ | ------------------------------------------ | -------- | -------- | ---- | ---------------------------------------------------------------- |
| IMP-15 | No proactive per-provider rate limiting    | Temporal | P3       | M    | [#7](https://github.com/Genesy-AI/technical-task-rodrigo/pull/7) |
| IMP-16 | Leads table has too many columns           | UI       | P3       | M    | [#6](https://github.com/Genesy-AI/technical-task-rodrigo/pull/6) |
| IMP-17 | Composer preview only shows the first lead | Composer | P3       | S    | [#6](https://github.com/Genesy-AI/technical-task-rodrigo/pull/6) |
| IMP-18 | CSV import modal accessibility             | UI/a11y  | P3       | S    | —                                                                |

---

## Now

### IMP-1 · Bulk import dedupes by name instead of email

- **Problem:** `/leads/bulk` (`backend/src/index.ts`) uses `firstName_lastName` as the duplicate key. In `docs/leads-with-errors.csv`, rows 1 and 23 have the same email but different names, and both are imported.
- **Impact:** two different people with the same name are merged into one lead, and the same person is imported twice if their name is spelled differently. Duplicates then get two messages and two paid phone lookups.
- **Proposal:**
  - S: dedupe on trimmed, lowercased email, both within the file and against the DB.
  - M: add a unique index on normalized email with a migration that reports existing duplicates first, and return the skipped rows in the response.
- **Priority:** P1

### IMP-2 · `pnpm build` is broken by dead API client code

- **Problem:** `useApiMutation` and `api.leads.create/update/getOne` are not used anywhere, and they don't match the backend (`firstName` vs `name`, PUT vs PATCH). The optimistic lead in `useApiMutation.ts:64` fails `tsc`, and every new lead field adds another error there.
- **Impact:** the frontend can't produce a production build. Every PR has to explain that this `tsc` error was already there.
- **Proposal:**
  - S: delete the unused hook and methods so `tsc` passes. Add `tsc` to a pre-PR check.
- **Priority:** P1

### IMP-3 · `dev.db` is tracked in git

- **Problem:** `backend/prisma/dev.db` is committed. Running dev or the tests changes it, and while `pnpm dev` is running the file is locked on Windows.
- **Impact:** every branch shows `dev.db` as modified. You can't switch branches while the backend is running, and the file can end up committed by accident with local data in it.
- **Proposal:**
  - S: untrack it, add it to `.gitignore`, and add a `prisma/seed.ts` with the current sample leads, wired to `prisma db seed`.
- **Priority:** P1 (for the team)

### IMP-4 · Email verification blocks the HTTP request

- **Problem:** since #5, `/leads/verify-emails` checks leads in parallel, but it still waits for all workflows inside the request, up to 30s. It also opens a new Temporal client on every request. The worker runs at most 100 activities at a time, and time spent waiting in the queue counts toward the 30s, so a large batch (around 500 slow leads) can come back partly as timeouts.
- **Impact:** users wait up to 30s with no feedback. Large selections fail partway through, and the result is lost if the tab is closed.
- **Proposal:**
  - S: reuse the shared Temporal client that `/leads/enrich-phones` already uses.
  - M: follow the phone enrichment pattern: add an `emailVerificationStatus` column, `workflow.start` and return 202, let the workflow write its own result, and have the UI poll `getMany` while any lead is pending.
- **Priority:** P2
- **Deferred in:** [#5](https://github.com/Genesy-AI/technical-task-rodrigo/pull/5)

### IMP-5 · No loading state while emails are verified

- **Problem:** Enrich → Verify Email shows nothing until the request returns, which can take up to 30s.
- **Impact:** users click again, which joins the same workflows but looks broken, or they assume it failed.
- **Proposal:**
  - S: disable the action and show "Verifying…" using `verifyEmailsMutation.isPending`.
  - After IMP-4, show it per row the same way the Phone cell does.
- **Priority:** P2
- **Deferred in:** [#5](https://github.com/Genesy-AI/technical-task-rodrigo/pull/5)

### IMP-6 · Templates skip any lead with an empty field

- **Problem:** `generateMessageFromTemplate` throws when a field is empty, so that lead gets no message. With the three new fields (blank phones are common in the samples), more leads get skipped.
- **Impact:** users end up with fewer messages than leads selected and have to fix the data or write a second template.
- **Proposal:**
  - M: support `{jobTitle|there}`. The single-pass replacer becomes `\{(\w+)(?:\|([^}]*))?\}` and uses the fallback when the value is empty. Update `utils/template.ts` (preview) and the empty-field warnings to match, and add an "add fallback" action next to the ⚠ count in `FieldPicker`.
- **Priority:** P2. This is the most useful next feature for message writing.
- **Deferred in:** [#6](https://github.com/Genesy-AI/technical-task-rodrigo/pull/6)

## Next

### IMP-7 · Existing leads keep non-ISO country codes

- **Problem:** #4 only validates new imports. The seed data has `UK`, and rows imported earlier may have `XXX`, `12` or lowercase codes.
- **Impact:** country filters and Nimbus lookups get wrong or mixed values.
- **Proposal:**
  - S: a one-off script that runs `normalizeCountryCode` over all rows and sets invalid values to null, logging what changed.
- **Priority:** P2
- **Deferred in:** [#4](https://github.com/Genesy-AI/technical-task-rodrigo/pull/4)

### IMP-8 · Orion gets the email domain as company website

- **Problem:** leads have no website field, so the Orion adapter sends the email domain as `companyWebsite`.
- **Impact:** for `gmail.com` and other personal email domains, Orion either misses or returns the wrong company's number, and the lead is marked "found" with bad data.
- **Proposal:**
  - S: skip Orion when the email is on a personal domain (short blocklist in `activities/phone.ts`).
  - M: add a `companyWebsite` lead field (see "Adding a lead field" in `CLAUDE.md`) and fall back to the email domain only for business emails.
- **Priority:** P2
- **Deferred in:** [#7](https://github.com/Genesy-AI/technical-task-rodrigo/pull/7)

### IMP-9 · Stale Temporal workers on `myQueue` pick up work

- **Problem:** the worker runs inside the API process (`pnpm dev`), and every environment uses the same `myQueue`. During #5, an orphaned pre-fix `ts-node` worker kept polling and ran tasks with the old timeouts. During #7, nodemon reloaded before `.env` existed, and the worker failed with missing API keys.
- **Impact:** confusing local results ("fixed" bugs come back, enrichment fails), and debugging time lost to processes left running.
- **Proposal:**
  - S: add a `pnpm worker` script separate from the API, add `.env` to nodemon's watch list, and document `temporal task-queue describe --task-queue myQueue` in the README.
  - M: make the task queue name configurable per environment and developer.
- **Priority:** P2 (for the team)
- **Deferred in:** [#5](https://github.com/Genesy-AI/technical-task-rodrigo/pull/5), [#7](https://github.com/Genesy-AI/technical-task-rodrigo/pull/7)

### IMP-10 · Validation logic duplicated in frontend and backend

- **Problem:** the ISO country list, `parseYearsAtCompany` and `parseLinkedinUrl` are copied in `frontend/src/utils/csvParser.ts` and `backend/src/utils/`, because the two packages share no code.
- **Impact:** if the copies drift, the CSV preview shows the wrong warnings. The backend still decides what is saved, so the data stays correct, but every rule change has to be made twice.
- **Proposal:**
  - M: `POST /leads/bulk?dryRun=true` returns per-row warnings, and the frontend stops validating. This also covers IMP-11.
  - M (alternative): a root pnpm workspace with a `shared/` package.
- **Priority:** P3
- **Deferred in:** [#4](https://github.com/Genesy-AI/technical-task-rodrigo/pull/4), [#6](https://github.com/Genesy-AI/technical-task-rodrigo/pull/6)

### IMP-11 · `/leads/bulk` doesn't report dropped values

- **Problem:** invalid optional values (country, years, LinkedIn) are set to null without telling the caller. Only the CSV preview warns about them.
- **Impact:** API clients and scripts lose data without knowing it.
- **Proposal:**
  - S: add `warnings: [{ row, field, value }]` to the response.
- **Priority:** P3
- **Deferred in:** [#6](https://github.com/Genesy-AI/technical-task-rodrigo/pull/6)

### IMP-12 · Phones are not normalized (E.164)

- **Problem:** phones are saved exactly as typed (`(731)123-9702`, `+1-280-754-0462x2154`). Nimbus returns a number without a dial code, and its `countryCode` (`ES`) is dropped.
- **Impact:** no click-to-call, no dedupe by phone, and the same number can appear in several formats.
- **Proposal:**
  - M: add `libphonenumber-js`, parse with the lead's `countryCode` (or the provider's) as the default region, and store an E.164 value next to the raw value, keeping the extension.
- **Priority:** P3
- **Deferred in:** [#6](https://github.com/Genesy-AI/technical-task-rodrigo/pull/6), [#7](https://github.com/Genesy-AI/technical-task-rodrigo/pull/7)

### IMP-13 · No integration test for `enrichPhoneWorkflow`

- **Problem:** #7 tests the waterfall order (`phoneChain.test.ts`) and the adapters (`phone.test.ts`), but not the workflow itself: the status writes, the retries, and what happens when a provider fails.
- **Impact:** a change to the activity options or status writes can break without any test failing. Email verification already has this kind of test.
- **Proposal:**
  - S: add a `@temporalio/testing` time-skipping test like `workflows.test.ts`, with mocked `lookupPhone` and `savePhoneEnrichment`, covering found, not_found and failed.
- **Priority:** P3
- **Deferred in:** [#7](https://github.com/Genesy-AI/technical-task-rodrigo/pull/7)

### IMP-14 · `pnpm lint` is broken

- **Problem:** the frontend uses ESLint 9 with a legacy `.eslintrc.cjs`, so `pnpm lint` fails. The editor also shows Biome warnings, while the project formats with Prettier.
- **Impact:** lint is not checked at all, and contributors see two different sets of warnings.
- **Proposal:**
  - S: migrate to `eslint.config.js` (flat config) and add a `biome.json` that turns Biome off for this repo.
- **Priority:** P3

## Later

### IMP-15 · No proactive per-provider rate limiting

- **Problem:** rate limits are only handled after the fact: a 429 is retried after `Retry-After`. A burst of 429s uses up the 3 attempts, and the provider is skipped.
- **Impact:** bulk enrichment skips providers that would have found the number, which costs coverage on large selections.
- **Proposal:**
  - S: allow more attempts only for `RateLimited` failures.
  - M: give each provider its own task queue (`phone-orion`, …) with a worker that sets `maxTaskQueueActivitiesPerSecond` to that provider's limit, and have the workflow choose the queue in `proxyActivities`.
- **Priority:** P3. Revisit when providers publish their limits or selections get large.
- **Deferred in:** [#7](https://github.com/Genesy-AI/technical-task-rodrigo/pull/7)

### IMP-16 · Leads table has too many columns

- **Problem:** `LeadsList.tsx` now has 11 hardcoded columns and scrolls sideways.
- **Impact:** key columns are off-screen, and every new field makes it worse.
- **Proposal:**
  - M: build a "Columns" menu from `TEMPLATE_FIELDS` and save the choice in localStorage.
- **Priority:** P3
- **Deferred in:** [#6](https://github.com/Genesy-AI/technical-task-rodrigo/pull/6)

### IMP-17 · Composer preview only shows the first lead

- **Problem:** `MessageTemplateModal` only previews the first selected lead.
- **Impact:** users can't see how the message reads for the leads that have empty fields.
- **Proposal:**
  - S: add prev/next buttons, and make each empty-field warning jump to an affected lead.
- **Priority:** P3
- **Deferred in:** [#6](https://github.com/Genesy-AI/technical-task-rodrigo/pull/6)

### IMP-18 · CSV import modal accessibility

- **Problem:** `CsvImportModal.tsx` has clickable `div`s with no keyboard support, buttons with no `type`, SVG icons with no title, and uses the array index as the row `key`.
- **Impact:** keyboard and screen reader users can't import a CSV.
- **Proposal:**
  - S: use real `<button type="button">`, add `aria-label`s, and use a stable row key.
- **Priority:** P3
