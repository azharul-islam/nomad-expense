import { describe, it, expect } from 'vitest';
import { parseAmountToCents } from './currency';

describe('parseAmountToCents', () => {
	it('handles plain decimals', () => {
		expect(parseAmountToCents('12.5')).toBe(1250);
		expect(parseAmountToCents('0.05')).toBe(5);
	});
	it('strips thousand separators (loan edit regression)', () => {
		expect(parseAmountToCents('1,234.56')).toBe(123456);
		expect(parseAmountToCents('9,999,999')).toBe(999999900);
	});
	it('is safe with whitespace and empties', () => {
		expect(parseAmountToCents(' 42 ')).toBe(4200);
		expect(parseAmountToCents('')).toBe(0);
		expect(parseAmountToCents('abc')).toBe(0);
	});
	it('accepts numbers from <input type="number"> bindings (edit-save regression)', () => {
		expect(parseAmountToCents(34.5)).toBe(3450);
		expect(parseAmountToCents(1234.56)).toBe(123456);
		expect(parseAmountToCents(0.05)).toBe(5);
		// Svelte clears a number binding to undefined when the field is emptied.
		expect(parseAmountToCents(undefined)).toBe(0);
		expect(parseAmountToCents(null)).toBe(0);
	});
});
