import {
	getAllPeople,
	getAllLoans,
	getAllLoanPayments,
	addPerson as dbAddPerson,
	updatePerson as dbUpdatePerson,
	deletePerson as dbDeletePerson,
	addLoan as dbAddLoan,
	updateLoan as dbUpdateLoan,
	deleteLoan as dbDeleteLoan,
	addLoanPayment as dbAddLoanPayment,
	updateLoanPayment as dbUpdateLoanPayment,
	deleteLoanPayment as dbDeleteLoanPayment,
	bulkAddPeople,
	bulkAddLoans,
	bulkAddLoanPayments,
	clearAllPeople,
	clearAllLoans,
	clearAllLoanPayments,
	generateUUID,
	type Person,
	type Loan,
	type LoanPayment,
	type LoanDirection
} from './db';
import {
	balanceByPerson,
	isOverdue,
	normalizePersonName,
	outstandingByDirection,
	outstandingByLoan,
	totalsByPerson
} from './utils/loans';

const PERSON_COLORS = [
	'#3b82f6',
	'#10b981',
	'#f59e0b',
	'#ef4444',
	'#8b5cf6',
	'#ec4899',
	'#06b6d4',
	'#f97316'
];

function colorFor(nameKey: string): string {
	let hash = 0;
	for (let i = 0; i < nameKey.length; i++) hash = (hash * 31 + nameKey.charCodeAt(i)) >>> 0;
	return PERSON_COLORS[hash % PERSON_COLORS.length];
}

export interface PersonWithBalance extends Person {
	/** Positive => they owe you; negative => you owe them. */
	balance: number;
	lent: number;
	borrowed: number;
	loanCount: number;
	lastActivity: number;
}

export interface LoanWithStatus extends Loan {
	outstanding: number;
	overdue: boolean;
}

class LoansStore {
	people = $state<Person[]>([]);
	loans = $state<Loan[]>([]);
	payments = $state<LoanPayment[]>([]);
	initialized = $state(false);
	loading = $state(false);
	private initPromise: Promise<void> | null = null;
	private currency = 'QAR';

	private balances = $derived(balanceByPerson(this.loans, this.payments));
	private outstanding = $derived(outstandingByLoan(this.loans, this.payments));

	/** { receivable: money owed to you, payable: money you owe } */
	totals = $derived(totalsByPerson(this.balances));

	/** Gross outstanding split by direction — lent and borrowed never cancel each other. */
	private ledgerTotals = $derived(outstandingByDirection(this.loans, this.payments));

	/** Money still owed to you across all lent loans. */
	lentOutstanding = $derived(this.ledgerTotals.lent);
	/** Money you still owe across all borrowed loans. */
	borrowedOutstanding = $derived(this.ledgerTotals.borrowed);

	hasAny = $derived(this.people.length > 0 || this.loans.length > 0);

	peopleWithBalance = $derived.by<PersonWithBalance[]>(() => {
		const result = this.people.map((person) => {
			let lent = 0;
			let borrowed = 0;
			let loanCount = 0;
			let lastActivity = person.createdAt;
			for (const loan of this.loans) {
				if (loan.personId !== person.id) continue;
				loanCount++;
				if (loan.createdAt > lastActivity) lastActivity = loan.createdAt;
				const remaining = this.outstanding.get(loan.id) ?? 0;
				if (loan.direction === 'lent') lent += remaining;
				else borrowed += remaining;
			}
			return {
				...person,
				balance: this.balances.get(person.id) ?? 0,
				lent,
				borrowed,
				loanCount,
				lastActivity
			};
		});
		// Most relevant first: biggest absolute balance, then most recent activity.
		return result.sort(
			(a, b) =>
				Math.abs(b.balance) - Math.abs(a.balance) ||
				b.lastActivity - a.lastActivity ||
				a.name.localeCompare(b.name)
		);
	});

	init(): Promise<void> {
		if (this.initialized) return Promise.resolve();
		if (this.initPromise) return this.initPromise;
		this.initPromise = this._init();
		return this.initPromise;
	}

	private async _init() {
		try {
			this.loading = true;
			const [people, loans, payments] = await Promise.all([
				getAllPeople(),
				getAllLoans(),
				getAllLoanPayments()
			]);
			this.people = people;
			this.loans = loans;
			this.payments = payments;
			this.initialized = true;
		} catch (err) {
			console.error('Loans store init failed:', err);
			this.initialized = true;
			throw err;
		} finally {
			this.loading = false;
			this.initPromise = null;
		}
	}

	// ---- People ----
	findPersonByName(name: string): Person | undefined {
		const key = normalizePersonName(name);
		return this.people.find((p) => p.nameKey === key);
	}

	/** Returns an existing person matching the name (case/space-insensitive) or creates one. */
	async ensurePerson(name: string): Promise<{ person: Person; created: boolean }> {
		const trimmed = name.trim().replace(/\s+/g, ' ');
		const existing = this.findPersonByName(trimmed);
		if (existing) return { person: existing, created: false };

		const person = await dbAddPerson({
			name: trimmed,
			nameKey: normalizePersonName(trimmed),
			color: colorFor(normalizePersonName(trimmed)),
			createdAt: Date.now()
		});
		this.people = [...this.people, person];
		return { person, created: true };
	}

	async renamePerson(id: string, name: string) {
		const trimmed = name.trim().replace(/\s+/g, ' ');
		const existing = this.findPersonByName(trimmed);
		if (existing && existing.id !== id) {
			throw new Error('A person with that name already exists');
		}
		const updated = await dbUpdatePerson(id, {
			name: trimmed,
			nameKey: normalizePersonName(trimmed)
		});
		if (updated) this.people = this.people.map((p) => (p.id === id ? updated : p));
		return updated;
	}

	async removePerson(id: string) {
		const loanIds = this.loans.filter((l) => l.personId === id).map((l) => l.id);
		for (const payment of this.payments) {
			if (payment.personId === id) await dbDeleteLoanPayment(payment.id);
		}
		for (const loanId of loanIds) await dbDeleteLoan(loanId);
		await dbDeletePerson(id);
		this.payments = this.payments.filter((p) => p.personId !== id);
		this.loans = this.loans.filter((l) => l.personId !== id);
		this.people = this.people.filter((p) => p.id !== id);
	}

	// ---- Loans ----
	async addLoan(input: {
		personId: string;
		direction: LoanDirection;
		amount: number;
		currency?: string;
		note?: string;
		dueDate?: number | null;
	}) {
		const loan = await dbAddLoan({
			personId: input.personId,
			direction: input.direction,
			amount: input.amount,
			currency: input.currency ?? this.currency,
			note: input.note?.trim() ?? '',
			dueDate: input.dueDate ?? null,
			createdAt: Date.now()
		});
		this.loans = [loan, ...this.loans];
		return loan;
	}

	async updateLoan(id: string, updates: Partial<Omit<Loan, 'id'>>) {
		const updated = await dbUpdateLoan(id, updates);
		if (updated) this.loans = this.loans.map((l) => (l.id === id ? updated : l));
		return updated;
	}

	async removeLoan(id: string) {
		for (const payment of this.payments) {
			if (payment.loanId === id) await dbDeleteLoanPayment(payment.id);
		}
		await dbDeleteLoan(id);
		this.payments = this.payments.filter((p) => p.loanId !== id);
		this.loans = this.loans.filter((l) => l.id !== id);
	}

	// ---- Payments ----
	/** Repay a loan. Amount is capped at the outstanding balance unless overpay=true. */
	async addPayment(loanId: string, amount: number, note = '', overpay = false) {
		const loan = this.loans.find((l) => l.id === loanId);
		if (!loan) throw new Error('Loan not found');
		const outstanding = this.outstandingForLoan(loanId);
		const capped = overpay ? amount : Math.min(amount, outstanding);
		if (capped <= 0) throw new Error('Nothing left to repay');

		const payment = await dbAddLoanPayment({
			loanId,
			personId: loan.personId,
			amount: capped,
			note: note.trim(),
			createdAt: Date.now()
		});
		this.payments = [payment, ...this.payments];
		return payment;
	}

	async removePayment(id: string) {
		await dbDeleteLoanPayment(id);
		this.payments = this.payments.filter((p) => p.id !== id);
	}

	async updatePayment(id: string, updates: Partial<Omit<LoanPayment, 'id'>>) {
		const updated = await dbUpdateLoanPayment(id, updates);
		if (updated) {
			this.payments = this.payments.map((p) => (p.id === id ? updated : p));
		}
		return updated;
	}

	// ---- Selectors ----
	outstandingForLoan(loanId: string): number {
		return this.outstanding.get(loanId) ?? 0;
	}

	balanceForPerson(personId: string): number {
		return this.balances.get(personId) ?? 0;
	}

	loansForPerson(personId: string): LoanWithStatus[] {
		const now = Date.now();
		return this.loans
			.filter((l) => l.personId === personId)
			.map((loan) => {
				const outstanding = this.outstandingForLoan(loan.id);
				return {
					...loan,
					outstanding,
					overdue: isOverdue(loan, outstanding, now)
				};
			})
			.sort((a, b) => b.createdAt - a.createdAt);
	}

	paymentsForLoan(loanId: string): LoanPayment[] {
		return this.payments
			.filter((p) => p.loanId === loanId)
			.sort((a, b) => b.createdAt - a.createdAt);
	}

	paymentsForPerson(personId: string): LoanPayment[] {
		return this.payments
			.filter((p) => p.personId === personId)
			.sort((a, b) => b.createdAt - a.createdAt);
	}

	// ---- Backup / restore ----
	async importData(
		data: { people: Person[]; loans: Loan[]; payments: LoanPayment[] },
		mode: 'replace' | 'append'
	) {
		// Ensure people/loans are loaded so name-matching and id remaps are accurate.
		await this.init();

		if (mode === 'replace') {
			await clearAllPeople();
			await clearAllLoans();
			await clearAllLoanPayments();
			this.people = [];
			this.loans = [];
			this.payments = [];
		}

		// Remap incoming person ids to existing (matched by name) or freshly created people.
		const personIdMap = new Map<string, string>();
		for (const incoming of data.people) {
			const existing = this.findPersonByName(incoming.name);
			if (existing) {
				personIdMap.set(incoming.id, existing.id);
				continue;
			}
			const created = await dbAddPerson({
				name: incoming.name,
				nameKey: incoming.nameKey || normalizePersonName(incoming.name),
				color: incoming.color || colorFor(normalizePersonName(incoming.name)),
				createdAt: incoming.createdAt || Date.now()
			});
			personIdMap.set(incoming.id, created.id);
			this.people = [...this.people, created];
		}

		// Insert loans with remapped people, collecting a loan-id remap.
		const loanIdMap = new Map<string, string>();
		const newLoans: Loan[] = data.loans.map((loan) => ({
			...loan,
			id: generateUUID(),
			personId: personIdMap.get(loan.personId) ?? loan.personId,
			createdAt: loan.createdAt || Date.now()
		}));
		for (let i = 0; i < data.loans.length; i++) {
			loanIdMap.set(data.loans[i].id, newLoans[i].id);
		}
		if (newLoans.length > 0) await bulkAddLoans(newLoans);
		this.loans = [...this.loans, ...newLoans].sort((a, b) => b.createdAt - a.createdAt);

		// Insert payments with remapped loan/person ids.
		const newPayments: LoanPayment[] = data.payments.map((payment) => ({
			...payment,
			id: generateUUID(),
			loanId: loanIdMap.get(payment.loanId) ?? payment.loanId,
			personId: personIdMap.get(payment.personId) ?? payment.personId,
			createdAt: payment.createdAt || Date.now()
		}));
		if (newPayments.length > 0) await bulkAddLoanPayments(newPayments);
		this.payments = [...this.payments, ...newPayments].sort((a, b) => b.createdAt - a.createdAt);
	}

	async clearAll() {
		await clearAllPeople();
		await clearAllLoans();
		await clearAllLoanPayments();
		this.people = [];
		this.loans = [];
		this.payments = [];
	}
}

export const loansStore = new LoansStore();
