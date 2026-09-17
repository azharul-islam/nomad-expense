export const CURRENCY = 'QAR';
export const CURRENCY_SYMBOL = 'QR';

/**
 * Format cents to a currency display string with comma separators.
 * e.g. formatCurrency(123456) -> "1,234.56"
 */
export function formatCurrency(cents: number, type?: 'income' | 'expense'): string {
	const isNegative = cents < 0 || (type === 'expense' && cents >= 0);
	const absCents = Math.abs(cents);
	const riyals = Math.floor(absCents / 100);
	const remainingDirhams = absCents % 100;
	const formatted = `${riyals.toLocaleString('en-QA')}.${remainingDirhams.toString().padStart(2, '0')}`;
	return isNegative ? `-${formatted}` : formatted;
}

/**
 * Split a currency string into integer and decimal parts.
 */
export function splitCurrency(formatted: string): [string, string] {
	const parts = formatted.split('.');
	return [parts[0], parts[1] || '00'];
}

/**
 * Parse a raw input string into display parts for the keypad.
 * The dot and each decimal digit color independently based on user input state.
 */
export function formatCurrencyInput(amount: string): {
	integerPart: string;
	dec1: string;
	dec2: string;
	dotActive: boolean;
	decimalDigitsEntered: number;
} {
	if (amount === '') {
		return { integerPart: '0', dec1: '0', dec2: '0', dotActive: false, decimalDigitsEntered: 0 };
	}

	const hasDecimal = amount.includes('.');
	const [intStr, decStr = ''] = amount.split('.');

	// Format integer part with commas
	const parsedInt = parseInt(intStr || '0', 10);
	const integerPart = parsedInt.toLocaleString('en-QA');

	if (!hasDecimal) {
		return { integerPart, dec1: '0', dec2: '0', dotActive: false, decimalDigitsEntered: 0 };
	}

	// In decimal mode — always pad to 2 chars
	const paddedDec = decStr.slice(0, 2).padEnd(2, '0');
	return {
		integerPart,
		dec1: paddedDec[0],
		dec2: paddedDec[1],
		dotActive: true,
		decimalDigitsEntered: Math.min(decStr.length, 2)
	};
}

/**
 * Parse a display/edit value back to cents.
 *
 * Accepts strings (keypad/display callers) as well as numbers: `bind:value` on an
 * `<input type="number">` yields a number (and `undefined` when cleared), so a
 * string-only signature made edit forms throw instead of saving.
 */
export function parseAmountToCents(val: string | number | null | undefined): number {
	if (val === null || val === undefined) return 0;
	// Strip thousand separators (",") and stray whitespace so "1,234.56" parses as 123456.
	const cleaned = String(val).trim().replace(/,/g, '').replace(/\s+/g, '');
	if (cleaned === '') return 0;
	const parsed = parseFloat(cleaned);
	if (isNaN(parsed)) return 0;
	return Math.round(parsed * 100);
}
