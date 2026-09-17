# Plan: Separate Income/Expense and Lending/Borrowing Balances

> **Status: implemented** (defaults from §2 were adopted). Changelog: Tracker shows Income / Expense /
> Net cards (loans excluded); Loans overview shows gross Lent / Borrowed outstanding plus net lending;
> person-detail Lent/Borrowed summary is outstanding-based; e2e balance test rewritten; unit tests added.
> Goal: stop tracking one mixed "wallet balance" and instead show, per tab, the balances
> each tab actually tracks: the Tracker shows the income/expense picture, the Loans tab
> shows the lending/borrowing picture. The stored ledger (IndexedDB) is untouched — this
> is a pure presentation/derivation change.

## 1. Current state (findings)

- `src/lib/stores.svelte.ts` derives a **single combined balance**:
  `balance = (Σ income − Σ expense, QAR-only) + walletImpactByLoan(loans, payments)`.
  Lending lowers it, borrowing raises it, repayments reverse both. This is the number
  shown at the top of the Tracker (`BalanceDisplay.svelte`, testid `wallet-balance`).
- The **Loans** tab already has two summary cards ("They owe you" / "You owe"), but they
  are computed with **per-person netting** (`totalsByPerson(balanceByPerson(...))`):
  lent and borrowed can cancel _within the same person_ (lend Ali 100, borrow 50 from
  Ali → shows 50 owed to you, hiding both ledgers).
- Person detail header shows "Lent X · borrowed Y" from **original principals**
  (`l.amount`), so repayments do not reduce that summary — inconsistent with the
  outstanding-based balances and per-loan ledger below it.
- All balances are **derived** from stored records (IndexedDB v2: `transactions`,
  `loans`, `loanPayments`). Nothing balance-like is written to storage.

## 2. Target semantics (recommended defaults — adjustable)

| Tab         | Shows                                                                    | Meaning                                                                     |
| ----------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| **Tracker** | Income card, Expense card, small Net line                                | `income − expense`; **loans do not enter this number at all**               |
| **Loans**   | "Lent (outstanding)" card, "Borrowed (outstanding)" card, small net line | **Gross** outstanding per direction — the two sides never cancel each other |
| History     | unchanged                                                                | already separates Total Income / Total Expenses                             |

- **Old combined wallet balance: removed.** Nothing on the Tracker counts loans any more;
  nothing on Loans counts income/expense.
- Per-person list, filters, search, per-loan outstanding, overdue logic: **unchanged**.

### The two feasibility questions I'd confirm (answered with defaults)

1. _Tracker layout:_ Income + Expense cards **plus** a net line (recommended) rather than
   only two cards or only one net figure.
2. _Loans math:_ **gross outstanding per side** (recommended, ledger-correct) rather than
   keeping the current per-person netting. Gross never lets lent and borrowed cancel.

## 3. Ledger-integrity guarantees ("maintain all the ledger correctly")

- **No schema change, no DB migration, no stored-value rewrite.** Backup JSON/CSV export
  and import are byte-for-byte unaffected; round-trip tests keep passing untouched.
- Every new selector stays a **pure function operating on the stored records**, unit-tested.
- Fix the person-detail inconsistency: "Lent / Borrowed" summary becomes
  **outstanding-based** (principal − repayments), matching the ledger rows below it.
- Delete/edit/repay flows keep working; balances recompute reactively from the same data.

## 4. Changes by file

1. **`src/lib/stores.svelte.ts`** — drop `walletImpactByLoan` from the balance.
   Keep `incomeTotal` / `expenseTotal`; add `netBalance = incomeTotal − expenseTotal`
   (QAR-scoped, same as today). Rename/remove the combined `balance`.
2. **`src/lib/utils/loans.ts`** — add `outstandingByDirection(loans, payments)`
   → `{ lent, borrowed }` (gross outstanding, per loan direction, never negative per
   loan, overpayments clamped for display as today). Keep `walletImpactByLoan` (still
   unit-tested; no longer used by UI) or remove its production import.
   Add `outstandingForPersonDirection(...)` for the person-detail summary.
3. **`src/lib/loans.svelte.ts`** — expose `lentOutstanding` / `borrowedOutstanding`
   derived from the new utility; keep `totals` (still used by per-person logic if needed).
4. **`src/lib/components/BalanceDisplay.svelte`** — layout change: two stat cards
   (Money in / Money out) + net line. New testids (e.g. `income-balance`,
   `expense-balance`, `tracker-net-balance`). Remove `wallet-balance`.
5. **`src/routes/+page.svelte`** — consumes `BalanceDisplay`; helper text tweaks only.
6. **`src/routes/loans/+page.svelte`** — header cards switch to gross
   Lent/Borrowed outstanding (labels "Lent (outstanding)" / "Borrowed (outstanding)");
   optional net position line; chips/search/person rows unchanged.
7. **`src/routes/loans/[id]/+page.svelte`** — "Lent X · borrowed Y" becomes
   outstanding-based; net balance display unchanged.
8. **`src/routes/history/+page.svelte`** — unchanged (per recommended scope).
9. **Tests**
   - `e2e/add-transaction.e2e.ts`: rewrite "wallet balance moves with loans and
     repayments" → "tracker balance ignores loans; loans tab reflects them"; update testids.
   - `src/lib/utils/loans.test.ts`: add `outstandingByDirection` cases (lent/borrowed/
     mixed people/partial+full repayments/overpay/currency); keep existing tests.
   - `e2e/backup-roundtrip.e2e.ts`: no change expected (verify in run).
10. **Docs** — update `docs/loans-feature-plan.md` "Balance math" section; this plan
    doubles as the change record.

## 5. Verification

- `bun run check` (svelte-check), `bun run test:unit`, `bun run test:e2e`,
  `bun run lint`, `bun run build`.
- Manual pass: add income/expense/lent/borrowed/repayment; confirm Tracker ignores loans,
  Loans tab shows gross sides, person detail outstanding summary, reload persistence.

## 6. Risks

- The single biggest regression surface is `e2e/add-transaction.e2e.ts` (balance test)
  and any page relying on the combined number — both handled explicitly above.
- `walletImpactByLoan` becomes UI-unused; kept unit-tested (pure math) so future
  "net position" views can reuse it without resurrecting the mixed balance.
