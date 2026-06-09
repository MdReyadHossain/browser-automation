const { chromium } = require('playwright');
const express = require('express');
const cors = require('cors');
require("dotenv").config();
const AshbyAtsService = require('./src/services/ashbyAts.service');
const OpenAiService = require('./src/services/openAi.service');
const { userInfo } = require('./FakeData');

const app = express();

app.use(cors());

(async () => {
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();

    // const jobUrl = 'https://jobs.bt1.ai/company/bt1/325';
    // const jobUrl = 'https://jobs.ashbyhq.com/pennylane/96e08392-d87e-4db3-9888-3934abb9c7ea';
    const jobUrl = 'https://jobs.ashbyhq.com/pennylane/e15c5264-3f5c-4b4f-8de7-5cb18f28cab0';
    await page.goto(jobUrl);
    await page.waitForLoadState('networkidle');

    console.log('\n========== CLICKABLE ELEMENTS ==========');
    const clickables = await page.evaluate(() => {
        const els = document.querySelectorAll('button, a, [role="tab"], [role="button"]');
        return Array.from(els).map((el, i) => ({
            index: i,
            tag: el.tagName,
            role: el.getAttribute('role') || '',
            text: el.textContent.trim().substring(0, 100)
        })).filter(el => el.text.length > 0);
    });
    // console.log(JSON.stringify(clickables, null, 2));

    console.log('\n========== CLICKING APPLY BUTTON ==========');
    // const clicked = await findAndClickApplyButton(page);
    // if (!clicked) {
    //     console.log('⚠️ Could not find apply button, stopping...');
    //     return;
    // }

    // console.log('\n========== FORM FIELDS ==========');
    // const fields = await extractFormFields(page);
    // const fields = await extractFormFieldsWithAI(page);

    const ashby = new AshbyAtsService(page);
    await ashby.clickApplyButton();

    const fields = await ashby.getFields();
    await OpenAiService.getFormFieldsAnswers(fields, userInfo);
    // file upload here

    console.log(JSON.stringify(fields, null, 2));
    console.log(`\n✅ Total fields found: ${fields.length}`);
})();
