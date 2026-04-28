<script lang="ts">
	import { parseCSV, type ParsedImportData } from '$lib/utils/import';

	interface Props {
		onClose: () => void;
		onImport: (data: ParsedImportData, mode: 'replace' | 'append') => Promise<void>;
	}

	let { onClose, onImport }: Props = $props();

	let file = $state<File | null>(null);
	let parsedData = $state<ParsedImportData | null>(null);
	let importMode = $state<'replace' | 'append'>('append');
	let parsing = $state(false);
	let importing = $state(false);
	let error = $state<string | null>(null);

	function handleFileChange(e: Event) {
		const target = e.target as HTMLInputElement;
		const selected = target.files?.[0];
		if (!selected) return;

		const ext = selected.name.split('.').pop()?.toLowerCase();
		if (ext !== 'csv') {
			error = 'Only CSV files are supported';
			return;
		}

		file = selected;
		error = null;
		parsedData = null;
		parseFile(selected);
	}

	async function parseFile(f: File) {
		parsing = true;
		try {
			parsedData = await parseCSV(f);
			if (parsedData.errors.length > 0 && parsedData.transactions.length === 0) {
				error = parsedData.errors.join('\n');
			}
		} catch {
			error = 'Failed to parse file';
		} finally {
			parsing = false;
		}
	}

	async function handleImport() {
		if (!parsedData || parsedData.transactions.length === 0) return;

		importing = true;
		try {
			await onImport(parsedData, importMode);
			onClose();
		} catch {
			error = 'Failed to import data';
		} finally {
			importing = false;
		}
	}

	function formatDate(timestamp: number): string {
		return new Date(timestamp).toLocaleDateString([], {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}
</script>

<div
	class="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
	role="button"
	tabindex="0"
	onclick={onClose}
	onkeydown={(e) => e.key === 'Escape' && onClose()}
>
	<div
		class="w-full max-w-lg rounded-t-2xl bg-white dark:bg-slate-800 sm:rounded-2xl"
		role="dialog"
		aria-modal="true"
		aria-label="Import data"
	>
		<div class="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-slate-700">
			<h2 class="text-lg font-semibold text-gray-900 dark:text-white">Import Data</h2>
			<button
				class="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-slate-700 dark:hover:text-white"
				aria-label="Close"
				onclick={onClose}
			>
				<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>

		<div class="px-4 py-4">
			{#if error}
				<div class="mb-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-600 dark:bg-rose-900/30 dark:text-rose-400">
					{error}
				</div>
			{/if}

			<div class="mb-4">
				<label for="csv-file-input" class="mb-2 block text-sm font-medium text-gray-700 dark:text-slate-300">
					Select CSV File
				</label>
				<input
					id="csv-file-input"
					type="file"
					accept=".csv"
					class="block w-full text-sm text-gray-500 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-blue-600 hover:file:bg-blue-100 dark:text-slate-400 dark:file:bg-slate-700 dark:file:text-sky-400 dark:hover:file:bg-slate-600"
					onchange={handleFileChange}
				/>
			</div>

			{#if parsing}
				<div class="flex items-center justify-center py-8 text-sm text-gray-500 dark:text-slate-400">
					<svg class="mr-2 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
						<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
					</svg>
					Parsing file...
				</div>
			{/if}

			{#if parsedData && parsedData.transactions.length > 0}
				<div class="mb-4 rounded-lg bg-gray-50 p-4 dark:bg-slate-700/50">
					<h3 class="mb-2 text-sm font-semibold text-gray-900 dark:text-white">Import Summary</h3>
					<div class="space-y-1 text-sm text-gray-600 dark:text-slate-300">
						<p><span class="font-mono">{parsedData.summary.transactionCount}</span> transactions</p>
						{#if parsedData.summary.cardCount > 0}
							<p><span class="font-mono">{parsedData.summary.cardCount}</span> cards</p>
						{/if}
						{#if parsedData.summary.dateRange}
							<p>
								{formatDate(parsedData.summary.dateRange.earliest)} — {formatDate(parsedData.summary.dateRange.latest)}
							</p>
						{/if}
					</div>

					{#if parsedData.errors.length > 0}
						<div class="mt-3 border-t border-gray-200 pt-3 dark:border-slate-600">
							<p class="mb-1 text-xs font-medium text-amber-600 dark:text-amber-400">
								{parsedData.errors.length} warning(s):
							</p>
							<ul class="max-h-24 overflow-y-auto text-xs text-amber-600 dark:text-amber-400">
								{#each parsedData.errors.slice(0, 5) as err}
									<li>{err}</li>
								{/each}
								{#if parsedData.errors.length > 5}
									<li>...and {parsedData.errors.length - 5} more</li>
								{/if}
							</ul>
						</div>
					{/if}
				</div>

				<div class="mb-4">
					<p class="mb-2 text-sm font-medium text-gray-700 dark:text-slate-300">Import Mode</p>
					<div class="flex gap-2">
						<button
							class="flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors {importMode === 'append'
								? 'border-blue-500 bg-blue-50 text-blue-600 dark:border-sky-500 dark:bg-sky-900/30 dark:text-sky-400'
								: 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'}"
							onclick={() => (importMode = 'append')}
						>
							Append
						</button>
						<button
							class="flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors {importMode === 'replace'
								? 'border-rose-500 bg-rose-50 text-rose-600 dark:border-rose-500 dark:bg-rose-900/30 dark:text-rose-400'
								: 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'}"
							onclick={() => (importMode = 'replace')}
						>
							Replace All
						</button>
					</div>
					<p class="mt-1 text-xs text-gray-500 dark:text-slate-400">
						{importMode === 'append'
							? 'Add imported data to existing transactions'
							: 'Delete all existing data and replace with imported data'}
					</p>
				</div>

				<div class="flex gap-2">
					<button
						class="flex-1 rounded-lg bg-gray-100 py-2.5 text-sm font-semibold text-gray-600 dark:bg-slate-700 dark:text-slate-300"
						onclick={onClose}
					>
						Cancel
					</button>
					<button
						class="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50 dark:bg-sky-600"
						disabled={importing}
						onclick={handleImport}
					>
						{#if importing}
							<span class="flex items-center justify-center">
								<svg class="mr-2 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
									<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
									<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
								</svg>
								Importing...
							</span>
						{:else}
							Import
						{/if}
					</button>
				</div>
			{/if}
		</div>
	</div>
</div>
