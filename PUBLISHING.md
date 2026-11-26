# Publishing

How `@goldentoaste/pi-simple-tps` gets to npm and into the Pi package gallery.

If your npm username is not `goldentoaste`, change the scope in three places first:
`package.json` (`name`, `author`, `repository`, `homepage`, `bugs`), `README.md` (install
command), and this file.

## 0. One-time repository setup

```sh
git init -b main
git add -A
git commit -m "pi-simple-tps 0.1.0"
gh repo create goldentoaste/pi-simple-tps --public --source . --remote origin --push
```

The `repository` / `homepage` / `bugs` URLs in `package.json` point at
`github.com/goldentoaste/pi-simple-tps`; until that repo exists those links 404 on the npm
page, so create it before the first publish.

`.github/workflows/typecheck.yml` runs `npm run typecheck` on every push and pull request.
It is the only required check: there are no tests, and the extension has no build step.

## 1. One-time setup

```sh
npm login          # opens the browser; use an automation token if the account has 2FA
npm whoami         # must print your npm username
npm access list packages goldentoaste   # optional: confirm you own the scope
```

Without a login every publish fails with `ENEEDAUTH`. Publish requires the scope to exist
and to belong to you: for the first scoped publish, `publishConfig.access: "public"` in
`package.json` is what keeps the package from defaulting to restricted.

If you want the `repository` / `homepage` / `bugs` URLs in `package.json` to resolve,
create `github.com/goldentoaste/pi-simple-tps` and push before publishing. The npm page
will link to whatever is declared there, so either create the repo or drop those fields.

## 2. Pre-flight

```sh
cd G:\Projects\pi-simple-tps   # or anywhere the checkout lives
npm run validate          # typecheck + tarball listing, no upload
npm publish --dry-run     # same checks as a real publish, uploads nothing
npm pack --dry-run        # prints the exact tarball contents
```

`prepublishOnly` already runs `npm run validate`, so a bad typecheck or an unexpected
tarball aborts the real publish before anything is uploaded.

The tarball should contain only:

```
LICENSE  README.md  CHANGELOG.md  PUBLISHING.md  package.json  tsconfig.json  extensions/tps.ts
```

If anything else shows up — a stray `tests/`, editor files, a `node_modules/` fragment —
add it to `files` (allowlist) or `.npmignore`, not both.

Checklist before the version is frozen:

- `version` bumped and a matching `## [x.y.z]` heading added to `CHANGELOG.md` (Pi shows
  package changelogs on update; it matches headings against `version`).
- `pi.extensions` still points at the file that exists.
- Host packages (`@earendil-works/*`) are in `peerDependencies`, never in
  `dependencies`.
- The `pi-package` keyword is present, or the gallery will not list the package.

## 3. Publish

```sh
npm publish
```

Add `--otp <code>` if the account enforces 2FA on writes, and `--tag next` for a
prerelease. There is no build step: Pi loads `extensions/tps.ts` directly.

## 4. Verify

```sh
npm view @goldentoaste/pi-simple-tps version dist.tarball
pi -e npm:@goldentoaste/pi-simple-tps        # one-off load, no settings change
pi install npm:@goldentoaste/pi-simple-tps   # real install
```

In the Pi session, `/reload`, then confirm `/tps` appears in the command list and the
footer shows a rate after one completed response. Uninstall with
`pi remove npm:@goldentoaste/pi-simple-tps`.

## 5. Gallery

No submission step. The `pi-package` keyword makes the package eligible for
[pi.dev/packages](https://pi.dev/packages), which crawls npm; listing can lag a publish by
a few hours. Optional `pi.image` / `pi.video` fields in `package.json` add previews.

## 6. Releasing again

```sh
# edit CHANGELOG.md with a new ## [x.y.z] section
npm version patch        # or minor / major; rewrites package.json + makes a git tag
git push --follow-tags
npm publish
```

Installed users get the new build with `pi update --extensions`; `pi install
npm:@goldentoaste/pi-simple-tps@0.1.0` pins an exact version.

## Failure modes

| Error | Cause |
| --- | --- |
| `ENEEDAUTH` | Not logged in — run `npm login` |
| `EOTP` | Account requires a one-time password — add `--otp <code>` |
| `E402` | That version already exists — bump `version`, versions are immutable |
| `E403` / "scope not found" | Your account is not a member of the scope in `name` |
| `EPUBLISHCONFLICT` | Name taken by someone else; pick a new name or scope |
| `E404` on `pi install` | Publish did not land, or the package name is misspelled in the command |
