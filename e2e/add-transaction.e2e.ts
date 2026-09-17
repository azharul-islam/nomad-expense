import { test, expect, type Page } from '@playwright/test';

// Mobile-first PWA: use a phone viewport for every scenario.
test.use({
	viewport: { width: 390, height: 844 },
	isMobile: true,
	hasTouch: true
});

async function openTracker(page: Page) {
	await page.goto('/');
	await expect(page.getByRole('link', { name: 'Tracker' })).toBeVisible();
	await expect(page.getByText('Enter an amount to get started')).toBeVisible();
}

async function dial(page: Page, keys: string[]) {
	for (const k of keys) {
		await page.getByRole('button', { name: k, exact: true }).click();
	}
}

async function openAddScreen(page: Page) {
	await openTracker(page);
	await dial(page, ['1', '2']);
	await page.getByRole('button', { name: 'Continue', exact: true }).click();
	await expect(page).toHaveURL('/add');
	await expect(page.getByRole('heading', { name: 'Add Expense' })).toBeVisible();
}

test('top tabs replace the hamburger and navigate', async ({ page }) => {
	await openTracker(page);

	const tabs = page.locator('nav[aria-label="Primary"] a');
	await expect(tabs).toHaveCount(4);
	// No hidden hamburger <select> remains.
	await expect(page.locator('select')).toHaveCount(0);

	const track = await tabs.filter({ hasText: 'Tracker' }).boundingBox();
	expect(track!.height).toBeGreaterThanOrEqual(44);

	// New Loans tab leads to the loans overview.
	await tabs.filter({ hasText: 'Loans' }).click();
	await expect(page).toHaveURL(/\/loans/);
	await expect(page.getByRole('heading', { name: 'Loans' })).toBeVisible();

	await tabs.filter({ hasText: 'History' }).click();
	await expect(page).toHaveURL(/\/history/);
	await expect(page.getByRole('heading', { name: 'History' })).toBeVisible();

	await page.getByRole('link', { name: 'Settings' }).click();
	await expect(page).toHaveURL(/\/settings/);
	await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
});

test('dialed amount is centered and large; Continue stays disabled until an amount exists', async ({
	page
}) => {
	await openTracker(page);

	const display = page.locator('div').filter({ hasText: /^QR/ }).first();
	const box = await display.boundingBox();
	const centerX = box!.x + box!.width / 2;
	expect(Math.abs(centerX - 195)).toBeLessThan(40); // centered in the 390px viewport

	const fontSizes = await display.evaluate((el) => {
		const sizes = [];
		for (const span of el.querySelectorAll('span')) {
			sizes.push(parseFloat(getComputedStyle(span).fontSize));
		}
		return sizes;
	});
	expect(Math.max(...fontSizes)).toBeGreaterThanOrEqual(44);

	const continueBtn = page.getByRole('button', { name: 'Continue', exact: true });
	await expect(continueBtn).toBeDisabled();

	await dial(page, ['7', '8', 'Decimal point', '5']);
	await expect(continueBtn).toBeEnabled();
});

test('the Add screen is a full page (no overlay widget), Cash is default, presets gray until Card', async ({
	page
}) => {
	await openAddScreen(page);

	// It's a real route, not a floating dialog — the tabs are hidden and no dialog exists.
	expect(await page.getByRole('dialog').count()).toBe(0);
	await expect(page.locator('nav')).toHaveCount(0);

	const viewport = page.viewportSize()!;
	const mainBox = await page.locator('main').boundingBox();
	expect(mainBox!.height).toBeGreaterThanOrEqual(viewport.height - 80);

	// Cash is the promised default; Card is not selected.
	await expect(page.getByRole('button', { name: 'Cash', exact: true })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await expect(page.getByRole('button', { name: 'Card', exact: true })).toHaveAttribute(
		'aria-pressed',
		'false'
	);

	const presets = page.locator('section:has(h2:text-is("Card"))');
	await expect(presets.getByRole('button').first()).toBeDisabled();
	expect(
		parseFloat(await presets.evaluate((el) => getComputedStyle(el).opacity))
	).toBeLessThanOrEqual(0.5);

	// The dialed amount is shown in a big font at the top of the screen.
	await expect(page.locator('header')).toContainText('QR');
	await expect(page.locator('header')).toContainText('12.00');

	// Kind tiles are all the same size; payment segments are all the same size.
	const kindGrid = page.locator('section').first();
	const kindExp = (await kindGrid
		.getByRole('button', { name: 'Expense', exact: true })
		.boundingBox())!.height;
	const kindBorrowed = (await kindGrid
		.getByRole('button', { name: 'Borrowed', exact: true })
		.boundingBox())!.height;
	expect(Math.abs(kindExp - kindBorrowed)).toBeLessThanOrEqual(2);
	const segCash = (await page.getByRole('button', { name: 'Cash', exact: true }).boundingBox())!
		.height;
	const segCard = (await page.getByRole('button', { name: 'Card', exact: true }).boundingBox())!
		.height;
	expect(Math.abs(segCash - segCard)).toBeLessThanOrEqual(2);

	// Note is an optional, compact ~3-line field (not a giant editor).
	const noteBox = await page.getByRole('textbox').boundingBox();
	expect(noteBox!.height).toBeGreaterThanOrEqual(60);
	expect(noteBox!.height).toBeLessThanOrEqual(150);

	// Switch to Card: presets un-gray and the first card is auto-selected.
	await page.getByRole('button', { name: 'Card', exact: true }).click();
	await expect(presets.getByRole('button').first()).toBeEnabled();
	await expect
		.poll(async () => parseFloat(await presets.evaluate((el) => getComputedStyle(el).opacity)), {
			timeout: 2000
		})
		.toBe(1);
	await expect(presets.getByRole('button').first()).toHaveAttribute('aria-pressed', 'true');
});

test('top of the Add screen has no buttons; Back sits beside Confirm and returns instantly', async ({
	page
}) => {
	await openAddScreen(page);

	// The header is title-only.
	await expect(page.locator('header').getByRole('button')).toHaveCount(0);

	const back = page.getByRole('button', { name: 'Back', exact: true });
	const confirm = page.getByRole('button', { name: /Add Expense/ });
	const bb = await back.boundingBox();
	const cb = await confirm.boundingBox();

	// Back is a circle on the left of the wide pill confirm, on the same row and height.
	expect(Math.abs(bb!.width - bb!.height)).toBeLessThanOrEqual(4);
	expect(Math.abs(bb!.height - cb!.height)).toBeLessThanOrEqual(4);
	expect(bb!.x + bb!.width).toBeLessThanOrEqual(cb!.x + 4);
	expect(bb!.y === cb!.y).toBe(true);
	expect(Math.min(cb!.width, cb!.height)).toBeGreaterThanOrEqual(64); // pill confirm is 64px tall

	// Back returns to the tracker immediately, keeping the dialed amount.
	await back.click();
	await expect(page).toHaveURL('/');
	await expect(page.getByText('12', { exact: false }).first()).toBeVisible();

	// Esc does the same from the Add screen.
	await page.getByRole('button', { name: 'Continue', exact: true }).click();
	await expect(page).toHaveURL('/add');
	await page.keyboard.press('Escape');
	await expect(page).toHaveURL('/');
});

test('confirming an expense from the Add screen persists it and resets the keypad', async ({
	page
}) => {
	await openAddScreen(page);

	await page.getByRole('textbox').fill('Groceries');
	await page.getByRole('button', { name: /Add Expense/ }).click();

	await expect(page).toHaveURL('/');
	await expect(page.getByRole('status')).toBeVisible();
	// Keypad reset: Continue is disabled again and the display shows 0.00.
	await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeDisabled();

	await page.getByRole('link', { name: 'History' }).click();
	await expect(page).toHaveURL(/\/history/);
	await expect(page.getByText('Groceries')).toBeVisible();
});

test('income transaction can be added through the Add screen', async ({ page }) => {
	await openAddScreen(page);

	await page.getByRole('button', { name: 'Income', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Income', exact: true })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await page.getByRole('textbox').fill('Salary');
	await page.getByRole('button', { name: /Add Income/ }).click();

	await expect(page).toHaveURL('/');
	await page.getByRole('link', { name: 'History' }).click();
	await expect(page.getByText('Salary')).toBeVisible();
});

test('lending flow: New Loan -> tracker keypad -> unified wizard creates a loan', async ({
	page
}) => {
	// Start from the Loans tab: New Loan deep-links to the tracker with kind=lent.
	await page.goto('/loans');
	await page.getByRole('button', { name: 'New Loan', exact: true }).click();
	await expect(page).toHaveURL(/\/\?kind=lent/);
	// The tracker no longer shows a kind toggle; the kind is picked on /add.
	await expect(page.getByTestId('type-badge')).toHaveCount(0);

	await dial(page, ['5', '0']);
	await page.getByRole('button', { name: 'Continue', exact: true }).click();
	await expect(page).toHaveURL('/add');
	await expect(page.getByRole('heading', { name: 'Add Loan' })).toBeVisible();

	// Progressive disclosure: loan fields appear, payment method does not.
	await expect(page.getByText('Who', { exact: true })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Cash', exact: true })).toHaveCount(0);

	await page.getByRole('button', { name: 'New person', exact: true }).click();
	await page.getByRole('textbox').first().fill('Ali');
	await page.getByRole('button', { name: /Add Loan/ }).click();

	await expect(page).toHaveURL(/\/loans\//);
	await expect(page.getByRole('heading', { name: 'Ali' })).toBeVisible();
	await expect(page.getByText('Owes you', { exact: false })).toBeVisible();
	await expect(page.getByText('50', { exact: false }).first()).toBeVisible();

	// Nested screen exposes its own back control bottom-left (PWAs have no browser chrome).
	const back = page.getByRole('button', { name: 'Back to loans' });
	await expect(back).toBeVisible();
	const backBox = (await back.boundingBox())!;
	expect(backBox.x).toBeLessThan(40);
	await back.click();
	await expect(page).toHaveURL('/loans');
});

test('keypad keys shrink instantly on press and ease back on release', async ({ page }) => {
	await openTracker(page);
	const key = page.getByRole('button', { name: '7', exact: true });
	const box = (await key.boundingBox())!;
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	await page.mouse.down();
	// Press uses the faster 100ms active duration (not the 200ms release one).
	const pressed = await key.evaluate((el) => getComputedStyle(el).transitionDuration);
	expect(pressed).toBe('0.1s');
	// The key is shrinking (active:scale-[0.97]) while held down.
	await expect
		.poll(async () => {
			const scale = parseFloat(await key.evaluate((el) => getComputedStyle(el).scale));
			return Number.isNaN(scale) ? 1 : scale;
		})
		.toBeLessThan(1);
	await page.mouse.up();
	await page.waitForTimeout(20);
	const released = await key.evaluate((el) => getComputedStyle(el).transitionDuration);
	expect(released).toBe('0.2s'); // smooth ease back up
});

test('person dedupe: same name reuses the existing person', async ({ page }) => {
	// Create Ali once via the unified wizard.
	await page.goto('/?kind=lent');
	await dial(page, ['2', '0']);
	await page.getByRole('button', { name: 'Continue', exact: true }).click();
	await page.getByRole('button', { name: 'New person', exact: true }).click();
	await page.getByRole('textbox').first().fill('Ali');
	await page.getByRole('button', { name: /Add Loan/ }).click();
	await expect(page).toHaveURL(/\/loans\//);

	// New loan to the same person: they are offered in the picker.
	await page.goto('/?kind=lent');
	await dial(page, ['3', '0']);
	await page.getByRole('button', { name: 'Continue', exact: true }).click();
	await page.getByRole('button', { name: 'Ali', exact: true }).click();
	await page.getByRole('button', { name: /Add Loan/ }).click();
	await expect(page).toHaveURL(/\/loans\//);

	// Only one Ali exists in the overview.
	await page.goto('/loans');
	const aliRows = page.getByRole('button').filter({ hasText: 'Ali' });
	await expect(aliRows).toHaveCount(1);
	await expect(page.getByTestId('lent-balance')).toBeVisible();
});

test('repayment reduces outstanding and settle zeroes it', async ({ page }) => {
	await page.goto('/?kind=lent');
	await dial(page, ['1', '0', '0']);
	await page.getByRole('button', { name: 'Continue', exact: true }).click();
	await page.getByRole('button', { name: 'New person', exact: true }).click();
	await page.getByRole('textbox').first().fill('Sam');
	await page.getByRole('button', { name: /Add Loan/ }).click();
	await expect(page).toHaveURL(/\/loans\//);
	await expect(page.getByText('100', { exact: false }).first()).toBeVisible();

	// The pay screen offers a full-amount shortcut, then we dial a partial repayment.
	await page.getByRole('button', { name: 'Payment', exact: true }).click();
	await expect(page).toHaveURL(/\/pay/);
	await expect(page.getByRole('button', { name: /Settle with the full amount/ })).toBeVisible();
	await page.keyboard.press('4');
	await page.keyboard.press('0');
	await page.getByRole('button', { name: /Record payment/ }).click();
	await expect(page).toHaveURL(/\/loans\//);
	await expect(page.getByText('60', { exact: false }).first()).toBeVisible();
	await expect(page.getByRole('button', { name: 'Edit repayment' }).first()).toBeVisible();

	// Settle the rest.
	await page.getByRole('button', { name: 'Settle', exact: true }).click();
	await page.waitForTimeout(400);
	await expect(page.getByText('settled', { exact: false }).first()).toBeVisible();
	await expect(page.getByText('Settled', { exact: false }).first()).toBeVisible();
});
test('typing in the payment note does not divert digits into the amount', async ({ page }) => {
	await page.goto('/?kind=lent');
	await dial(page, ['5', '0']);
	await page.getByRole('button', { name: 'Continue', exact: true }).click();
	await page.getByRole('button', { name: 'New person', exact: true }).click();
	await page.getByRole('textbox').first().fill('Noor');
	await page.getByRole('button', { name: /Add Loan/ }).click();
	await expect(page).toHaveURL(/\/loans\//);

	await page.getByRole('button', { name: 'Payment', exact: true }).click();
	await expect(page).toHaveURL(/\/pay/);

	// Regression guard: the keypad's window-level handler used to preventDefault()
	// every digit and Backspace whatever the target was.
	const note = page.getByRole('textbox');
	await note.click();
	await page.keyboard.type('paid 12 back');
	await expect(note).toHaveValue('paid 12 back');
	await expect(page.locator('header')).toContainText('0.00');

	await page.keyboard.press('Backspace');
	await expect(note).toHaveValue('paid 12 bac');

	await note.evaluate((el) => el.blur());
	await page.keyboard.press('7');
	await expect(page.locator('header')).toContainText('7.00');
});

test('tracker balance tracks income/expense only; loans live on the loans tab', async ({
	page
}) => {
	// Income 100 -> tracker shows income 100 and net 100.
	await page.goto('/');
	await dial(page, ['1', '0', '0']);
	await page.getByRole('button', { name: 'Continue', exact: true }).click();
	await page.getByRole('button', { name: 'Income', exact: true }).click();
	await page.getByRole('textbox').fill('Salary');
	await page.getByRole('button', { name: /Add Income/ }).click();
	await expect(page).toHaveURL('/');
	await expect(page.getByTestId('income-balance')).toHaveText(/QR\s*100\.00/);
	await expect(page.getByTestId('expense-balance')).toHaveText(/QR\s*0\.00/);
	await expect(page.getByTestId('tracker-net-balance')).toHaveText(/QR\s*100\.00/);

	// Lending 30 to Zed does NOT change the tracker (loans are on the loans tab).
	await page.goto('/?kind=lent');
	await dial(page, ['3', '0']);
	await page.getByRole('button', { name: 'Continue', exact: true }).click();
	await page.getByRole('button', { name: 'New person', exact: true }).click();
	await page.getByRole('textbox').first().fill('Zed');
	await page.getByRole('button', { name: /Add Loan/ }).click();
	await expect(page).toHaveURL(/\/loans\/[0-9a-f-]+$/);
	await page.goto('/');
	await expect(page.getByTestId('tracker-net-balance')).toHaveText(/QR\s*100\.00/);

	// Borrowing 20 from Zed also leaves the tracker alone.
	await page.goto('/?kind=borrowed');
	await dial(page, ['2', '0']);
	await page.getByRole('button', { name: 'Continue', exact: true }).click();
	await page.getByRole('button', { name: 'Zed', exact: true }).click();
	await page.getByRole('button', { name: /Add Borrow/ }).click();
	await expect(page).toHaveURL(/\/loans\/[0-9a-f-]+$/);
	await page.goto('/');
	await expect(page.getByTestId('tracker-net-balance')).toHaveText(/QR\s*100\.00/);

	// The loans tab shows the two sides separately — gross (never netted) — plus net.
	await page.getByRole('link', { name: 'Loans' }).click();
	await expect(page).toHaveURL('/loans');
	await expect(page.getByTestId('lent-balance')).toHaveText(/QR\s*30\.00/);
	await expect(page.getByTestId('borrowed-balance')).toHaveText(/QR\s*20\.00/);
	await expect(page.getByTestId('net-lending')).toHaveText(/QR\s*10\.00/);

	// Repaying the borrowed 20 in full clears the borrowing side only.
	await page.getByRole('button', { name: /Zed/ }).click();
	// The borrowed loan was created most recently, so it is listed first.
	await page.getByRole('button', { name: 'Payment', exact: true }).first().click();
	await expect(page).toHaveURL(/\/pay/);
	await page.getByRole('button', { name: /Settle with the full amount/ }).click();
	await page.getByRole('button', { name: /Record payment/ }).click();
	await expect(page).toHaveURL(/\/loans\/[0-9a-f-]+$/);
	await expect(page.getByText('settled', { exact: false }).first()).toBeVisible();

	await page.getByRole('link', { name: 'Loans' }).click();
	await expect(page.getByTestId('borrowed-balance')).toHaveText(/QR\s*0\.00/);
	await expect(page.getByTestId('lent-balance')).toHaveText(/QR\s*30\.00/);

	// And the tracker is still purely income — untouched by every loan action.
	await page.getByRole('link', { name: 'Tracker' }).click();
	await expect(page).toHaveURL('/');
	await expect(page.getByTestId('tracker-net-balance')).toHaveText(/QR\s*100\.00/);
	await page.goto('/');
	await expect(page.getByTestId('tracker-net-balance')).toHaveText(/QR\s*100\.00/);
});
