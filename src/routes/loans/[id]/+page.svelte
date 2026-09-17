<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { loansStore } from '$lib/loans.svelte';
	import type { Loan, LoanPayment } from '$lib/db';
	import {
		CURRENCY_SYMBOL,
		formatCurrency,
		parseAmountToCents,
		splitCurrency
	} from '$lib/utils/currency';

	const personId = $derived($page.params.id);
	const person = $derived(loansStore.people.find((p) => p.id === personId));
	const balance = $derived(loansStore.balanceForPerson(personId ?? ''));
	const loans = $derived(loansStore.loansForPerson(personId ?? ''));
	const balanceParts = $derived(splitCurrency(formatCurrency(Math.abs(balance))));

	let renaming = $state(false);
	let nameDraft = $state('');
	let editingLoanId = $state<string | null>(null);
	let editingPaymentId = $state<string | null>(null);
	let editPayAmount = $state('');
	let editPayNote = $state('');
	let editAmount = $state('');
	let editNote = $state('');
	let editDueDate = $state('');
	let deletingPerson = $state(false);
	let busy = $state(false);
	let errorMessage = $state('');

	const outstandingTotal = $derived(loans.reduce((sum, l) => sum + l.outstanding, 0));

	function startRename() {
		if (!person) return;
		nameDraft = person.name;
		renaming = true;
	}

	async function saveRename() {
		if (!person || !nameDraft.trim()) return;
		errorMessage = '';
		try {
			await loansStore.renamePerson(person.id, nameDraft);
			renaming = false;
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Could not rename';
		}
	}

	async function deletePersonFlow() {
		if (!person) return;
		if (!confirm('Delete ' + person.name + ' and all their loans and payments?')) return;
		await loansStore.removePerson(person.id);
		goto('/loans');
	}

	function startEditPayment(payment: LoanPayment) {
		editingPaymentId = payment.id;
		editingLoanId = null;
		editPayAmount = (payment.amount / 100).toFixed(2);
		editPayNote = payment.note;
	}

	async function saveEditPayment(payment: LoanPayment) {
		const cents = parseAmountToCents(editPayAmount);
		if (cents <= 0) return;
		await loansStore.updatePayment(payment.id, { amount: cents, note: editPayNote });
		editingPaymentId = null;
	}

	function startEdit(loan: Loan) {
		editingLoanId = loan.id;
		editAmount = (loan.amount / 100).toFixed(2);
		editNote = loan.note;
		editDueDate = loan.dueDate ? new Date(loan.dueDate).toISOString().slice(0, 10) : '';
	}

	async function saveEdit(loan: Loan) {
		const cents = parseAmountToCents(editAmount);
		if (cents <= 0) return;
		await loansStore.updateLoan(loan.id, {
			amount: cents,
			note: editNote,
			dueDate: editDueDate ? new Date(editDueDate + 'T23:59:59').getTime() : null
		});
		editingLoanId = null;
	}

	async function deleteLoan(loan: Loan) {
		if (!confirm('Delete this loan? Any repayments on it will also be removed.')) return;
		await loansStore.removeLoan(loan.id);
		if (editingLoanId === loan.id) editingLoanId = null;
	}

	async function settleLoan(loan: Loan) {
		const outstanding = loansStore.outstandingForLoan(loan.id);
		if (outstanding > 0) await loansStore.addPayment(loan.id, outstanding, 'Settled up');
	}

	async function settleAll() {
		if (outstandingTotal === 0) return;
		busy = true;
		errorMessage = '';
		try {
			for (const loan of loans) {
				if (loan.outstanding > 0)
					await loansStore.addPayment(loan.id, loan.outstanding, 'Settled up');
			}
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Failed to settle';
		} finally {
			busy = false;
		}
	}

	function formatDate(ts: number): string {
		return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
	}
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape') {
			if (renaming) renaming = false;
			else if (editingLoanId) editingLoanId = null;
		}
	}}
/>

<div class="flex h-full flex-col overflow-hidden bg-background">
	{#if !person}
		<div class="flex h-full items-center justify-center text-sm text-muted-foreground">
			Not found
		</div>
	{:else}
		<!-- Header -->
		<header class="shrink-0 border-b border-border px-5 pt-4 pb-3">
			<div class="flex items-center gap-3">
				<span
					class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white"
					style="background-color:{person.color}"
				>
					{person.name.charAt(0).toUpperCase()}
				</span>
				<div class="min-w-0 flex-1">
					{#if renaming}
						<div class="flex items-center gap-2">
							<input
								type="text"
								class="min-w-0 flex-1 rounded-xl border border-input bg-card px-3 py-2 text-lg font-bold text-foreground focus:border-ring focus:outline-none"
								bind:value={nameDraft}
							/>
							<button
								class="rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
								onclick={saveRename}
							>
								Save
							</button>
							<button
								class="rounded-xl bg-card px-3 py-2 text-sm font-semibold text-muted-foreground"
								onclick={() => (renaming = false)}
							>
								Cancel
							</button>
						</div>
					{:else}
						<div class="flex items-center gap-2">
							<h1 class="truncate text-xl font-bold text-foreground">{person.name}</h1>
							<button
								class="flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground transition-colors active:bg-accent"
								aria-label="Rename"
								onclick={startRename}
							>
								<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
									/>
								</svg>
							</button>
						</div>
					{/if}
					<p class="mt-0.5 text-xs text-muted-foreground">
						Lent {CURRENCY_SYMBOL}{formatCurrency(
							loans.reduce((s, l) => s + (l.direction === 'lent' ? l.outstanding : 0), 0)
						)}
						· borrowed
						{CURRENCY_SYMBOL}{formatCurrency(
							loans.reduce((s, l) => s + (l.direction === 'borrowed' ? l.outstanding : 0), 0)
						)}
					</p>
				</div>
				<button
					class="flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground transition-colors active:bg-destructive/10 active:text-destructive"
					aria-label="Delete person"
					onclick={deletePersonFlow}
				>
					<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
						/>
					</svg>
				</button>
			</div>

			<!-- Net balance -->
			<div class="mt-3 flex items-baseline justify-center gap-2">
				<span class="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
					{balance > 0 ? 'Owes you' : balance < 0 ? 'You owe' : 'Settled'}
				</span>
				<span
					class="font-mono text-4xl font-bold {balance > 0
						? 'text-success'
						: balance < 0
							? 'text-destructive'
							: 'text-muted-foreground'}"
				>
					{CURRENCY_SYMBOL}
					{balanceParts[0]}<span class="text-2xl">.{balanceParts[1]}</span>
				</span>
			</div>

			<!-- Actions -->
			<div class="mt-3 flex gap-2">
				<button
					class="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-primary text-base font-bold text-primary-foreground shadow-sm transition-all active:scale-[0.99]"
					onclick={() => goto('/?kind=lent&person=' + person.id)}
				>
					<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 4v16m8-8H4"
						/>
					</svg>
					Add loan
				</button>
				<button
					class="flex h-12 flex-1 items-center justify-center rounded-full border-2 border-input bg-card text-base font-bold text-foreground transition-colors active:bg-accent {outstandingTotal ===
						0 || busy
						? 'opacity-50'
						: ''}"
					disabled={outstandingTotal === 0 || busy}
					onclick={settleAll}
				>
					Settle up
				</button>
			</div>

			{#if errorMessage}
				<div
					class="mt-2 rounded-xl bg-destructive/10 px-3.5 py-2.5 text-sm font-medium text-destructive"
				>
					{errorMessage}
				</div>
			{/if}
		</header>

		<!-- Ledger -->
		<div class="hide-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-3">
			{#if loans.length === 0}
				<div class="flex h-full flex-col items-center justify-center px-6 text-center">
					<p class="text-sm text-muted-foreground">No loans with {person.name} yet.</p>
					<p class="mt-1 text-xs text-muted-foreground">Tap "Add loan" to record one.</p>
				</div>
			{:else}
				<div class="flex flex-col gap-3">
					{#each loans as loan (loan.id)}
						<div class="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
							<div class="flex items-center gap-3 px-4 py-3">
								<div
									class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl {loan.direction ===
									'lent'
										? 'bg-success/10 text-success'
										: 'bg-destructive/10 text-destructive'}"
								>
									{#if loan.direction === 'lent'}
										<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M17 8l4 4-4 4M21 12H3"
											/>
										</svg>
									{:else}
										<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M7 16l-4-4 4-4m17 4H3"
											/>
										</svg>
									{/if}
								</div>
								<div class="min-w-0 flex-1">
									<div class="flex items-center gap-2">
										<p
											class="text-sm font-semibold {loan.direction === 'lent'
												? 'text-success'
												: 'text-destructive'}"
										>
											{loan.direction === 'lent' ? 'Lent' : 'Borrowed'}
										</p>
										{#if loan.overdue}
											<span
												class="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive"
											>
												overdue
											</span>
										{/if}
									</div>
									<p class="truncate text-sm text-muted-foreground">
										{loan.note || (loan.direction === 'lent' ? 'Money out' : 'Money in')}
									</p>
									{#if loan.dueDate}
										<p class="text-xs text-muted-foreground">Due {formatDate(loan.dueDate)}</p>
									{/if}
								</div>
								<div class="shrink-0 text-right">
									<p class="font-mono text-[15px] font-bold text-foreground">
										{CURRENCY_SYMBOL}{formatCurrency(loan.amount)}
									</p>
									<p
										class="text-xs font-medium {loan.outstanding > 0
											? 'text-muted-foreground'
											: 'text-success'}"
									>
										{loan.outstanding > 0 ? formatCurrency(loan.outstanding) + ' left' : 'settled'}
									</p>
								</div>
							</div>

							{#if editingLoanId === loan.id}
								<div class="border-t border-border/60 px-4 py-3">
									<div class="mb-2">
										<label
											for="edit-amount"
											class="mb-1 block text-xs font-medium text-muted-foreground">Amount</label
										>
										<input
											id="edit-amount"
											type="number"
											step="0.01"
											inputmode="decimal"
											class="w-full rounded-xl border border-input bg-background px-3 py-2 text-base text-foreground focus:border-ring focus:outline-none"
											bind:value={editAmount}
										/>
									</div>
									<div class="mb-2">
										<label
											for="edit-note"
											class="mb-1 block text-xs font-medium text-muted-foreground">Note</label
										>
										<input
											id="edit-note"
											type="text"
											class="w-full rounded-xl border border-input bg-background px-3 py-2 text-base text-foreground focus:border-ring focus:outline-none"
											bind:value={editNote}
										/>
									</div>
									<div class="mb-3">
										<label
											for="edit-due"
											class="mb-1 block text-xs font-medium text-muted-foreground">Due date</label
										>
										<input
											id="edit-due"
											type="date"
											class="w-full max-w-full min-w-0 rounded-xl border border-input bg-background px-3 py-2 text-base text-foreground focus:border-ring focus:outline-none [&::-webkit-date-and-time-value]:block [&::-webkit-date-and-time-value]:w-full [&::-webkit-date-and-time-value]:min-w-0 [&::-webkit-date-and-time-value]:text-left"
											bind:value={editDueDate}
										/>
									</div>
									<div class="flex gap-2">
										<button
											class="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground"
											onclick={() => saveEdit(loan)}
										>
											Save
										</button>
										<button
											class="flex-1 rounded-xl bg-card py-2.5 text-sm font-semibold text-muted-foreground"
											onclick={() => (editingLoanId = null)}
										>
											Cancel
										</button>
									</div>
								</div>
							{/if}

							{#if loansStore.paymentsForLoan(loan.id).length > 0}
								<div class="border-t border-border/60 px-4 py-2">
									{#each loansStore.paymentsForLoan(loan.id) as payment (payment.id)}
										{#if editingPaymentId === payment.id}
											<div class="border-t border-border/60 px-4 py-3">
												<div class="mb-2 flex gap-2">
													<input
														id="edit-pay-amount"
														type="number"
														step="0.01"
														inputmode="decimal"
														class="w-1/2 rounded-xl border border-input bg-background px-3 py-2.5 text-base text-foreground focus:border-ring focus:outline-none"
														bind:value={editPayAmount}
														aria-label="Amount"
													/>
													<input
														id="edit-pay-note"
														type="text"
														placeholder="Note"
														class="w-1/2 rounded-xl border border-input bg-background px-3 py-2.5 text-base text-foreground focus:border-ring focus:outline-none"
														bind:value={editPayNote}
													/>
												</div>
												<div class="flex gap-2">
													<button
														class="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground"
														onclick={() => saveEditPayment(payment)}
													>
														Save
													</button>
													<button
														class="flex-1 rounded-xl bg-card py-2.5 text-sm font-semibold text-muted-foreground"
														onclick={() => (editingPaymentId = null)}
													>
														Cancel
													</button>
												</div>
											</div>
										{:else}
											<div class="flex items-center gap-2 py-1">
												<svg
													class="h-3.5 w-3.5 text-success"
													fill="none"
													stroke="currentColor"
													viewBox="0 0 24 24"
												>
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
													/>
												</svg>
												<p class="flex-1 text-xs text-muted-foreground">
													{formatDate(payment.createdAt)}{payment.note ? ' · ' + payment.note : ''}
												</p>
												<span class="font-mono text-xs font-semibold text-success">
													{CURRENCY_SYMBOL}{formatCurrency(payment.amount)}
												</span>
												<button
													class="flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground transition-colors active:bg-accent"
													aria-label="Edit repayment"
													onclick={() => startEditPayment(payment)}
												>
													<svg
														class="h-4 w-4"
														fill="none"
														stroke="currentColor"
														viewBox="0 0 24 24"
													>
														<path
															stroke-linecap="round"
															stroke-linejoin="round"
															stroke-width="2"
															d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
														/>
													</svg>
												</button>
												<button
													class="flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground transition-colors active:text-destructive"
													aria-label="Delete repayment"
													onclick={() => loansStore.removePayment(payment.id)}
												>
													<svg
														class="h-4 w-4"
														fill="none"
														stroke="currentColor"
														viewBox="0 0 24 24"
													>
														<path
															stroke-linecap="round"
															stroke-linejoin="round"
															stroke-width="2"
															d="M6 18L18 6M6 6l12 12"
														/>
													</svg>
												</button>
											</div>
										{/if}
									{/each}
								</div>
							{/if}

							<div class="flex items-center gap-1 border-t border-border/60 px-2 py-1.5">
								<button
									class="flex h-11 flex-1 items-center justify-center gap-1 rounded-lg text-sm font-semibold text-foreground transition-colors active:bg-accent"
									onclick={() => goto('/loans/' + person.id + '/pay?loan=' + loan.id)}
								>
									<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M12 6v12m6-6H6"
										/>
									</svg>
									Payment
								</button>
								{#if loan.outstanding > 0}
									<button
										class="flex h-11 flex-1 items-center justify-center rounded-lg text-sm font-semibold text-success transition-colors active:bg-success/10"
										onclick={() => settleLoan(loan)}
									>
										Settle
									</button>
								{/if}
								<button
									class="flex h-11 items-center justify-center gap-1 rounded-lg px-2 text-sm font-medium text-muted-foreground transition-colors active:bg-accent"
									onclick={() =>
										editingLoanId === loan.id ? (editingLoanId = null) : startEdit(loan)}
								>
									<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
										/>
									</svg>
									Edit
								</button>
								<button
									class="flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground transition-colors active:text-destructive"
									aria-label="Delete loan"
									onclick={() => deleteLoan(loan)}
								>
									<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
										/>
									</svg>
								</button>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Nested screen: back to the loans overview (PWAs have no browser chrome). -->
		<footer
			class="shrink-0 border-t border-border px-5 pt-3"
			style="padding-bottom: max(env(safe-area-inset-bottom), 0.75rem)"
		>
			<button
				class="flex h-14 w-14 items-center justify-center rounded-full border-2 border-border bg-card text-foreground transition-colors active:bg-accent"
				onclick={() => goto('/loans')}
				aria-label="Back to loans"
			>
				<svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M15 19l-7-7 7-7"
					/>
				</svg>
			</button>
		</footer>
	{/if}
</div>
