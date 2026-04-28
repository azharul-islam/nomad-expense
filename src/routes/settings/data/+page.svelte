<script lang="ts">
	import { goto } from '$app/navigation';
	import { transactionStore } from '$lib/stores.svelte';
	import { exportToCSV, downloadCSV } from '$lib/utils/export';
	import ImportModal from '$lib/components/ImportModal.svelte';
	import type { ParsedImportData } from '$lib/utils/import';

	let showImportModal = $state(false);
	let showClearConfirm = $state(false);
	let exporting = $state(false);
	let clearing = $state(false);
	let notification = $state<{ type: 'success' | 'error'; message: string } | null>(null);

	function showNotification(type: 'success' | 'error', message: string) {
		notification = { type, message };
		setTimeout(() => {
			notification = null;
		}, 3000);
	}

	async function handleExportCSV() {
		if (transactionStore.transactions.length === 0) {
			showNotification('error', 'No transactions to export');
			return;
		}

		exporting = true;
		try {
			await transactionStore.init();
			const csv = exportToCSV(transactionStore.transactions, transactionStore.cards);
			const date = new Date().toISOString().split('T')[0];
			downloadCSV(csv, `expense-tracker-${date}.csv`);
			showNotification('success', 'Exported successfully');
		} catch {
			showNotification('error', 'Failed to export');
		} finally {
			exporting = false;
		}
	}

	async function handleImport(data: ParsedImportData, mode: 'replace' | 'append') {
		await transactionStore.importData(data.transactions, data.cards, mode);
		showNotification('success', `Imported ${data.summary.transactionCount} transactions`);
	}

	async function handleClearAll() {
		clearing = true;
		try {
			await transactionStore.clearAllData();
			showNotification('success', 'All data cleared');
		} catch {
			showNotification('error', 'Failed to clear data');
		} finally {
			clearing = false;
			showClearConfirm = false;
		}
	}
</script>

<div class="flex h-full flex-col overflow-hidden bg-gray-100 text-gray-900 dark:bg-slate-950 dark:text-white">
	<div class="flex-1 overflow-y-auto overscroll-contain px-4 pt-16 pb-4">
		<button
			class="mb-4 flex items-center gap-1 text-sm text-blue-600 transition-colors active:text-blue-700 dark:text-sky-400 dark:active:text-sky-300"
			onclick={() => goto('/settings')}
		>
			<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
			</svg>
			Settings
		</button>
		<h1 class="mb-6 text-3xl font-bold tracking-tight">Data</h1>

		{#if notification}
			<div
				class="mb-4 rounded-lg p-3 text-sm {notification.type === 'success'
					? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
					: 'bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400'}"
			>
				{notification.message}
			</div>
		{/if}

		<!-- Export Section -->
		<div class="mb-6">
			<p class="mb-2 px-3 text-xs font-medium text-gray-400 uppercase dark:text-slate-400">Export</p>
			<div class="overflow-hidden rounded-2xl bg-white shadow-sm dark:bg-slate-800/60">
				<button
					class="flex w-full items-center justify-between px-4 py-3.5 text-left transition-colors active:bg-gray-50 dark:active:bg-slate-700 {transactionStore.transactions.length === 0 ? 'opacity-50' : ''}"
					disabled={transactionStore.transactions.length === 0 || exporting}
					onclick={handleExportCSV}
				>
					<div class="flex items-center gap-3">
						<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 dark:bg-sky-900/30">
							<svg class="h-4 w-4 text-blue-600 dark:text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
							</svg>
						</div>
						<div>
							<span class="text-base text-gray-900 dark:text-white">Export as CSV</span>
							<p class="text-xs text-gray-500 dark:text-slate-400">
								{transactionStore.transactions.length} transactions
							</p>
						</div>
					</div>
					{#if exporting}
						<svg class="h-5 w-5 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
						</svg>
					{:else}
						<svg class="h-5 w-5 text-gray-400 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
						</svg>
					{/if}
				</button>
			</div>
		</div>

		<!-- Import Section -->
		<div class="mb-6">
			<p class="mb-2 px-3 text-xs font-medium text-gray-400 uppercase dark:text-slate-400">Import</p>
			<div class="overflow-hidden rounded-2xl bg-white shadow-sm dark:bg-slate-800/60">
				<button
					class="flex w-full items-center justify-between px-4 py-3.5 text-left transition-colors active:bg-gray-50 dark:active:bg-slate-700"
					onclick={() => (showImportModal = true)}
				>
					<div class="flex items-center gap-3">
						<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50 dark:bg-purple-900/30">
							<svg class="h-4 w-4 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
							</svg>
						</div>
						<div>
							<span class="text-base text-gray-900 dark:text-white">Import from CSV</span>
							<p class="text-xs text-gray-500 dark:text-slate-400">Append or replace existing data</p>
						</div>
					</div>
					<svg class="h-5 w-5 text-gray-400 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
					</svg>
				</button>
			</div>
		</div>

		<!-- Danger Zone -->
		<div class="mb-6">
			<p class="mb-2 px-3 text-xs font-medium text-rose-400 uppercase">Danger Zone</p>
			<div class="overflow-hidden rounded-2xl border border-rose-200 bg-white shadow-sm dark:border-rose-900/50 dark:bg-slate-800/60">
				<button
					class="flex w-full items-center justify-between px-4 py-3.5 text-left transition-colors active:bg-rose-50 dark:active:bg-rose-900/20"
					onclick={() => (showClearConfirm = true)}
				>
					<div class="flex items-center gap-3">
						<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 dark:bg-rose-900/30">
							<svg class="h-4 w-4 text-rose-600 dark:text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
							</svg>
						</div>
						<div>
							<span class="text-base text-rose-600 dark:text-rose-400">Clear All Data</span>
							<p class="text-xs text-rose-500/70 dark:text-rose-400/70">Permanently delete all transactions and cards</p>
						</div>
					</div>
					<svg class="h-5 w-5 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
					</svg>
				</button>
			</div>
		</div>
	</div>

	{#if showImportModal}
		<ImportModal
			onClose={() => (showImportModal = false)}
			onImport={handleImport}
		/>
	{/if}

	{#if showClearConfirm}
		<div
			class="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
			role="button"
			tabindex="0"
			onclick={() => (showClearConfirm = false)}
			onkeydown={(e) => e.key === 'Escape' && (showClearConfirm = false)}
		>
			<div
				class="w-full max-w-sm rounded-t-2xl bg-white p-5 dark:bg-slate-800 sm:rounded-2xl"
				role="dialog"
				aria-modal="true"
				aria-label="Clear all data confirmation"
			>
				<h3 class="mb-2 text-lg font-semibold text-gray-900 dark:text-white">Clear All Data?</h3>
				<p class="mb-4 text-sm text-gray-600 dark:text-slate-300">
					This will permanently delete all {transactionStore.transactions.length} transactions and reset your cards. This action cannot be undone.
				</p>
				<div class="flex gap-2">
					<button
						class="flex-1 rounded-lg bg-gray-100 py-2.5 text-sm font-semibold text-gray-600 dark:bg-slate-700 dark:text-slate-300"
						onclick={() => (showClearConfirm = false)}
					>
						Cancel
					</button>
					<button
						class="flex-1 rounded-lg bg-rose-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
						disabled={clearing}
						onclick={handleClearAll}
					>
						{#if clearing}
							<span class="flex items-center justify-center">
								<svg class="mr-2 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
									<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
									<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
								</svg>
								Clearing...
							</span>
						{:else}
							Clear All
						{/if}
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>
