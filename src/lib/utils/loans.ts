import type { Loan, LoanPayment } from '$lib/db';

/** Normalised key used to detect duplicate people (case/space-insensitive). */
export function normalizePersonName(name: string): string {
	return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Map of loanId -> total amount repaid. */
export function paidByLoan(payments: LoanPayment[]): Map<string, number> {
	const map = new Map<string, number>();
	for (const payment of payments) {
		map.set(payment.loanId, (map.get(payment.loanId) ?? 0) + payment.amount);
	}
	return map;
}

/** Remaining amount on a loan; may go negative if it was overpaid. */
export function loanRemaining(loan: Loan, paid: Map<string, number> | LoanPayment[]): number {
	const paidMap = Array.isArray(paid) ? paidByLoan(paid) : paid;
	return loan.amount - (paidMap.get(loan.id) ?? 0);
}

/** Outstanding (never negative) per loan, for display and status. */
export function outstandingByLoan(loans: Loan[], payments: LoanPayment[]): Map<string, number> {
	const paid = paidByLoan(payments);
	const map = new Map<string, number>();
	for (const loan of loans) {
		map.set(loan.id, Math.max(0, loan.amount - (paid.get(loan.id) ?? 0)));
	}
	return map;
}

/**
 * Gross outstanding balance split by loan direction — the two sides never cancel.
 * lent: money still owed to you (asset); borrowed: money you still owe (liability).
 * Repayments reduce only the side their loan belongs to; overpayments clamp at zero.
 */
export function outstandingByDirection(
	loans: Loan[],
	payments: LoanPayment[],
	currency?: string
): { lent: number; borrowed: number } {
	const paid = paidByLoan(payments);
	let lent = 0;
	let borrowed = 0;
	for (const loan of loans) {
		if (currency && loan.currency !== currency) continue;
		const remaining = Math.max(0, loan.amount - (paid.get(loan.id) ?? 0));
		if (loan.direction === 'lent') lent += remaining;
		else borrowed += remaining;
	}
	return { lent, borrowed };
}

/**
 * Net balance per person.
 * Positive => they owe you; negative => you owe them.
 * Lent adds to what they owe, borrowed subtracts, and repayments reduce the matching loan.
 */
export function balanceByPerson(loans: Loan[], payments: LoanPayment[]): Map<string, number> {
	const paid = paidByLoan(payments);
	const map = new Map<string, number>();
	for (const loan of loans) {
		const remaining = loan.amount - (paid.get(loan.id) ?? 0);
		const signed = loan.direction === 'lent' ? remaining : -remaining;
		map.set(loan.personId, (map.get(loan.personId) ?? 0) + signed);
	}
	return map;
}

/** Aggregate totals across all people. */
export function totalsByPerson(balances: Map<string, number>): {
	receivable: number;
	payable: number;
} {
	let receivable = 0;
	let payable = 0;
	for (const value of balances.values()) {
		if (value > 0) receivable += value;
		else if (value < 0) payable += -value;
	}
	return { receivable, payable };
}

/**
 * Net cash-flow impact of loans on the wallet balance (money currently in hand).
 * Positive => money came into your wallet (borrowed, not yet repaid); negative
 * => money left your wallet (lent, not yet returned). Per loan:
 * lent => payments - amount, borrowed => amount - payments.
 * Unpaid principal (and overpayments) are counted exactly, never clamped.
 */
export function walletImpactByLoan(
	loans: Loan[],
	payments: LoanPayment[],
	currency?: string
): number {
	const paid = paidByLoan(payments);
	let impact = 0;
	for (const loan of loans) {
		if (currency && loan.currency !== currency) continue;
		const remaining = loan.amount - (paid.get(loan.id) ?? 0);
		impact += loan.direction === 'lent' ? -remaining : remaining;
	}
	return impact;
}

/** A loan is overdue when it still has money outstanding and its due date has passed. */
export function isOverdue(loan: Loan, outstanding: number, now: number = Date.now()): boolean {
	return outstanding > 0 && loan.dueDate !== null && loan.dueDate < now;
}

/** Set of person ids that currently have at least one overdue loan. */
export function overduePersonIds(
	loans: Loan[],
	outstanding: Map<string, number>,
	now: number = Date.now()
): Set<string> {
	const set = new Set<string>();
	for (const loan of loans) {
		if (isOverdue(loan, outstanding.get(loan.id) ?? 0, now)) set.add(loan.personId);
	}
	return set;
}
