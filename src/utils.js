const { getFormFieldsWithAI } = require("./service");

const findAndClickApplyButton = async (page) => {
    const applySelectors = [
        { type: 'role', role: 'tab', options: { name: /apply|application|formulario|bewerben|candidatura|postuler/i } },
        { type: 'role', role: 'button', options: { name: /apply now|apply|submit application/i } },
        { type: 'role', role: 'link', options: { name: /apply now|apply for this job/i } },
        { type: 'text', selector: 'a:has-text("Apply Now")' },
        { type: 'text', selector: 'a:has-text("Apply")' },
        { type: 'text', selector: 'button:has-text("Apply")' },
        { type: 'text', selector: '[data-testid="apply-button"]' },
        { type: 'text', selector: '.apply-button' },
        { type: 'text', selector: '#apply-button' },
        { type: 'text', selector: '[class*="apply"]' },
    ];

    for (const s of applySelectors) {
        try {
            let locator;
            if (s.type === 'role') {
                locator = page.getByRole(s.role, s.options);
            } else {
                locator = page.locator(s.selector);
            }

            const count = await locator.count();
            if (count > 0) {
                console.log(`✅ Apply button found: [${s.type}] ${s.role || s.selector}`);
                await locator.first().click();
                await page.waitForTimeout(1500);
                return true;
            }
        } catch (e) {
            continue;
        }
    }

    console.log('❌ No apply button found');
    return false;
}

const extractFormFields = async (page) => {
    return await page.evaluate(() => {
        const results = [];
        const processedRadioNames = new Set();

        // Ashby specific — সব field entry container
        const fieldEntries = document.querySelectorAll(
            '.ashby-application-form-field-entry, [data-field-path]'
        );

        fieldEntries.forEach((entry, i) => {
            // এই entry তে question/label কী
            const questionEl = entry.querySelector(
                '.ashby-application-form-question-title, label'
            );
            const groupQuestion = questionEl?.textContent?.trim() || '';

            // =====================
            // Radio
            // =====================
            const radios = entry.querySelectorAll('input[type="radio"]');
            if (radios.length > 0) {
                const firstName = radios[0].name;
                if (processedRadioNames.has(firstName)) return;
                processedRadioNames.add(firstName);

                const radioOptions = Array.from(radios).map(r => {
                    // option text — parent div এ থাকে
                    const optionDiv = r.closest('._option_1258i_34, [class*="_option_"]');
                    return optionDiv?.textContent?.trim() || r.value;
                });

                results.push({
                    index: i,
                    ats: 'ashby',
                    type: 'radio',
                    name: firstName,
                    label: groupQuestion || '⚠️ NO QUESTION FOUND',
                    groupQuestion,
                    radioOptions,
                    required: !!questionEl?.classList?.contains('_required_f7cvd_91') ||
                              !!entry.querySelector('[class*="_required_"]'),
                    options: [],
                });
                return;
            }

            // =====================
            // File Upload
            // =====================
            const fileInput = entry.querySelector('input[type="file"]');
            if (fileInput) {
                results.push({
                    index: i,
                    ats: 'ashby',
                    type: 'file',
                    name: fileInput.name || '',
                    id: fileInput.id || '',
                    label: groupQuestion || 'Resume',
                    groupQuestion: '',
                    required: !!entry.querySelector('[class*="_required_"]'),
                    options: [],
                });
                return;
            }

            // =====================
            // Combobox / Custom Dropdown (Ashby salary field etc)
            // =====================
            const combobox = entry.querySelector('[role="combobox"], [role="listbox"]');
            if (combobox) {
                // Options খোঁজো
                const optionEls = entry.querySelectorAll('[role="option"]');
                const options = Array.from(optionEls).map(o => o.textContent.trim());

                results.push({
                    index: i,
                    ats: 'ashby',
                    type: 'combobox',
                    name: combobox.getAttribute('name') || '',
                    id: combobox.id || '',
                    label: groupQuestion || '⚠️ NO LABEL FOUND',
                    groupQuestion: '',
                    required: !!entry.querySelector('[class*="_required_"]'),
                    options,
                });
                return;
            }

            // =====================
            // Select
            // =====================
            const select = entry.querySelector('select');
            if (select) {
                results.push({
                    index: i,
                    ats: 'ashby',
                    type: 'select',
                    name: select.name || '',
                    id: select.id || '',
                    label: groupQuestion || '⚠️ NO LABEL FOUND',
                    groupQuestion: '',
                    required: select.required,
                    options: Array.from(select.options).map(o => ({
                        value: o.value,
                        text: o.text,
                    })),
                });
                return;
            }

            // =====================
            // Textarea
            // =====================
            const textarea = entry.querySelector('textarea');
            if (textarea) {
                results.push({
                    index: i,
                    ats: 'ashby',
                    type: 'textarea',
                    name: textarea.name || '',
                    id: textarea.id || '',
                    placeholder: textarea.placeholder || '',
                    label: groupQuestion || '⚠️ NO LABEL FOUND',
                    groupQuestion: '',
                    required: textarea.required,
                    options: [],
                });
                return;
            }

            // =====================
            // Text / Email / Tel etc
            // =====================
            const input = entry.querySelector('input:not([type="hidden"])');
            if (input) {
                results.push({
                    index: i,
                    ats: 'ashby',
                    type: input.type || 'text',
                    name: input.name || '',
                    id: input.id || '',
                    placeholder: input.placeholder || '',
                    label: groupQuestion || input.placeholder || '⚠️ NO LABEL FOUND',
                    groupQuestion: '',
                    required: input.required || !!entry.querySelector('[class*="_required_"]'),
                    options: [],
                });
                return;
            }
        });

        return results;
    });
};

const extractFormFieldsWithAI = async (page, openai) => {
    const formHTML = await page.evaluate(() => {
        const form = document.querySelector('form') || document.querySelector('main') || document.body;
        return form.innerHTML;
    });
    const fields = await getFormFieldsWithAI(formHTML);

    console.log('\n========== AI EXTRACTED FIELDS ==========');
    fields.forEach(f => {
        if (f.type === 'radio') {
            console.log(`[RADIO]  "${f.groupQuestion}" → ${f.radioOptions?.join(' | ')}`);
        } else if (f.type === 'select') {
            console.log(`[SELECT] "${f.label}" → ${f.selectOptions?.slice(0, 3).join(' | ')}...`);
        } else {
            console.log(`[${f.type.toUpperCase()}] "${f.label}" ${f.required ? '(required)' : ''}`);
        }
    });
    console.log(`\n✅ Total fields extracted: ${fields.length}`);

    return fields;
};

async function uploadFileFromURL(fileUrl, fileName = 'resume.pdf') {
    // Fetch the file
    const response = await fetch(fileUrl);
    const blob = await response.blob();
    const file = new File([blob], fileName, { type: blob.type });

    // Step 2: Get the input element
    const input = document.querySelector('#resume-upload-input');

    // Step 3: Inject the file into the input using DataTransfer
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    input.files = dataTransfer.files;

    // Step 4: Trigger change & input events so the ATS site detects the upload
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new Event('input', { bubbles: true }));

    console.log('✅ File injected:', input.files[0]);
}

module.exports = {
    findAndClickApplyButton,
    extractFormFields,
    extractFormFieldsWithAI,
    uploadFileFromURL,
};