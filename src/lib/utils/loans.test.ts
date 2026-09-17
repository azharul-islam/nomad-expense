import { describe, it, expect } from 'vitest';
import type { Loan, LoanPayment } from '$lib/db';
import {
	normalizePersonName,
	paidByLoan,
	loanRemaining,
	outstandingByLoan,
	outstandingByDirection,
	balanceByPerson,
	totalsByPerson,
	walletImpactByLoan,
	isOverdue
} from './loans';

function loan(overrides: Partial<Loan> = {}): Loan {
	return {
		id: 'l1',
		personId: 'p1',
		direction: 'lent',
		amount: 10000,
		currency: 'QAR',
		note: '',
		dueDate: null,
		createdAt: 1,
		...overrides
	};
}

function payment(overrides: Partial<LoanPayment> = {}): LoanPayment {
	return {
		id: 'pay1',
		loanId: 'l1',
		personId: 'p1',
		amount: 2500,
		note: '',
		createdAt: 2,
		...overrides
	};
}

describe('normalizePersonName', () => {
	it('trims, collapses spaces and lowercases', () => {
		expect(normalizePersonName('  Alice   Smith ')).toBe('alice smith');
	});
	it('treats different whitespace/case as the same person', () => {
		expect(normalizePersonName('ALICE')).toBe(normalizePersonName('alice'));
	});
});

describe('paidByLoan / loanRemaining / outstandingByLoan', () => {
	it('sums payments per loan', () => {
		const paid = paidByLoan([payment({ amount: 1000 }), payment({ id: 'pay2', amount: 500 })]);
		expect(paid.get('l1')).toBe(1500);
	});

	it('computes remaining and clamps outstanding at zero', () => {
		const l = loan({ amount: 10000 });
		const payments = [payment({ amount: 2500 })];
		expect(loanRemaining(l, payments)).toBe(7500);
		expect(outstandingByLoan([l], payments).get('l1')).toBe(7500);

		const overpaid = [payment({ amount: 12000 })];
		expect(loanRemaining(l, overpaid)).toBe(-2000);
		expect(outstandingByLoan([l], overpaid).get('l1')).toBe(0);
	});
});

describe('balanceByPerson', () => {
	it('positive when they owe you', () => {
		const balances = balanceByPerson([loan({ amount: 5000 })], []);
		expect(balances.get('p1')).toBe(5000);
	});

	it('subtracts borrowed money', () => {
		const balances = balanceByPerson(
			[
				loan({ id: 'a', amount: 5000, direction: 'lent' }),
				loan({ id: 'b', amount: 2000, direction: 'borrowed' })
			],
			[]
		);
		expect(balances.get('p1')).toBe(3000);
	});

	it('nets repayments against the matching loan', () => {
		const balances = balanceByPerson(
			[loan({ id: 'a', amount: 5000 }), loan({ id: 'b', amount: 2000, direction: 'borrowed' })],
			[payment({ loanId: 'a', amount: 5000 }), payment({ id: 'pay2', loanId: 'b', amount: 2000 })]
		);
		expect(balances.get('p1')).toBe(0);
	});

	it('can go negative when you owe them', () => {
		const balances = balanceByPerson([loan({ amount: 3000, direction: 'borrowed' })], []);
		expect(balances.get('p1')).toBe(-3000);
	});

	it('keeps people independent', () => {
		const balances = balanceByPerson(
			[
				loan({ id: 'a', personId: 'p1', amount: 5000 }),
				loan({ id: 'b', personId: 'p2', amount: 1000, direction: 'borrowed' })
			],
			[]
		);
		expect(balances.get('p1')).toBe(5000);
		expect(balances.get('p2')).toBe(-1000);
	});
});

describe('outstandingByDirection', () => {
	it('splits gross outstanding per direction without netting the same person', () => {
		const loans = [
			loan({ id: 'a', amount: 5000, direction: 'lent' }),
			loan({ id: 'b', amount: 2000, direction: 'borrowed' })
		];
		expect(outstandingByDirection(loans, [])).toEqual({ lent: 5000, borrowed: 2000 });
	});

	it('reduces each side only by repayments on its own loans', () => {
		const loans = [
			loan({ id: 'a', amount: 10000, direction: 'lent' }),
			loan({ id: 'b', amount: 2000, direction: 'borrowed' })
		];
		const payments = [
			payment({ id: 'pay1', loanId: 'a', amount: 2500 }),
			payment({ id: 'pay2', loanId: 'b', amount: 800 })
		];
		expect(outstandingByDirection(loans, payments)).toEqual({ lent: 7500, borrowed: 1200 });
	});

	it('clamps overpayments at zero per loan', () => {
		expect(
			outstandingByDirection(
				[loan({ amount: 10000, direction: 'lent' })],
				[payment({ amount: 12000 })]
			)
		).toEqual({ lent: 0, borrowed: 0 });
	});

	it('aggregates across people', () => {
		const loans = [
			loan({ id: 'a', personId: 'p1', amount: 5000, direction: 'lent' }),
			loan({ id: 'b', personId: 'p2', amount: 4000, direction: 'lent' }),
			loan({ id: 'c', personId: 'p3', amount: 3000, direction: 'borrowed' })
		];
		expect(
			outstandingByDirection(loans, [payment({ id: 'pay1', loanId: 'b', amount: 1000 })])
		).toEqual({ lent: 8000, borrowed: 3000 });
	});

	it('ignores loans in other currencies when a currency is given', () => {
		const loans = [
			loan({ amount: 5000, currency: 'USD', direction: 'lent' }),
			loan({ amount: 3000, currency: 'QAR', direction: 'borrowed' })
		];
		expect(outstandingByDirection(loans, [], 'QAR')).toEqual({ lent: 0, borrowed: 3000 });
	});
});

describe('totalsByPerson', () => {
	it('splits receivable and payable', () => {
		const totals = totalsByPerson(
			new Map([
				['p1', 5000],
				['p2', -2000],
				['p3', 0]
			])
		);
		expect(totals).toEqual({ receivable: 5000, payable: 2000 });
	});
});

describe('isOverdue', () => {
	it('true only when outstanding and past due', () => {
		const now = 1_000_000;
		expect(isOverdue(loan({ dueDate: now - 1 }), 100, now)).toBe(true);
		expect(isOverdue(loan({ dueDate: now - 1 }), 0, now)).toBe(false);
		expect(isOverdue(loan({ dueDate: now + 1 }), 100, now)).toBe(false);
		expect(isOverdue(loan({ dueDate: null }), 100, now)).toBe(false);
	});
});
describe('walletImpactByLoan', () => {
	it('lending takes money out of the wallet', () => {
		expect(walletImpactByLoan([loan({ amount: 5000 })], [])).toBe(-5000);
	});

	it('borrowing brings money into the wallet', () => {
		expect(walletImpactByLoan([loan({ amount: 2000, direction: 'borrowed' })], [])).toBe(2000);
	});

	it('repayments flow back into the wallet (lent -> they pay you)', () => {
		expect(walletImpactByLoan([loan({ amount: 10000 })], [payment({ amount: 2500 })])).toBe(-7500);
		expect(walletImpactByLoan([loan({ amount: 5000 })], [payment({ amount: 5000 })])).toBe(0);
	});

	it('repaying a borrowed loan takes money back out', () => {
		const l = loan({ id: 'b', amount: 2000, direction: 'borrowed' });
		const payments = [payment({ id: 'pay1', loanId: 'b', amount: 800 })];
		expect(walletImpactByLoan([l], payments)).toBe(1200);
	});

	it('nets out across multiple loans and people', () => {
		const loans = [
			loan({ id: 'a', personId: 'p1', amount: 5000 }),
			loan({ id: 'b', personId: 'p2', amount: 2000, direction: 'borrowed' })
		];
		expect(walletImpactByLoan(loans, [payment({ loanId: 'a', amount: 3000 })])).toBe(0);
	});

	it('counts overpayments exactly', () => {
		expect(walletImpactByLoan([loan({ amount: 10000 })], [payment({ amount: 12000 })])).toBe(2000);
		const b = loan({ id: 'b', amount: 10000, direction: 'borrowed' });
		expect(walletImpactByLoan([b], [payment({ id: 'pay1', loanId: 'b', amount: 12000 })])).toBe(
			-2000
		);
	});

	it('ignores loans in other currencies', () => {
		expect(walletImpactByLoan([loan({ amount: 5000, currency: 'USD' })], [], 'QAR')).toBe(0);
		expect(walletImpactByLoan([loan({ amount: 5000, currency: 'QAR' })], [], 'QAR')).toBe(-5000);
	});
});
