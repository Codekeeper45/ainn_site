"""Comprehensive E2E integration test for the simplified, non-redundant inline admin editor.
Runs against an isolated disposable local PHP server on port 4187 — never touches production!
"""
import asyncio
import base64
import http.cookiejar
import json
import os
import pathlib
import shutil
import subprocess
import time
from playwright.async_api import async_playwright

root = pathlib.Path(__file__).resolve().parents[1]
stage = root / '.test-e2e-php'

def setup_server():
    if stage.exists():
        shutil.rmtree(stage)
    shutil.copytree(root / 'dist', stage)
    guard = '<?php http_response_code(404); exit; ?>\n'
    hash_ = subprocess.check_output(
        ['php', '-r', "echo password_hash('test-admin-password', PASSWORD_DEFAULT);"],
        text=True
    ).strip()
    (stage / '_private/config.php').write_text(
        guard + json.dumps({'user': 'admin', 'passwordHash': hash_, 'saveEnabled': True})
    )
    router = stage / 'router.php'
    router.write_text(
        "<?php $p=parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH); "
        "if(str_starts_with($p,'/api/')) {require __DIR__.'/api.php';return;} "
        "if(str_starts_with($p,'/_private')||$p==='/collections.json'){http_response_code(403);exit;} "
        "if(is_file(__DIR__.$p)) return false; "
        "require __DIR__.'/index.html';"
    )
    log = open(stage / 'server.log', 'w')
    proc = subprocess.Popen(
        ['php', '-S', '127.0.0.1:4187', '-t', str(stage), str(router)],
        stdout=log,
        stderr=log
    )
    time.sleep(0.5)
    return proc

async def run_tests():
    proc = setup_server()
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                executable_path='/home/hermes/.local/bin/google-chrome',
                headless=True,
                args=['--no-sandbox']
            )
            page = await browser.new_page(viewport={'width': 1440, 'height': 900})
            
            print('1. Navigating to /admin on disposable test server...')
            await page.goto('http://127.0.0.1:4187/admin', wait_until='networkidle')
            
            # Login
            await page.fill('input[name="username"]', 'admin')
            await page.fill('input[name="password"]', 'test-admin-password')
            await page.click('button[type="submit"]')
            await page.wait_for_timeout(1500)
            
            # Verify saveEnabled is true
            save_btn = page.locator('[data-admin-save]')
            is_disabled = await save_btn.is_disabled()
            assert not is_disabled, 'Save button should be enabled after login!'
            print('✓ Login successful and save is enabled!')
            
            # 2. Verify Right Panel is completely eliminated
            panel_count = await page.locator('.admin-block-panel').count()
            assert panel_count == 0, 'No .admin-block-panel should exist in DOM!'
            print('✓ Right side panel completely eliminated!')
            
            # 3. Test Text Mode Direct Inline Editing
            await page.click('button:has-text("Текст")')
            await page.wait_for_timeout(300)
            
            # Click on a tariff - should NOT open any right panel
            tariff_el = page.locator('.tariff').first
            await tariff_el.scroll_into_view_if_needed()
            await tariff_el.click()
            await page.wait_for_timeout(300)
            panel_count = await page.locator('.admin-block-panel').count()
            assert panel_count == 0, 'Clicking block in text mode must not open side panel!'
            
            # Edit price 'Стоимость уточняется'
            price_el = page.locator('.tariff-price strong').first
            await price_el.scroll_into_view_if_needed()
            await price_el.click()
            await page.keyboard.type(' от 50 000 ₸/м²')
            await page.wait_for_timeout(200)
            print('✓ Typed into tariff price successfully!')
            
            # Edit tariff bullet point item with Check icon
            li_span = page.locator('.tariff ul li span').first
            await li_span.click()
            await page.keyboard.type(' (быстро и качественно)')
            await page.wait_for_timeout(200)
            
            # Verify <Check> SVG icon was NOT destroyed by editing the span!
            svg_count = await page.locator('.tariff ul li svg').count()
            assert svg_count > 0, 'Check SVG icons must be preserved and not erased!'
            print('✓ Bullet point edited, SVG Check icon fully preserved!')
            
            # Edit header button text
            btn_span = page.locator('.nav-cta span')
            await btn_span.scroll_into_view_if_needed()
            await btn_span.click()
            await page.keyboard.type('!')
            # Verify <ArrowRight> SVG icon is preserved
            arrow_count = await page.locator('.nav-cta svg').count()
            assert arrow_count == 1, 'Arrow SVG icon in button must be preserved!'
            print('✓ Button text edited, SVG Arrow icon fully preserved!')
            
            # Save all changes
            await page.click('[data-admin-save]')
            await page.wait_for_timeout(1000)
            status_text = await page.inner_text('.admin-status')
            assert 'Сохранено' in status_text, f'Save failed: {status_text}'
            print('✓ Changes saved successfully:', status_text)
            
            # Reload page and verify persistence
            await page.reload(wait_until='networkidle')
            reloaded_price = await page.locator('.tariff-price strong').first.inner_text()
            assert 'от 50 000 ₸/м²' in reloaded_price, f'Price not persisted! Got: {reloaded_price}'
            reloaded_bullet = await page.locator('.tariff ul li span').first.inner_text()
            assert '(быстро и качественно)' in reloaded_bullet, f'Bullet not persisted! Got: {reloaded_bullet}'
            print('✓ Reload verified: all text overrides persisted accurately!')
            
            # 4. Test Image Mode
            await page.click('button:has-text("Изображения")')
            await page.wait_for_timeout(300)
            
            # Click hero
            await page.click('.hero-shell', position={'x': 200, 'y': 200})
            await page.wait_for_timeout(300)
            hero_sel = await page.inner_text('.admin-toolbar-title span')
            assert 'обложка' in hero_sel.lower(), f'Hero selection failed, got: {hero_sel}'
            print('✓ Hero cover selection verified:', hero_sel)
            
            # Click case photo
            case_card = page.locator('.case-card').first
            await case_card.scroll_into_view_if_needed()
            await case_card.click(position={'x': 80, 'y': 80})
            await page.wait_for_timeout(300)
            case_sel = await page.inner_text('.admin-toolbar-title span')
            assert 'кейса' in case_sel.lower(), f'Case selection failed, got: {case_sel}'
            print('✓ Case photo selection verified:', case_sel)
            
            # 5. Test Blocks Mode Controls
            await page.click('button:has-text("Блоки")')
            await page.wait_for_timeout(300)
            
            # Verify controls on tariff
            tariff_first = page.locator('.tariff').first
            await tariff_first.scroll_into_view_if_needed()
            
            # Test moving tariff down and verifying text key stability!
            down_btn = tariff_first.locator('button:has-text("↓")')
            await down_btn.click()
            await page.wait_for_timeout(400)
            # Now the comfort tariff (with our edited price) is at index 1 (second tariff)
            second_tariff_price = await page.locator('.tariff .tariff-price strong').nth(1).inner_text()
            assert 'от 50 000 ₸/м²' in second_tariff_price, f'Text should stay with the moved item! Got: {second_tariff_price}'
            print('✓ Stable collection item text key verified across reordering!')
            
            # Test style toggle button ★
            style_btn = page.locator('.tariff').first.locator('button:has-text("★")')
            assert await style_btn.is_visible(), 'Style toggle button should be visible on tariff!'
            style_before = await page.locator('.tariff').first.get_attribute('class')
            await style_btn.click()
            await page.wait_for_timeout(300)
            style_after = await page.locator('.tariff').first.get_attribute('class')
            assert style_before != style_after, 'Clicking ★ should cycle tariff style class!'
            print('✓ Tariff style toggle (★) verified!')
            
            # Test wide toggle button ↔ on case
            case_first = page.locator('.case-card').first
            await case_first.scroll_into_view_if_needed()
            wide_btn = case_first.locator('button:has-text("↔")')
            assert await wide_btn.is_visible(), 'Wide toggle button should be visible on case!'
            was_wide = await case_first.evaluate('el => el.classList.contains("case-card-wide")')
            await wide_btn.click()
            await page.wait_for_timeout(300)
            is_wide_now = await case_first.evaluate('el => el.classList.contains("case-card-wide")')
            assert was_wide != is_wide_now, 'Clicking ↔ should toggle case card wide class!'
            print('✓ Case wide toggle (↔) verified!')
            
            # Test Add Block button
            tariff_count_before = await page.locator('.tariff').count()
            add_tariff_btn = page.locator('.tariff-grid .admin-block-add button')
            await add_tariff_btn.scroll_into_view_if_needed()
            await add_tariff_btn.click()
            await page.wait_for_timeout(500)
            tariff_count_after = await page.locator('.tariff').count()
            assert tariff_count_after == tariff_count_before + 1, 'Adding tariff should increase count by 1!'
            
            # Verify newly added block has readable placeholder text
            new_tariff_name = await page.locator('.tariff h3').last.inner_text()
            assert 'Новый тариф' in new_tariff_name, f'New tariff placeholder missing: {new_tariff_name}'
            print('✓ Adding block in place with visible placeholder verified!')
            
            # 6. Verify brand-link class on header
            brand_cls = await page.locator('.site-header a[href="#top"]').get_attribute('class')
            assert 'brand-link' in brand_cls, f'Expected brand-link class, got {brand_cls}'
            print('✓ Header brand link class verified!')

            # 7. Test Brief Calculator
            brief_form = page.locator('#calculator form')
            await brief_form.scroll_into_view_if_needed()
            await brief_form.locator('button[type="submit"]').click()
            await page.wait_for_timeout(300)
            wa_brief_btn = page.locator('.brief-result-box .button-lead-wa')
            assert await wa_brief_btn.is_visible(), 'Brief WhatsApp button should be visible after calculation!'
            wa_href = await wa_brief_btn.get_attribute('href')
            assert 'wa.me/77066606362' in wa_href, f'Expected wa.me link, got {wa_href}'
            print('✓ Brief calculator WhatsApp link verified!')

            # 8. Test Contact Form Submission in browser
            contacts_form = page.locator('#contacts form')
            await contacts_form.scroll_into_view_if_needed()
            await contacts_form.locator('input[name="name"]').fill('Тестовый Заказчик')
            await contacts_form.locator('input[name="phone"]').fill('+7 700 111 22 33')
            await contacts_form.locator('button[type="submit"]').click()
            await page.wait_for_timeout(1000)

            success_box = page.locator('.form-status-box.form-status-success')
            assert await success_box.is_visible(), 'Success feedback box should be visible after submitting contact form!'
            wa_lead_btn = success_box.locator('.button-lead-wa')
            assert await wa_lead_btn.is_visible(), 'WhatsApp lead button should be visible in success box!'
            print('✓ Contact form submission and success state verified!')

            # 9. Test Admin Leads Modal
            leads_btn = page.locator('.admin-primary-actions button:has-text("Заявки")')
            await leads_btn.click()
            await page.wait_for_timeout(500)
            modal = page.locator('.admin-modal-overlay')
            assert await modal.is_visible(), 'Admin leads modal should open on click!'
            modal_text = await modal.inner_text()
            assert 'Тестовый Заказчик' in modal_text, f'Submitted lead should appear in admin modal! Got: {modal_text}'
            assert '+7 700 111 22 33' in modal_text, f'Phone number should appear in admin modal! Got: {modal_text}'
            print('✓ Admin leads modal displays real submitted leads with phone and name!')

            # Test lead deletion
            del_btn = modal.locator('.admin-lead-item button.danger').first
            # Handle confirm dialog
            page.on('dialog', lambda dialog: asyncio.create_task(dialog.accept()))
            await del_btn.click()
            await page.wait_for_timeout(500)
            modal_text_after = await modal.inner_text()
            assert 'Новых заявок пока нет' in modal_text_after, f'Lead should be deleted! Got: {modal_text_after}'
            print('✓ Admin lead deletion verified!')

            # Close modal
            await modal.locator('.admin-modal-head button').click()
            await page.wait_for_timeout(300)
            assert not await modal.is_visible(), 'Modal should be closed!'
            print('✓ Admin modal close verified!')

            print('\n========================================')
            print('ALL E2E ADMIN PANEL AUDIT CHECKS PASSED!')
            print('========================================')
            
            await browser.close()
    finally:
        proc.terminate()
        proc.wait()
        if stage.exists():
            shutil.rmtree(stage)

if __name__ == '__main__':
    asyncio.run(run_tests())
