const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({
        headless: true
    });

    const page = await browser.newPage();
    await page.goto('https://jobs.bt1.ai/company/bt1/325');
    // await page.waitForTimeout(1000);
    await page.getByRole('tab', { name: 'Formulario de solicitud' }).click();
    // await page.waitForTimeout(1000);
    await page.getByRole('textbox', { name: 'Nombre' }).click();
    // await page.waitForTimeout(1000);
    await page.getByRole('textbox', { name: 'Nombre' }).fill('Reyad');
    await page.getByRole('textbox', { name: 'Nombre' }).press('Tab');
    // await page.waitForTimeout(1000);
    await page.getByRole('textbox', { name: 'Apellido' }).fill('Hossain');
    await page.getByRole('textbox', { name: 'Apellido' }).press('Tab');
    // await page.waitForTimeout(1000);
    await page.getByRole('textbox', { name: 'isabela@mail.com' }).fill('reyad@bt1.ai');
    await page.getByRole('textbox', { name: 'isabela@mail.com' }).press('Tab');
    // await page.waitForTimeout(1000);
    await page.getByRole('textbox', { name: '1 (702) 123-' }).fill('+880 195 639 4373');
    await page.getByRole('textbox', { name: '1 (702) 123-' }).press('Tab');
    await page.getByRole('button', { name: 'Bangladesh: +' }).press('Tab');
    // await page.waitForTimeout(1000);
    await page.getByRole('textbox', { name: 'Ciudad' }).fill('n/a');
    // await page.waitForTimeout(1000);
    await page.getByRole('checkbox', { name: 'He leído y estoy de acuerdo' }).check();
    // await page.waitForTimeout(1000);
    await page.getByRole('button', { name: 'Enviar Aplicación.' }).click();

    console.log('automation:', await page.title());
    await browser.close();
})();