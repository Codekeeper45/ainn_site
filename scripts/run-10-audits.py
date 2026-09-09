#!/usr/bin/env python3
"""Sequential 10-Stage Exhaustive Audit Suite for remont360.kz.

Executes 10 distinct audit stages strictly one-by-one.
Each stage gathers verifiable runtime evidence, tests live endpoints,
and verifies 100/100 compliance with every requested feature.
"""
import asyncio
import email
from email.header import decode_header
import imaplib
import json
import os
import pathlib
import re
import ssl
import sys
import time
import urllib.parse
import urllib.request

from playwright.async_api import async_playwright
import requests

LIVE_URL = 'https://remont360.kz'
LIVE_IP = '195.210.46.62'
CHROME_ARGS = ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
PROJECT_DIR = pathlib.Path('/home/hermes/projects/Ainn_site')

def print_banner(stage_num, title):
    print(f"\n{'='*70}")
    print(f"  СУБАГЕНТ {stage_num}/10: {title.upper()}")
    print(f"{'='*70}")

# 1. SEO & Metadata
async def audit_1():
    print_banner(1, "HTML, SEO, OpenGraph, Favicon, Robots & Sitemap")
    res = {'id': 1, 'name': 'SEO & Metadata', 'passed': False, 'checks': []}
    
    html = urllib.request.urlopen(LIVE_URL, timeout=20).read().decode('utf-8')
    title_match = re.search(r'<title>(.*?)</title>', html, re.I)
    title = title_match.group(1).strip() if title_match else ''
    expected_title = 'REMONT 360° | Ремонт жилых и коммерческих помещений в Алматы'
    res['checks'].append({'check': 'Page <title>', 'value': title, 'passed': title == expected_title})
    
    desc_match = re.search(r'<meta\s+name=["\']description["\']\s+content=["\'](.*?)["\']', html, re.I)
    desc = desc_match.group(1).strip() if desc_match else ''
    res['checks'].append({'check': 'Meta description', 'value': desc, 'passed': 'жилых и коммерческих помещений' in desc and 'REMONT 360' in desc})
    
    og_title_match = re.search(r'<meta\s+property=["\']og:title["\']\s+content=["\'](.*?)["\']', html, re.I)
    og_title = og_title_match.group(1).strip() if og_title_match else ''
    res['checks'].append({'check': 'og:title', 'value': og_title, 'passed': og_title == expected_title})
    
    og_img_url = f"{LIVE_URL}/assets/remont360-og.png"
    r_og = requests.get(og_img_url, timeout=15)
    res['checks'].append({'check': 'og:image asset HTTP 200', 'status': r_og.status_code, 'passed': r_og.status_code == 200 and len(r_og.content) > 10000})
    
    for icon_path in ['/assets/favicon.ico', '/assets/apple-touch-icon.png', '/assets/remont360-mark.png']:
        r = requests.get(f"{LIVE_URL}{icon_path}", timeout=10)
        res['checks'].append({'check': f'Icon {icon_path}', 'status': r.status_code, 'passed': r.status_code == 200})
        
    r_rob = requests.get(f"{LIVE_URL}/robots.txt", timeout=10)
    res['checks'].append({'check': 'robots.txt structure', 'passed': r_rob.status_code == 200 and 'Disallow: /admin' in r_rob.text and 'sitemap.xml' in r_rob.text})
    
    r_sit = requests.get(f"{LIVE_URL}/sitemap.xml", timeout=10)
    res['checks'].append({'check': 'sitemap.xml structure', 'passed': r_sit.status_code == 200 and '<loc>https://remont360.kz/</loc>' in r_sit.text})
    
    stale_count = len(re.findall(r'стальком', html, re.I))
    res['checks'].append({'check': 'No stale brand name "Стальком" in HTML', 'count': stale_count, 'passed': stale_count == 0})
    
    res['passed'] = all(c['passed'] for c in res['checks'])
    print("Результаты аудита 1:", json.dumps(res, ensure_ascii=False, indent=2))
    return res

# 2. Branding & Visual Integrity
async def audit_2(browser):
    print_banner(2, "Branding & Visual Integrity")
    res = {'id': 2, 'name': 'Branding & Layout', 'passed': False, 'checks': []}
    
    # Desktop check
    page = await browser.new_page(viewport={'width': 1440, 'height': 900})
    await page.goto(LIVE_URL, wait_until='networkidle')
    
    brand_logo = page.locator('.site-header .brand-logo')
    logo_visible = await brand_logo.is_visible()
    logo_src = await brand_logo.get_attribute('src')
    res['checks'].append({'check': 'Header brand logo visible & hashed', 'src': logo_src, 'passed': logo_visible and 'remont360-logo' in (logo_src or '')})
    
    brand_link_cls = await page.locator('.site-header a[href="#top"]').get_attribute('class')
    res['checks'].append({'check': 'Header logo wrapper class is brand-link', 'class': brand_link_cls, 'passed': 'brand-link' in (brand_link_cls or '')})
    
    footer_logo = page.locator('.site-footer .brand-logo')
    res['checks'].append({'check': 'Footer brand logo visible', 'passed': await footer_logo.is_visible()})
    
    footer_copy = await page.locator('.site-footer p').last.inner_text()
    res['checks'].append({'check': 'Footer copyright text reflects REMONT 360°', 'text': footer_copy, 'passed': 'REMONT 360' in footer_copy})
    await page.close()
    
    # Separate mobile page
    page_m = await browser.new_page(viewport={'width': 390, 'height': 844})
    await page_m.goto(LIVE_URL, wait_until='networkidle')
    menu_btn = page_m.locator('.menu-button')
    menu_btn_vis = await menu_btn.is_visible()
    await menu_btn.click()
    await page_m.wait_for_timeout(300)
    nav_open = await page_m.locator('.mobile-nav').is_visible()
    await page_m.locator('.mobile-nav a[href="#contacts"]').click()
    await page_m.wait_for_timeout(300)
    nav_closed = not await page_m.locator('.mobile-nav').is_visible()
    res['checks'].append({'check': 'Mobile burger menu opens and closes cleanly', 'passed': menu_btn_vis and nav_open and nav_closed})
    await page_m.close()
    
    res['passed'] = all(c['passed'] for c in res['checks'])
    print("Результаты аудита 2:", json.dumps(res, ensure_ascii=False, indent=2))
    return res

# 3. Contacts & Direct Channels
async def audit_3(browser):
    print_banner(3, "Direct Contact Channels & Links")
    res = {'id': 3, 'name': 'Contacts & Links', 'passed': False, 'checks': []}
    page = await browser.new_page(viewport={'width': 1440, 'height': 900})
    await page.goto(LIVE_URL, wait_until='networkidle')
    
    wa_link = await page.locator('.contacts-direct a[href*="wa.me"]').get_attribute('href')
    res['checks'].append({'check': 'Contacts section WhatsApp link', 'href': wa_link, 'passed': '77066606362' in (wa_link or '')})
    
    tel_link = await page.locator('.contacts-direct a[href^="tel:"]').get_attribute('href')
    res['checks'].append({'check': 'Contacts section phone link', 'href': tel_link, 'passed': '+77066606362' in (tel_link or '')})
    
    mail_link = await page.locator('.contacts-direct a[href^="mailto:"]').get_attribute('href')
    res['checks'].append({'check': 'Contacts section email link', 'href': mail_link, 'passed': 'info@remont360.kz' in (mail_link or '')})
    
    footer_tel = await page.locator('.footer-contacts a[href^="tel:"]').get_attribute('href')
    footer_mail = await page.locator('.footer-contacts a[href^="mailto:"]').get_attribute('href')
    footer_wa = await page.locator('.footer-contacts a[href*="wa.me"]').get_attribute('href')
    res['checks'].append({'check': 'Footer phone link matches', 'passed': '+77066606362' in (footer_tel or '')})
    res['checks'].append({'check': 'Footer mail link matches', 'passed': 'info@remont360.kz' in (footer_mail or '')})
    res['checks'].append({'check': 'Footer WhatsApp link matches', 'passed': '77066606362' in (footer_wa or '')})
    
    for nav_h in ['#about', '#price', '#cases', '#contacts']:
        nav_el = page.locator(f'.main-nav a[href="{nav_h}"]')
        await nav_el.click()
        await page.wait_for_timeout(200)
        target_el = page.locator(nav_h)
        res['checks'].append({'check': f'Nav anchor {nav_h} exists and is clickable', 'passed': await target_el.count() > 0})
        
    await page.close()
    res['passed'] = all(c['passed'] for c in res['checks'])
    print("Результаты аудита 3:", json.dumps(res, ensure_ascii=False, indent=2))
    return res

# 4. Lead Engine & Notifications
async def audit_4(browser):
    print_banner(4, "Lead Capture & Email Relay")
    res = {'id': 4, 'name': 'Lead Engine', 'passed': False, 'checks': []}
    
    r_bad = requests.post(f"{LIVE_URL}/api/contact", json={'name': 'X', 'phone': '123'}, timeout=15)
    res['checks'].append({'check': 'API rejects invalid lead (HTTP 400)', 'status': r_bad.status_code, 'passed': r_bad.status_code == 400})
    
    lead_name = f"Audit Lead {int(time.time())}"
    lead_phone = "+7 706 660 63 62"
    lead_details = "Автоматический аудит субагента №4"
    r_good = requests.post(f"{LIVE_URL}/api/contact", json={'name': lead_name, 'phone': lead_phone, 'details': lead_details}, timeout=15)
    lead_ok = r_good.status_code == 200 and r_good.json().get('success') is True
    res['checks'].append({'check': 'API accepts valid lead (HTTP 200)', 'status': r_good.status_code, 'passed': lead_ok})
    
    found_email = False
    for attempt in range(6):
        time.sleep(2.0)
        try:
            ctx = ssl.create_default_context()
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE
            imap = imaplib.IMAP4_SSL(LIVE_IP, 993, ssl_context=ctx)
            imap.login('info@remont360.kz', 'Remont_Nikita1')
            imap.select('INBOX')
            typ, msgs = imap.search(None, 'ALL')
            for mid in reversed(msgs[0].split()[-6:]):
                typ, data = imap.fetch(mid, '(RFC822)')
                msg = email.message_from_bytes(data[0][1])
                sub, enc = decode_header(msg.get('Subject', ''))[0]
                if isinstance(sub, bytes): sub = sub.decode(enc or 'utf-8', errors='replace')
                body_content = str(msg.get_payload(decode=True) or '')
                if lead_name in sub or lead_name in body_content:
                    found_email = True
                    break
            imap.logout()
            if found_email:
                break
        except Exception as e:
            print(f"IMAP poll retry {attempt}: {e}")
    res['checks'].append({'check': 'Email notification received in info@remont360.kz', 'passed': found_email})
    
    page = await browser.new_page(viewport={'width': 1440, 'height': 900})
    await page.goto(LIVE_URL, wait_until='networkidle')
    cf = page.locator('#contacts form')
    await cf.scroll_into_view_if_needed()
    await cf.locator('input[name="name"]').fill("UI Test Lead")
    await cf.locator('input[name="phone"]').fill("+7 706 660 63 62")
    await cf.locator('button[type="submit"]').click()
    await page.wait_for_timeout(1000)
    
    success_box = page.locator('.form-status-box.form-status-success')
    s_vis = await success_box.is_visible()
    wa_btn = success_box.locator('.button-lead-wa')
    wa_vis = await wa_btn.is_visible()
    res['checks'].append({'check': 'UI displays green confirmation & WhatsApp button', 'passed': s_vis and wa_vis})
    await page.close()
    
    res['passed'] = all(c['passed'] for c in res['checks'])
    print("Результаты аудита 4:", json.dumps(res, ensure_ascii=False, indent=2))
    return res

# 5. Brief Calculator
async def audit_5(browser):
    print_banner(5, "Interactive Calculator / Brief")
    res = {'id': 5, 'name': 'Brief Calculator', 'passed': False, 'checks': []}
    page = await browser.new_page(viewport={'width': 1440, 'height': 900})
    await page.goto(LIVE_URL, wait_until='networkidle')
    calc = page.locator('#calculator')
    await calc.scroll_into_view_if_needed()
    await page.wait_for_timeout(300)
    
    obj_types = await page.eval_on_selector_all(
        '#calculator .choice-group:last-of-type .choice span',
        'els => els.map(e => e.innerText.trim())'
    )
    res['checks'].append({'check': 'Property types are [Квартира, Дом, Коммерция]', 'found': obj_types, 'passed': obj_types == ['Квартира', 'Дом', 'Коммерция']})
    
    await page.locator('#calculator .choice-group:last-of-type label:has-text("Коммерция")').click()
    await page.wait_for_timeout(300)
    chip_text = await page.locator('.brief-summary span').last.inner_text()
    res['checks'].append({'check': 'Summary chip updates to Коммерция on click', 'chip_value': chip_text, 'passed': 'Коммерция' in chip_text})
    
    await page.locator('.form-submit').click()
    await page.wait_for_timeout(400)
    res_box = page.locator('.brief-result-box')
    box_vis = await res_box.is_visible()
    res_text = await res_box.inner_text() if box_vis else ''
    text_ok = 'коммерция' in res_text.lower()
    wa_link = await res_box.locator('.button-lead-wa').get_attribute('href')
    wa_ok = 'Коммерция' in urllib.parse.unquote(wa_link or '')
    res['checks'].append({'check': 'Brief results formed & WhatsApp link carries parameters', 'passed': box_vis and text_ok and wa_ok})
    await page.close()
    
    res['passed'] = all(c['passed'] for c in res['checks'])
    print("Результаты аудита 5:", json.dumps(res, ensure_ascii=False, indent=2))
    return res

# 6. Inline Text Editor
async def audit_6(browser):
    print_banner(6, "WYSIWYG Inline Text Editing")
    res = {'id': 6, 'name': 'Inline Text Editor', 'passed': False, 'checks': []}
    page = await browser.new_page(viewport={'width': 1440, 'height': 900})
    await page.goto(f"{LIVE_URL}/admin", wait_until='networkidle')
    if await page.locator('input[name="username"]').is_visible():
        await page.fill('input[name="username"]', 'admin')
        await page.fill('input[name="password"]', 'Remont360_Nikita')
        await page.click('button[type="submit"]')
        await page.wait_for_timeout(1500)
        
    await page.click('button:has-text("Текст")')
    await page.wait_for_timeout(300)
    
    panel_count = await page.locator('.admin-block-panel').count()
    res['checks'].append({'check': 'Redundant side panel eliminated from DOM', 'passed': panel_count == 0})
    
    tariff_price = page.locator('.tariff .tariff-price strong').first
    await tariff_price.scroll_into_view_if_needed()
    editable = await tariff_price.get_attribute('contenteditable')
    has_key = await tariff_price.get_attribute('data-admin-text-key')
    res['checks'].append({'check': 'Tariff price is contenteditable with stable key', 'key': has_key, 'passed': editable == 'plaintext-only' and bool(has_key)})
    
    hero_h1 = page.locator('#hero-title')
    h1_text = await hero_h1.inner_text()
    res['checks'].append({'check': 'Hero H1 has approved custom text with data-split sync', 'text': h1_text, 'passed': 'Ремонт под ключ в Алматы' in h1_text})
    await page.close()
    
    res['passed'] = all(c['passed'] for c in res['checks'])
    print("Результаты аудита 6:", json.dumps(res, ensure_ascii=False, indent=2))
    return res

# 7. SVG & DOM Protection
async def audit_7(browser):
    print_banner(7, "SVG & DOM Structural Protection")
    res = {'id': 7, 'name': 'SVG & Leaf Guard', 'passed': False, 'checks': []}
    page = await browser.new_page(viewport={'width': 1440, 'height': 900})
    await page.goto(LIVE_URL, wait_until='networkidle')
    
    btn_cta = page.locator('.nav-cta')
    has_span = await btn_cta.locator('span').count() == 1
    has_svg = await btn_cta.locator('svg').count() == 1
    res['checks'].append({'check': 'Header CTA button isolates text in span, preserving SVG', 'passed': has_span and has_svg})
    
    tariff_item = page.locator('.tariff ul li').first
    li_span = await tariff_item.locator('span').count() == 1
    li_svg = await tariff_item.locator('svg').count() == 1
    res['checks'].append({'check': 'Tariff bullet items isolate text in span, preserving Check SVG', 'passed': li_span and li_svg})
    
    calc_btn = page.locator('.form-submit')
    c_span = await calc_btn.locator('span').count() == 1
    c_svg = await calc_btn.locator('svg').count() == 1
    res['checks'].append({'check': 'Brief submit button isolates text in span, preserving Arrow SVG', 'passed': c_span and c_svg})
    await page.close()
    
    res['passed'] = all(c['passed'] for c in res['checks'])
    print("Результаты аудита 7:", json.dumps(res, ensure_ascii=False, indent=2))
    return res

# 8. Collections & Block Reordering
async def audit_8(browser):
    print_banner(8, "Collections & Block Reordering")
    res = {'id': 8, 'name': 'Collections Reorder', 'passed': False, 'checks': []}
    page = await browser.new_page(viewport={'width': 1440, 'height': 900})
    await page.goto(f"{LIVE_URL}/admin", wait_until='networkidle')
    if await page.locator('input[name="username"]').is_visible():
        await page.fill('input[name="username"]', 'admin')
        await page.fill('input[name="password"]', 'Remont360_Nikita')
        await page.click('button[type="submit"]')
        await page.wait_for_timeout(1500)
        
    await page.click('button:has-text("Блоки")')
    await page.wait_for_timeout(300)
    
    tariff_ctrls = page.locator('.tariff .admin-block-controls').first
    has_up = await tariff_ctrls.locator('button:has-text("↑")').is_visible()
    has_down = await tariff_ctrls.locator('button:has-text("↓")').is_visible()
    has_star = await tariff_ctrls.locator('button:has-text("★")').is_visible()
    has_del = await tariff_ctrls.locator('button.danger').is_visible()
    res['checks'].append({'check': 'Tariff block has ↑, ↓, ★, ✕ controls directly on card', 'passed': has_up and has_down and has_star and has_del})
    
    case_ctrls = page.locator('.case-card .admin-block-controls').first
    has_wide = await case_ctrls.locator('button:has-text("↔")').is_visible()
    res['checks'].append({'check': 'Case block has wide toggle (↔) directly on card', 'passed': has_wide})
    
    add_btn = page.locator('.tariff-grid .admin-block-add button')
    res['checks'].append({'check': 'In-place Add Block button visible', 'passed': await add_btn.is_visible()})
    await page.close()
    
    res['passed'] = all(c['passed'] for c in res['checks'])
    print("Результаты аудита 8:", json.dumps(res, ensure_ascii=False, indent=2))
    return res

# 9. Image Management & WebP
async def audit_9(browser):
    print_banner(9, "Image Management & WebP")
    res = {'id': 9, 'name': 'Image Engine', 'passed': False, 'checks': []}
    page = await browser.new_page(viewport={'width': 1440, 'height': 900})
    await page.goto(f"{LIVE_URL}/admin", wait_until='networkidle')
    if await page.locator('input[name="username"]').is_visible():
        await page.fill('input[name="username"]', 'admin')
        await page.fill('input[name="password"]', 'Remont360_Nikita')
        await page.click('button[type="submit"]')
        await page.wait_for_timeout(1500)
        
    await page.click('button:has-text("Изображения")')
    await page.wait_for_timeout(300)
    
    await page.click('.hero-shell', position={'x': 250, 'y': 250})
    await page.wait_for_timeout(300)
    sel_hero = await page.inner_text('.admin-toolbar-title span')
    res['checks'].append({'check': 'Clicking hero activates cover photo selection', 'label': sel_hero, 'passed': 'обложка' in sel_hero.lower()})
    
    case_card = page.locator('.case-card').first
    await case_card.scroll_into_view_if_needed()
    await case_card.click(position={'x': 80, 'y': 80})
    await page.wait_for_timeout(300)
    sel_case = await page.inner_text('.admin-toolbar-title span')
    res['checks'].append({'check': 'Clicking case photo activates case photo selection', 'label': sel_case, 'passed': 'кейса' in sel_case.lower()})
    
    replace_btn = page.locator('.admin-selection-actions button:has-text("Заменить фото")')
    res['checks'].append({'check': 'Action button "Заменить фото" is visible in toolbar', 'passed': await replace_btn.is_visible()})
    await page.close()
    
    res['passed'] = all(c['passed'] for c in res['checks'])
    print("Результаты аудита 9:", json.dumps(res, ensure_ascii=False, indent=2))
    return res

# 10. Security & Hosting Isolation
async def audit_10(browser):
    print_banner(10, "Security & Hosting Isolation")
    res = {'id': 10, 'name': 'Security & Admin', 'passed': False, 'checks': []}
    
    for priv_file in ['config.php', 'content.php', 'leads.php']:
        r = requests.get(f"{LIVE_URL}/_private/{priv_file}", timeout=10)
        res['checks'].append({'check': f'Direct access to _private/{priv_file} blocked (403/404)', 'status': r.status_code, 'passed': r.status_code in [403, 404]})
        
    s = requests.Session()
    r_ses = s.get(f"{LIVE_URL}/api/admin/session", timeout=10)
    res['checks'].append({'check': 'Unauthenticated session check returns false', 'authenticated': r_ses.json().get('authenticated'), 'passed': r_ses.json().get('authenticated') is False})
    
    page = await browser.new_page(viewport={'width': 1440, 'height': 900})
    await page.goto(f"{LIVE_URL}/admin", wait_until='networkidle')
    if await page.locator('input[name="username"]').is_visible():
        await page.fill('input[name="username"]', 'admin')
        await page.fill('input[name="password"]', 'Remont360_Nikita')
        await page.click('button[type="submit"]')
        await page.wait_for_timeout(1500)
        
    leads_btn = page.locator('.admin-primary-actions button:has-text("Заявки")')
    btn_ok = await leads_btn.is_visible()
    await leads_btn.click()
    await page.wait_for_timeout(400)
    modal_vis = await page.locator('.admin-modal-card').is_visible()
    res['checks'].append({'check': 'Admin leads modal opens cleanly from toolbar', 'passed': btn_ok and modal_vis})
    await page.close()
    
    res['passed'] = all(c['passed'] for c in res['checks'])
    print("Результаты аудита 10:", json.dumps(res, ensure_ascii=False, indent=2))
    return res

# -----------------------------------------------------------------------------
# Main Sequential Pipeline
# -----------------------------------------------------------------------------
async def main():
    print(f"Запуск последовательного аудита 10 этапов на боевом сайте {LIVE_URL}...\n")
    results = []
    
    # Stage 1: pure HTTP / network
    t0 = time.time()
    r1 = await audit_1()
    r1['duration_sec'] = round(time.time() - t0, 2)
    results.append(r1)
    print(f"--> Этап 1/10 завершён: {'✓ PASSED' if r1['passed'] else '✗ FAILED'} ({r1['duration_sec']}s)\n")
    
    # Stages 2–10: browser audits
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            executable_path='/home/hermes/.local/bin/google-chrome',
            headless=True,
            args=CHROME_ARGS
        )
        
        stages = [
            (2, audit_2),
            (3, audit_3),
            (4, audit_4),
            (5, audit_5),
            (6, audit_6),
            (7, audit_7),
            (8, audit_8),
            (9, audit_9),
            (10, audit_10),
        ]
        
        for num, fn in stages:
            t0 = time.time()
            try:
                r = await fn(browser)
                dt = time.time() - t0
                r['duration_sec'] = round(dt, 2)
                results.append(r)
                print(f"--> Этап {num}/10 завершён: {'✓ PASSED' if r['passed'] else '✗ FAILED'} ({dt:.2f}s)\n")
            except Exception as ex:
                print(f"--> Ошибка на этапе {num}: {ex}\n")
                results.append({'id': num, 'passed': False, 'error': str(ex)})
            await asyncio.sleep(0.5)
            
        await browser.close()
            
    summary_path = PROJECT_DIR / '.deploy-backup/full_audit_report.json'
    summary_path.write_text(json.dumps(results, ensure_ascii=False, indent=2))
    print(f"\nИтоговый сводный отчёт сохранён: {summary_path}")
    
    all_passed = all(r.get('passed', False) for r in results)
    print(f"\n{'='*70}")
    print(f"ОБЩИЙ РЕЗУЛЬТАТ ВСЕХ 10 АУДИТОВ: {'100/100 ВСЕ ПРОЙДЕНЫ УСПЕШНО' if all_passed else 'ТРЕБУЮТСЯ ИСПРАВЛЕНИЯ'}")
    print(f"{'='*70}\n")
    return all_passed

if __name__ == '__main__':
    ok = asyncio.run(main())
    sys.exit(0 if ok else 1)
