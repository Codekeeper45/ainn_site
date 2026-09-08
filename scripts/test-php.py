"""Real HTTP regression of PHP API. Uses disposable copy; never production content."""
import base64, http.cookiejar, json, pathlib, shutil, subprocess, time, urllib.request, urllib.error
root=pathlib.Path(__file__).resolve().parents[1]
stage=root/'.test-php'
if stage.exists(): shutil.rmtree(stage)
shutil.copytree(root/'dist',stage)
guard='<?php http_response_code(404); exit; ?>\n'
hash_=subprocess.check_output(['php','-r',"echo password_hash('test-only-password', PASSWORD_DEFAULT);"],text=True)
(stage/'_private/config.php').write_text(guard+json.dumps(dict(user='test',passwordHash=hash_,saveEnabled=True)))
router=stage/'router.php'
router.write_text("<?php $p=parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH); if(str_starts_with($p,'/api/')) {require __DIR__.'/api.php';return;} if(str_starts_with($p,'/_private')||$p==='/collections.json'){http_response_code(403);exit;} if(is_file(__DIR__.$p)) return false; require __DIR__.'/index.html';")
log=open(stage/'server.log','w')
proc=subprocess.Popen(['php','-S','127.0.0.1:4186','-t',str(stage),str(router)],stdout=log,stderr=log)
cookies=http.cookiejar.CookieJar(); client=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cookies))
def request(path,method='GET',data=None,expected=200,header=True):
    headers={'Content-Type':'application/json'}
    if header: headers['X-Admin-Request']='1'
    req=urllib.request.Request('http://127.0.0.1:4186'+path,data=json.dumps(data).encode() if data is not None else None,headers=headers,method=method)
    try: r=client.open(req,timeout=5)
    except urllib.error.HTTPError as e: r=e
    raw=r.read(); assert r.code==expected,(path,r.code,raw)
    print(method,path,r.code)
    try: return json.loads(raw)
    except ValueError: return raw
try:
    for _ in range(40):
        try: request('/api/content');break
        except OSError: time.sleep(.1)
    assert request('/api/content')['texts']=={}
    assert request('/api/admin/session')['authenticated'] is False
    request('/api/admin/content','PUT',{},401)
    request('/api/admin/login','POST',{'username':'test','password':'bad'},403,False)
    request('/api/admin/login','POST',{'username':'test','password':'bad'},401)
    request('/api/admin/login','POST',{'username':'test','password':'test-only-password'})
    assert request('/api/admin/session')['authenticated'] is True
    v={'texts':{'title':'Тест сохранения'},'images':{},'collections':{'faq':[{'id':'x','question':'Вопрос?','answer':'Ответ'}],'cases':[{'id':'case-bedroom','slug':'case-bedroom','title':'Тест','width':1800,'height':900,'wide':True,'image':'/assets/case-bedroom.webp'}]}}
    request('/api/admin/content','PUT',v,403,False)
    saved=request('/api/admin/content','PUT',v)
    assert request('/api/content')==saved
    assert saved['collections']['cases'][0]['slug']=='case-bedroom'
    request('/api/admin/upload','POST',{'data':'data:image/png;base64,'+base64.b64encode(b'not an image').decode()},400)
    png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='
    image=request('/api/admin/upload','POST',{'data':'data:image/png;base64,'+png},201)
    assert request(image['url'])==base64.b64decode(png)
    # Test public contact form submission
    request('/api/contact','POST',{'name':'A','phone':'123'},400,False)
    lead_res = request('/api/contact','POST',{'name':'Ерлан','phone':'+7 701 555 33 22','details':'Ремонт кухни 18м2'},200,False)
    assert lead_res['success'] is True and 'leadId' in lead_res
    # Test review submission
    rev_res = request('/api/review','POST',{'name':'Алия','object':'ЖК Алматы','review':'Отличная работа мастеров, всё сдали вовремя!'},200,False)
    assert rev_res['success'] is True
    # Test admin leads retrieval and deletion
    leads_res = request('/api/admin/leads','GET')
    assert len(leads_res['leads']) >= 1
    assert leads_res['leads'][0]['name'] == 'Ерлан'
    del_res = request('/api/admin/leads','DELETE',{'id':lead_res['leadId']})
    assert len(del_res['leads']) == 0

    request('/_private/config.php',expected=403)
    request('/_private/content.php',expected=403)
    request('/admin')
    request('/api/admin/logout','POST',{})
    assert request('/api/admin/session')['authenticated'] is False
    for i in range(10): request('/api/admin/login','POST',{'username':'test','password':'bad'},401)
    request('/api/admin/login','POST',{'username':'test','password':'test-only-password'},429)
    print('ALL PHP HTTP CHECKS PASSED')
finally:
    proc.terminate();proc.wait(timeout=5);log.close()
