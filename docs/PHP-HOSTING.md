# PHP shared hosting deployment

Frontend stays React/Three.js/GSAP; the public webserver serves the built assets.
Node.js is required only on the build machine, not on shared hosting.

## Build and tests

```sh
npm run build
node scripts/build-php.mjs
php -l hosting/api.php
python3 scripts/test-php.py
```

PHP 7.4 compatibility exists for the initial provider runtime, but select supported
PHP 8.3+ in Plesk. Requires mbstring, sessions, file uploads/writable folders.
The local integration suite uses PHP's development server, not Apache; live
checks are needed to validate .htaccess, nginx, PHP limits and permissions.

## Initial installation

- Back up existing host files before deployment.
- `python3 scripts/stage-private.py` reads existing protected admin environment,
  stages a password hash and existing JSON content. No plaintext password in release.
- Copy existing `.site-data/uploads/` into `dist/uploads/` if nonempty.
- `python3 scripts/deploy-ftps.py` uses `~/.config/remont360-ftp.json` (0600).
- FTPS hostname: srv-plesk32.ps.kz; validates TLS certificate.
- FTP account is jailed to the domain's document root: `/` IS httpdocs.
- All uploaded files are downloaded again and hash-compared.
- Existing private files are preserved on redeployment. User uploads are never deleted.
- Never publish the source repository, backups or scripts. Publish dist only.

## API and storage

Same API paths as server.mjs: content, admin session/login/logout/content/upload.
The collection validation schema is generated directly from src/content/model.js.
Private data lives in `_private/*.php`, encoded as JSON after a PHP exit guard.
Apache denies this directory; the PHP guard is a second defense for nginx bypass.
No PHP source may ever be served as text. Verify config/content return 403/404.
Content writes are atomic. Rate limiting persists across PHP processes under flock.
Sessions are HttpOnly, SameSite Strict, Secure on HTTPS, renewed on login.
Uploads accept validated JPEG/PNG/WebP/GIF with bounded dimensions and size.
Still images resize in browser to max 1920px and WebP quality 0.85; GIF animation
is preserved. Exact output bytes vary by image, not a promised fixed size.

## Production verification

`python3 scripts/test-live-php.py` and
`uv run --with playwright python scripts/test-browser.py` use explicit IP mapping
and disabled HTTPS certificate checks ONLY to test before domain DNS activation.
They are diagnostics, NOT evidence that public DNS/TLS works. Live API test saves
the unchanged content, then restores original bytes via FTPS. Both tests remove
the uploaded test image. Run only during maintenance without concurrent editing.

After DNS resolves, verify ordinary `curl -I https://remont360.kz`, open the site
without overrides, issue Let's Encrypt from Plesk and verify its renewal settings.
DNS, certificate issuance and PHP version changes require the hosting panel;
FTP access alone does not provide these controls.

## Rollback

Initial hosting index is backed up in `.deploy-backup/index.html`. The existing
Node service and `.site-data/` are untouched. Restore the backed-up index through
FTPS to roll back the public page; preserve uploads and private content. Don't
remove the local project while the Node service still uses it.
