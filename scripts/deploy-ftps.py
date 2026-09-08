"""Deploy dist through verified FTPS, atomic per-file replacement and readback.
Credentials: ~/.config/remont360-ftp.json. Never deletes user uploads.
"""
import ftplib, hashlib, io, json, pathlib, ssl, sys
root=pathlib.Path(__file__).resolve().parents[1]
c=json.loads((pathlib.Path.home()/'.config/remont360-ftp.json').read_text())
f=ftplib.FTP_TLS(context=ssl.create_default_context());f.connect(c['host'],21,timeout=30);f.login(c['user'],c['password']);f.prot_p()
def put(path,data):
    parent=path.rsplit('/',1)[0] if '/' in path else ''
    if parent:
        part=''
        for s in parent.split('/'):
            part+=('/' if part else '')+s
            try:f.mkd(part)
            except ftplib.error_perm as e:
                if not str(e).startswith('550'):raise
    # Temporary private files retain PHP extension to avoid source disclosure.
    tmp=path+'.deploy.php' if path.endswith('.php') else path+'.deploy'
    f.storbinary('STOR '+tmp,io.BytesIO(data))
    f.rename(tmp,path)
    out=io.BytesIO();f.retrbinary('RETR '+path,out.write)
    assert hashlib.sha256(out.getvalue()).digest()==hashlib.sha256(data).digest(),path
if '--probe' in sys.argv:
    put('hosting-check.php',b'<?php header("Content-Type: application/json"); echo json_encode(["php"=>PHP_VERSION,"mbstring"=>extension_loaded("mbstring"),"writable"=>is_writable(__DIR__)]);')
    print('Probe uploaded and byte-verified')
else:
    files=sorted((root/'dist').rglob('*'),key=lambda p:p.name=='index.html')
    total=0;count=0
    for p in files:
        if p.is_file():
            rel=p.relative_to(root/'dist').as_posix()
            if rel.startswith('_private/') and p.suffix=='.php':
                try:
                    f.voidcmd('TYPE I')
                    f.size(rel)
                    print('Preserved existing private file:',rel)
                    continue
                except ftplib.error_perm as e:
                    if not str(e).startswith('550'):raise
            data=p.read_bytes();put(rel,data);total+=len(data);count+=1
    print('Uploaded and read-back verified:',count,'files;',total,'bytes')
f.quit()
