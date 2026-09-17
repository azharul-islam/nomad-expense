# Loans & Lending — Feature Plan

> **Status: implemented.** One unified keypad-first wizard records Expense / Income / Lent / Borrowed.
> Balances are separated per tab: the Tracker shows **Income / Expense / Net** (income − expense) only —
> loans no longer affect it. The Loans tab shows **Lent** and **Borrowed** as **gross outstanding
> balances** (the two sides never cancel), plus a net lending position; the person-detail
> Lent/Borrowed summary is outstanding-based to match its ledger.
> Users dial an amount on the Tracker, then choose the kind in `/add` with progressive disclosure
> (payment method + card for expense/income; person + due date for loans).
> Loans live behind the **Loans** top tab; repayments settle per loan.
>
> **Data safety:** IndexedDB migrated additively to **v2** (new `people`, `loans`,
> `loanPayments` stores — existing transactions/cards untouched). Export now offers a full
> **JSON backup** (transactions, cards, people, loans, payments) while the legacy **CSV** still
> imports unchanged. Import auto-detects either file type.
>
> **PWA:** prerendered pages use absolute asset paths (`kit.paths.relative = false`) and the
> service worker precaches the route-agnostic SPA fallback (`adapterFallback: 'index.html'`,
> `spa: true`) so deep/dynamic routes work offline too.

## User stories

### Core

- **US-1 Record a loan** — Quickly record money I **lent to** or **borrowed from** someone: amount first (keypad), then who + optional note/due date.
- **US-2 Reuse people (no duplicates)** — I type a person's name once; next time they appear in a picker so I never create a duplicate. Matching is case/space-insensitive.
- **US-3 Per-person total** — I open a person and see the **total they owe me** (or I owe them), plus every loan and repayment.
- **US-4 Overview** — I see everyone with net balances and a summary of **total owed to me / by me**, sorted by relevance, searchable.
- **US-5 Partial repayments** — I record a partial repayment against a specific loan; the loan's outstanding and the person's balance update.
- **US-6 Settle up** — One tap settles a loan (or a whole person) in full.
- **US-7 Short & long term** — I can set an optional due date; overdue loans are highlighted.
- **US-8 Edit / delete** — I can edit or delete loans, repayments, and people (cascade), and rename a person.
- **US-9 Filter** — Filter the list to "They owe me" / "I owe them" and search by name.

### Data & portability (hard requirements)

- **US-10 Existing data preserved** — Upgrading keeps every existing transaction/card; nothing is reset. If a migration is needed it happens gracefully.
- **US-11 Full backup** — One backup file contains transactions, cards, people, loans and repayments, and restores all of it.
- **US-12 Legacy compatibility** — A CSV exported by the current version still imports correctly.
- **US-13 Clear all** — Clearing data also clears loans/people.

## Data model (IndexedDB v2 — additive migration)

- `people`: { id, name, nameKey (normalised), color, createdAt }
- `loans`: { id, personId, direction: 'lent'|'borrowed', amount (cents), currency, note, dueDate|null, createdAt } — indexes by-person, by-date
- `loanPayments`: { id, loanId, personId, amount (cents), note, createdAt } — indexes by-loan, by-person

The v1 → v2 upgrade only **creates new stores**, so existing transactions/cards are untouched.

### Balance math (pure, unit-tested)

- outstanding(loan) = amount − Σ payments(loan) (clamped at 0 for display)
- personBalance = Σ lent.outstanding − Σ borrowed.outstanding (positive ⇒ they owe you)
- totals = Σ positive balances (receivable), Σ |negative| (payable)
- outstandingByDirection(loans) = { lent: Σ lent.outstanding, borrowed: Σ borrowed.outstanding } —
  **gross per side, never netted**; repayments reduce only their own side.
- **Tracker balance** = income − expense (primary currency only). Loans are excluded entirely.
- **Loans summary** = lent outstanding (money still owed to you) vs borrowed outstanding (money you
  still owe), plus a net lending position (lent − borrowed).

## Phases

- **A. Data model + migration** — db.ts v2, types, indexes.
- **B. Pure math + store** — utils/loans.ts, loans.svelte.ts (CRUD, derived balances, person dedupe).
- **C. Navigation + overview** — Loans top tab; /loans summary, filters, search, people list, New Loan CTA.
- **D. Entry wizard** — loan-draft store; /loans/new (keypad + Lent/Borrowed); /loans/new/details (person + note + due date).
- **E. Person detail + repayments** — /loans/[id] ledger, record payment via keypad route, settle up, edit/delete.
- **F. Export/import** — full JSON backup + legacy CSV kept; auto-detecting importer; ImportModal + Data settings.
- **G. QC** — unit tests (math, JSON round-trip, legacy CSV, dedupe), e2e flows, fresh-context review agent, check/lint/build/offline.
