const { chromium } = require('playwright');
const { findAndClickApplyButton, extractFormFields } = require('./src/utils');

(async () => {
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();

    // const jobUrl = 'https://jobs.bt1.ai/company/bt1/325';
    const jobUrl = 'https://jobs.ashbyhq.com/pennylane/96e08392-d87e-4db3-9888-3934abb9c7ea';
    await page.goto(jobUrl);
    await page.waitForLoadState('networkidle');

    console.log('\n========== CLICKABLE ELEMENTS ==========');
    const clickables = await page.evaluate(() => {
        const els = document.querySelectorAll('button, a, [role="tab"], [role="button"]');
        return Array.from(els).map((el, i) => ({
            index: i,
            tag: el.tagName,
            role: el.getAttribute('role') || '',
            text: el.textContent.trim().substring(0, 100),
        })).filter(el => el.text.length > 0);
    });
    console.log(JSON.stringify(clickables, null, 2));

    console.log('\n========== CLICKING APPLY BUTTON ==========');
    const clicked = await findAndClickApplyButton(page);
    if (!clicked) {
        console.log('⚠️ Could not find apply button, stopping...');
        return;
    }

    console.log('\n========== FORM FIELDS ==========');
    const fields = await extractFormFields(page);

    console.log(JSON.stringify(fields, null, 2));
    console.log(`\n✅ Total fields found: ${fields.length}`);
})();