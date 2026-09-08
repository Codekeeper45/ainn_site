"""Browser QA of actual hosting, temporary DNS override until delegation propagates."""
import asyncio, json, pathlib, shlex, ftplib, ssl
from playwright.async_api import async_playwright
root=pathlib.Path(__file__).resolve().parents[1]
async def main():
    async with async_playwright() as p:
        browser=await p.chromium.launch(executable_path='/home/hermes/.local/bin/google-chrome',headless=True,args=['--no-sandbox','--host-resolver-rules=MAP remont360.kz 195.210.46.62'])
        context=await browser.new_context(ignore_https_errors=True,viewport={'width':1440,'height':1000})
        page=await context.new_page();errors=[]
        page.on('pageerror',lambda e: errors.append(str(e)))
        r=await page.goto('https://remont360.kz',wait_until='networkidle');assert r.status==200
        print('TITLE',await page.title());print('H1',await page.locator('h1').all_text_contents())
        await page.screenshot(path=str(root/'.deploy-backup/desktop-live.png'))
        await page.set_viewport_size({'width':390,'height':844});await page.reload(wait_until='networkidle')
        await page.screenshot(path=str(root/'.deploy-backup/mobile-live.png'))
        assert await page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), 'Mobile overflow'
        env={}
        for line in (pathlib.Path.home()/'.config/ainn-site.env').read_text().splitlines():
            if '=' in line and not line.lstrip().startswith('#'):
                k,v=line.split('=',1);parts=shlex.split(v);env[k.strip()]=parts[0] if parts else ''
        # Fetch inside page for DNS override; secrets only in request body, never logged.
        ok=await page.evaluate('''async creds => {const r=await fetch('/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json','X-Admin-Request':'1'},body:JSON.stringify(creds)});return r.status}''',dict(username=env['ADMIN_USER'],password=env['ADMIN_PASSWORD']))
        assert ok==200
        await page.goto('https://remont360.kz/admin',wait_until='networkidle')
        print('ADMIN BUTTONS',await page.get_by_role('button').all_text_contents())
        await page.screenshot(path=str(root/'.deploy-backup/admin-live.png'))
        await page.add_script_tag(content=(root/'src/admin/api.js').read_text().replace('export ',''))
        result=await page.evaluate('''async()=>{
            const c=document.createElement('canvas');c.width=2400;c.height=1200;
            c.getContext('2d').fillRect(0,0,1000,1000);
            const b=await new Promise(r=>c.toBlob(r,'image/png'));
            const url=await uploadImageFile(new File([b],'test.png',{type:'image/png'}));
            const response=await fetch(url);const output=await response.blob();const image=await createImageBitmap(output);
            const q=document.createElement('canvas');q.width=image.width;q.height=image.height;
            const ctx=q.getContext('2d');ctx.drawImage(image,0,0);
            return {url,type:output.type,width:image.width,height:image.height,bytes:output.size,alpha:ctx.getImageData(image.width-1,image.height-1,1,1).data[3]};
        }''')
        print('WEBP',result)
        c=json.loads((pathlib.Path.home()/'.config/remont360-ftp.json').read_text());f=ftplib.FTP_TLS(context=ssl.create_default_context());f.connect(c['host'],21,timeout=30);f.login(c['user'],c['password']);f.prot_p();f.delete(result['url'].lstrip('/'));assert result['url'].split('/')[-1] not in [x.split('/')[-1] for x in f.nlst('uploads')];f.quit()
        assert result['width']==1920 and result['height']==960 and result['type']=='image/webp' and result['alpha']==0
        await page.evaluate("fetch('/api/admin/logout',{method:'POST',headers:{'X-Admin-Request':'1'}})")
        print('BROWSER ERRORS',errors);assert not errors
        await browser.close()
asyncio.run(main())
