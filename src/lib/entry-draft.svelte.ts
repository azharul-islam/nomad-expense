import { browser } from '$app/environment';

export type EntryKind = 'expense' | 'income' | 'lent' | 'borrowed';

interface EntryDraft {
	amount: string;
	kind: EntryKind;
	paymentMethod: 'cash' | 'card';
	cardId: string | null;
	personId: string | null;
	personName: string;
	note: string;
	dueDate: string;
}

const STORAGE_KEY = 'expense-tracker:entry-draft';

function loadDraft(): EntryDraft {
	if (!browser) {
		return {
			amount: '',
			kind: 'expense',
			paymentMethod: 'cash',
			cardId: null,
			personId: null,
			personName: '',
			note: '',
			dueDate: ''
		};
	}
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw) {
			const d = JSON.parse(raw);
			if (typeof d?.amount === 'string') {
				const kindOk =
					d.kind === 'expense' || d.kind === 'income' || d.kind === 'lent' || d.kind === 'borrowed';
				return {
					amount: d.amount,
					kind: kindOk ? d.kind : 'expense',
					paymentMethod: d.paymentMethod === 'card' ? 'card' : 'cash',
					cardId: typeof d.cardId === 'string' ? d.cardId : null,
					personId: typeof d.personId === 'string' ? d.personId : null,
					personName: typeof d.personName === 'string' ? d.personName : '',
					note: typeof d.note === 'string' ? d.note : '',
					dueDate: typeof d.dueDate === 'string' ? d.dueDate : ''
				};
			}
		}
	} catch {
		// ignore corrupt drafts
	}
	return {
		amount: '',
		kind: 'expense',
		paymentMethod: 'cash',
		cardId: null,
		personId: null,
		personName: '',
		note: '',
		dueDate: ''
	};
}

class EntryDraftStore {
	// Non-reactive mirror so mutators never read the field they are about to write —
	// this keeps $effect-driven sync free of update loops.
	private plain: EntryDraft = loadDraft();
	draft = $state<EntryDraft>(this.plain);
	justAdded = $state(false);
	private justAddedTimer: ReturnType<typeof setTimeout> | null = null;

	get amount() {
		return this.draft.amount;
	}
	get kind() {
		return this.draft.kind;
	}
	get paymentMethod() {
		return this.draft.paymentMethod;
	}
	get cardId() {
		return this.draft.cardId;
	}
	get personId() {
		return this.draft.personId;
	}
	get personName() {
		return this.draft.personName;
	}
	get note() {
		return this.draft.note;
	}
	get dueDate() {
		return this.draft.dueDate;
	}

	markJustAdded() {
		this.justAdded = true;
		if (this.justAddedTimer) clearTimeout(this.justAddedTimer);
		this.justAddedTimer = setTimeout(() => {
			this.justAdded = false;
		}, 1600);
	}

	update(patch: Partial<EntryDraft>) {
		this.plain = { ...this.plain, ...patch };
		this.draft = this.plain;
		if (browser) localStorage.setItem(STORAGE_KEY, JSON.stringify(this.plain));
	}

	reset() {
		this.plain = {
			amount: '',
			kind: 'expense',
			paymentMethod: 'cash',
			cardId: null,
			personId: null,
			personName: '',
			note: '',
			dueDate: ''
		};
		this.draft = this.plain;
		if (browser) localStorage.removeItem(STORAGE_KEY);
	}
}

export const entryDraft = new EntryDraftStore();
