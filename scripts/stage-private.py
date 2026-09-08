"""Stage private production config from existing protected admin environment.
Run only for initial migration; never deploy stale content on subsequent releases.
"""
import json,os,pathlib,shlex,subprocess
root=pathlib.Path(__file__).resolve().parents[1]
env={}
for line in (pathlib.Path.home()/'.config/ainn-site.env').read_text().splitlines():
    if '=' in line and not line.lstrip().startswith('#'):
        k,v=line.split('=',1);parts=shlex.split(v);env[k.strip()]=parts[0] if parts else ''
assert env.get('ADMIN_USER') and env.get('ADMIN_PASSWORD')
hash_=subprocess.check_output(['php','-r','echo password_hash(stream_get_contents(STDIN), PASSWORD_DEFAULT);'],input=env['ADMIN_PASSWORD'].encode()).decode()
private=root/'dist/_private';private.mkdir(exist_ok=True)
guard='<?php http_response_code(404); exit; ?>\n'
data=json.loads((root/'.site-data/content.json').read_text()) if (root/'.site-data/content.json').exists() else {}
for name,value in [('config.php',dict(user=env['ADMIN_USER'],passwordHash=hash_,saveEnabled=True)),('content.php',data)]:
    p=private/name;p.write_text(guard+json.dumps(value,ensure_ascii=False));p.chmod(0o600)
print('Protected config and existing content staged; credentials not printed.')
