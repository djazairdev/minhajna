# The PC web app's host

Teachers open the PC web app at **<https://minhajna.djazair.dev>** (answers 528 and 531). The project runs this host, and a maintainer deploys each release to it. The host serves one release's files and nothing else. It never sees what a teacher records: the app keeps everything in the teacher's browser and sends nothing back ([NETWORK.md](../../NETWORK.md)).

## What the host serves

- **One release's build.** The release's `minhajna-web-<version>.zip`, unzipped at the root of the address. The host serves no other file, no folder listing and no fallback page. An address the build doesn't hold answers 404.
- **HTTPS only.** Plain HTTP only redirects to the same address over HTTPS.
- **Each file with its media type** and, on every answer, these headers, as `apps/web/scripts/host.ts` gives them:

  | Header | Value |
  |---|---|
  | `Cache-Control` | `no-store` |
  | `Content-Security-Policy` | the page's own policy, from the meta element of `index.html`, then `; frame-ancestors 'self'` |
  | `Referrer-Policy` | `no-referrer` |
  | `X-Content-Type-Options` | `nosniff` |
  | `Strict-Transport-Security` | `max-age=31536000` |

- **Every file exactly as built.** The host adds no cookie, no analytics, and no script, banner or page of its own. It doesn't rewrite files either: a content network's minifying, e-mail protection, script loaders and image optimising stay off. Compressing in transit, with gzip or Brotli, is fine, since the browser gets the same bytes back. One changed byte fails the offline worker's hash check, and the teacher's install or update fails with it.
- **Logs kept 7 days** (answer 532). The access logs hold each visitor's IP address and browser, for fighting abuse. They are deleted after 7 days, and so is any other log that holds an IP address. The app only ever sends GET requests for its own files, so no log can hold a teacher's records.

## Deploying a release

Deploy only once the GitHub release is published:

1. **Download and check the files.** Download `minhajna-web-<version>.zip` and `SHA256SUMS.txt` from the release, then run `sha256sum --check --ignore-missing SHA256SUMS.txt`.
2. **Unzip into a new, empty folder** on the host, never over the build being served.
3. **Switch the address to the new folder in one step**, through a symbolic link or the host's own atomic deploy. No teacher should get half of one build and half of the other. If a teacher's install meets files that changed, the worker refuses it and tries again at the next opening.
4. **Check the deployed build.** Run this from `apps/web` in a checkout of the release's tag, with Node.js 22.18 or later and nothing installed. Give it the PC web app's build checksum from the release notes. That is the `sha256` in the build's `build.json`, the one the app shows in Help, not the ZIP's own SHA-256:

   ```bash
   npm run check-host -- https://minhajna.djazair.dev <checksum>
   ```

   It must end with `served as built`. Without the checksum, any build the host serves whole would pass, so the check refuses to run away from this computer. Otherwise it lists each problem; switch back to the previous folder, fix the problems, and run the check again.
5. **Delete the previous folder** once the check passes.

**Never deploy an older build.** The worker never offers a lower version code, so teachers who installed the newer build keep it, and only new installs would get the older one. A broken release is fixed with a new version.

## When the host is down

The installed app opens and works as usual. Only first installs and update checks wait for the host.

## Trying it on this computer

`npm run serve` sends the same headers, over plain HTTP and without `Strict-Transport-Security`. While it runs, check it with `npm run check-host -- http://127.0.0.1:4180`. `npm run zip` packs `dist/` into `release/minhajna-web-<version>.zip`. Before packing, it checks every file against `build.json`. The ZIP keeps the files uncompressed, in name order, all dated 1 January 1980, so the same build always gives the same bytes, on any system. CI keeps one per run as the `web-zip` artifact, for the release manager to compare with their own.
