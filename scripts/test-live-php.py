"""Live host checks via explicit IP while public DNS/TLS issuance is pending.
TLS certificate verification is disabled ONLY for this pre-DNS diagnostic.
No secrets or cookies printed. Original content restored byte-for-byte over FTPS.
"""
import base64,ftplib,http.client,http.cookies,io,json,pathlib,shlex,ssl
root=pathlib.Path(__file__).resolve().parents[1]
c=json.loads((pathlib.Path.home()/'.config/remont360-ftp.json').read_text())
f=ftplib.FTP_TLS(context=ssl.create_default_context());f.connect(c['host'],21,timeout=30);f.login(c['user'],c['password']);f.prot_p()
original=io.BytesIO();f.retrbinary('RETR _private/content.php',original.write)
cookies={};upload=None
def call(path,method='GET',data=None,expect=200,header=True):
    conn=http.client.HTTPSConnection('195.210.46.62',context=ssl._create_unverified_context(),timeout=25)
    h={'Host':'remont360.kz','Content-Type':'application/json','Cookie':'; '.join(k+'='+v for k,v in cookies.items())}
    if header:h['X-Admin-Request']='1'
    conn.request(method,path,json.dumps(data).encode() if data is not None else None,h)
    r=conn.getresponse();raw=r.read()
    for k,v in r.getheaders():
        if k.lower()=='set-cookie':
            jar=http.cookies.SimpleCookie();jar.load(v)
            for name,m in jar.items():cookies[name]=m.value
    assert r.status==expect,(path,r.status,raw[:200])
    print(method,path,r.status)
    conn.close()
    try:return json.loads(raw)
    except ValueError:return raw
try:
    call('/');call('/admin');content=call('/api/content')
    assert call('/api/admin/session')['authenticated'] is False
    call('/_private/config.php',expect=403);call('/_private/content.php',expect=403)
    call('/api/admin/content','PUT',{},401)
    env={}
    for line in (pathlib.Path.home()/'.config/ainn-site.env').read_text().splitlines():
        if '=' in line and not line.lstrip().startswith('#'):
            k,v=line.split('=',1);parts=shlex.split(v);env[k.strip()]=parts[0] if parts else ''
    call('/api/admin/login','POST',dict(username=env['ADMIN_USER'],password=env['ADMIN_PASSWORD']))
    assert call('/api/admin/session')['authenticated'] is True
    call('/api/admin/content','PUT',content,403,False)
    # Resave exact public content: no visitor-facing test text.
    saved=call('/api/admin/content','PUT',content)
    assert call('/api/content')==saved
    call('/api/admin/upload','POST',{'data':'data:image/png;base64,bm90LWltYWdl'},400)
    png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='
    upload=call('/api/admin/upload','POST',{'data':'data:image/png;base64,'+png},201)['url']
    assert call(upload)==base64.b64decode(png)
    call('/api/admin/logout','POST',{})
    assert call('/api/admin/session')['authenticated'] is False
    print('LIVE API CHECKS PASSED (DNS/TLS not yet valid)')
finally:
    f.storbinary('STOR _private/content.restore.php',io.BytesIO(original.getvalue()));f.rename('_private/content.restore.php','_private/content.php')
    readback=io.BytesIO();f.retrbinary('RETR _private/content.php',readback.write);assert readback.getvalue()==original.getvalue()
    if upload:
        f.delete(upload.lstrip('/'))
        assert upload.lstrip('/').split('/')[-1] not in [x.split('/')[-1] for x in f.nlst('uploads')]
    try:f.delete('hosting-check.php')
    except ftplib.error_perm:pass
    f.quit();print('Original content restored and read-back verified; test upload/probe cleaned.')
