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
        const elements = document.querySelectorAll(
            'input:not([type="hidden"]), select, textarea, [role="combobox"]'
        );

        elements.forEach((el, i) => {
            let label = '';

            if (el.id) {
                const labelEl = document.querySelector(`label[for="${el.id}"]`);
                if (labelEl) label = labelEl.textContent.trim();
            }
            if (!label) {
                const closest = el.closest('label');
                if (closest) label = closest.textContent.trim();
            }
            if (!label && el.getAttribute('aria-label')) {
                label = el.getAttribute('aria-label');
            }
            if (!label && el.getAttribute('aria-labelledby')) {
                const labelEl = document.getElementById(el.getAttribute('aria-labelledby'));
                if (labelEl) label = labelEl.textContent.trim();
            }
            if (!label && el.placeholder) {
                label = el.placeholder;
            }

            results.push({
                index: i,
                tag: el.tagName,
                type: el.type || 'text',
                name: el.name || '',
                id: el.id || '',
                placeholder: el.placeholder || '',
                label: label || '⚠️ NO LABEL FOUND',
                role: el.getAttribute('role') || '',
                required: el.required,
                options: el.tagName === 'SELECT'
                    ? Array.from(el.options).map(o => ({ value: o.value, text: o.text }))
                    : [],
            });
        });

        return results;
    });
}

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
    uploadFileFromURL,
};