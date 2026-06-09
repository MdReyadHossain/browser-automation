// ats/ashby.js

class AshbyATS {

    constructor(page) {
        this.page = page;
    }

    // =====================
    // Apply Button Click
    // =====================
    async clickApplyButton() {
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
                    locator = this.page.getByRole(s.role, s.options);
                } else {
                    locator = this.page.locator(s.selector);
                }

                const count = await locator.count();
                if (count > 0) {
                    console.log(`✅ Apply button found: [${s.type}] ${s.role || s.selector}`);
                    await locator.first().click();
                    await this.page.waitForTimeout(1500);
                    return true;
                }
            } catch (e) {
                continue;
            }
        }

        console.log('❌ No apply button found');
        return false;
    }

    // =====================
    // Extract Form Fields
    // =====================
    async extractFormFields() {
        await this.page.waitForTimeout(1000);

        const fields = await this.page.evaluate(() => {
            const results = [];
            const processedRadioNames = new Set();

            const fieldEntries = document.querySelectorAll(
                '.ashby-application-form-field-entry, [data-field-path]'
            );

            fieldEntries.forEach((entry, i) => {
                const questionEl = entry.querySelector(
                    '.ashby-application-form-question-title, label'
                );
                const groupQuestion = questionEl?.textContent?.trim() || '';
                const isRequired = !!entry.querySelector('[class*="_required_"]');

                // Radio
                const radios = entry.querySelectorAll('input[type="radio"]');
                if (radios.length > 0) {
                    const firstName = radios[0].name;
                    if (processedRadioNames.has(firstName)) return;
                    processedRadioNames.add(firstName);

                    const radioOptions = Array.from(radios).map(r => {
                        const optionDiv = r.closest('[class*="_option_"]');
                        return optionDiv?.textContent?.trim() || r.value;
                    });

                    results.push({
                        index: i,
                        type: 'radio',
                        name: firstName,
                        label: groupQuestion || '⚠️ NO QUESTION FOUND',
                        groupQuestion,
                        radioOptions,
                        required: isRequired,
                        options: [],
                    });
                    return;
                }

                // File
                const fileInput = entry.querySelector('input[type="file"]');
                if (fileInput) {
                    results.push({
                        index: i,
                        type: 'file',
                        name: fileInput.name || '',
                        id: fileInput.id || '',
                        label: groupQuestion || 'Resume',
                        groupQuestion: '',
                        required: isRequired,
                        options: [],
                    });
                    return;
                }

                // Combobox
                const combobox = entry.querySelector('[role="combobox"]');
                if (combobox) {
                    results.push({
                        index: i,
                        type: 'combobox',
                        name: combobox.getAttribute('name') || '',
                        id: combobox.id || '',
                        label: groupQuestion || '⚠️ NO LABEL FOUND',
                        groupQuestion: '',
                        required: isRequired,
                        options: [], // extractComboboxOptions() এ fill হবে
                    });
                    return;
                }

                // Select
                const select = entry.querySelector('select');
                if (select) {
                    results.push({
                        index: i,
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

                // Textarea
                const textarea = entry.querySelector('textarea');
                if (textarea) {
                    results.push({
                        index: i,
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

                // Text / Email / Tel
                const input = entry.querySelector('input:not([type="hidden"])');
                if (input) {
                    results.push({
                        index: i,
                        type: input.type || 'text',
                        name: input.name || '',
                        id: input.id || '',
                        placeholder: input.placeholder || '',
                        label: groupQuestion || input.placeholder || '⚠️ NO LABEL FOUND',
                        groupQuestion: '',
                        required: input.required || isRequired,
                        options: [],
                    });
                    return;
                }
            });

            return results;
        });

        return fields;
    }

    // =====================
    // Extract Combobox Options (click করে load করতে হয়)
    // =====================
    async extractComboboxOptions() {
        const comboboxes = await this.page.locator(
            '.ashby-application-form-field-entry [role="combobox"], [data-field-path] [role="combobox"]'
        ).all();

        const results = [];

        for (const combobox of comboboxes) {
            const label = await combobox.evaluate(el => {
                const entry = el.closest('.ashby-application-form-field-entry, [data-field-path]');
                return entry?.querySelector('.ashby-application-form-question-title, label')?.textContent?.trim() || '';
            });

            await combobox.click();
            await this.page.waitForTimeout(500);

            const options = await this.page.evaluate(() => {
                return Array.from(
                    document.querySelectorAll('[role="listbox"] [role="option"]')
                ).map(o => o.textContent.trim());
            });

            results.push({ label, options });

            await this.page.keyboard.press('Escape');
            await this.page.waitForTimeout(300);
        }

        return results;
    }

    // =====================
    // Get All Fields (extract + merge combobox options)
    // =====================
    async getFields() {
        const fields = await this.extractFormFields();
        const comboboxOptions = await this.extractComboboxOptions();

        // Combobox options merge করো
        for (const field of fields) {
            if (field.type === 'combobox') {
                const match = comboboxOptions.find(c => c.label === field.label);
                if (match) field.options = match.options;
            }
        }

        console.log('\n========== ASHBY FIELDS ==========');
        fields.forEach(f => {
            if (f.type === 'radio') {
                console.log(`[RADIO]     "${f.label}" → ${f.radioOptions?.join(' | ')}`);
            } else if (f.type === 'combobox') {
                console.log(`[COMBOBOX]  "${f.label}" → ${f.options?.slice(0, 3).join(' | ')}...`);
            } else if (f.type === 'file') {
                console.log(`[FILE]      "${f.label}" ${f.required ? '(required)' : ''}`);
            } else {
                console.log(`[${f.type.toUpperCase()}]  "${f.label}" ${f.required ? '(required)' : ''}`);
            }
        });
        console.log(`\n✅ Total: ${fields.length} fields`);

        return fields;
    }
}

module.exports = AshbyATS;