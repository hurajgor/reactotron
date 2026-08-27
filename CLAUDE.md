# reactotron (hurajgor fork)

A fork of [`infinitered/reactotron`](https://github.com/infinitered/reactotron), publishing the
libraries under the **`@hurajgor`** npm scope and shipping its own signed macOS build of the
desktop app.

The fork exists to serve Copart's `member_mobile` app, so changes here are usually driven by a
problem observed in that app rather than by the upstream roadmap.

## A note from the maintainers

Verify instead of assuming. A file name, a commit message, or a previous answer is not
evidence — read until only one explanation survives. When a bug is reported in the desktop UI,
the cause is often in the client library the mobile app loads, or the other way round; guessing
which side wastes hours.

Measure before and after. This repo's bugs are timing and connection bugs, and "it looks better"
is not a result. `lsof -nP -iTCP:9090` and a socket count are worth more than a screenshot.

Tell us what you actually did, including what you could not check. "I did not test this against
a real device" is more useful than a summary that implies you did.

Treat the rest of this document as good defaults. The developer's instructions in the moment
override anything written here.

## The three ways to hurt yourself

1. **Publishing.** npm versions are permanent — they can be deprecated but never replaced, and
   `2.11.1` and `5.3.1` are already burned this way. Never dispatch the publish workflow without
   being asked, and never include a package whose version has not changed (the run fails).
2. **Restarting the wrong side.** The desktop app depends on `reactotron-core-server`, **not**
   `reactotron-core-client`. A client-side fix never reaches it, so restarting Reactotron to
   test one proves nothing — restart Metro in the consuming RN app instead.
3. **Stale bundles.** Metro caches `node_modules` at startup. Sync a built package *after*
   Metro starts and the app runs the old code, which reads exactly like a failed fix. Check the
   file mtime against Metro's start time before concluding anything.

## Glossary

- **core-client** — `lib/reactotron-core-client`, the library running **inside** the mobile app.
- **core-server** — `lib/reactotron-core-server`, the WebSocket server running **inside** the desktop app.
- **the app** / **desktop app** — `apps/reactotron-app`, the Electron client. Ships as a binary on GitHub releases only; never published to npm.
- **the fork scope** — `@hurajgor/…`. Only scoped workspaces can be published from this fork; the unscoped names (`reactotron-core-server`, `eslint-plugin-reactotron`, `reactotron-app`) still belong to upstream Infinite Red on npm, so a publish under those names is not ours to make. Scoping a workspace is what makes it publishable here.
- **tag** — `<projectName>@<version>`, always **unscoped** (`reactotron-core-client@2.11.5`, never `@hurajgor/…`). Set by `nx.json:19` `tagPrefix: "{projectName}@"`.

## Releasing

Everything targets **`development`**. `master` is far behind and is not a release branch.

The scripts `scripts/release.artifacts.mjs` and `apps/reactotron-app/scripts/release.artifacts.js`
are **CircleCI-only** — they gate npm publish on `isCi` and do a CircleCI OIDC token exchange.
CircleCI is not available to this team, so releases are cut by hand with `gh`. That is the
established process, not a workaround.

### 1. Version, changelog, commit and tag

`@jscutlery/semver` via nx does all four at once. Dry-run first with `--dryRun`:

```sh
npx nx run reactotron-app:version --releaseAs minor --baseBranch development
```

For a scoped project name, force the unscoped tag explicitly:

```sh
npx nx run @hurajgor/reactotron-core-ui:version --releaseAs minor \
  --tagPrefix 'reactotron-core-ui@' --baseBranch development
```

`nx version` also rewrites `workspace:*` ranges to real ones, which a hand-edited bump does not.
`reactotron-react-native` pins `reactotron-core-client` exactly, so that dependency moves with it.

Tags are **not** pushed by the version target:

```sh
git push origin development
git push origin 'reactotron-core-client@2.11.5'
```

If `git tag` silently produces nothing, use `git tag --no-sign -a '<tag>' -m '<tag>'` and push the
fully-qualified `refs/tags/<tag>` refspec.

### 2. Publish to npm

Manual `workflow_dispatch`. Order matters — core-client before react-native:

```sh
gh workflow run publish-npm.yml --ref development \
  -f packages="@hurajgor/reactotron-core-client,@hurajgor/reactotron-react-native"
npm view @hurajgor/reactotron-core-client version   # confirm the registry actually moved
```

Auth is **OIDC trusted publishing, configured per package on npmjs.com** — not repo-wide. A
package missing that config fails with `404 Not Found` on PUT, not a 401. A local `npm login`
does nothing for CI.

### 3. GitHub release

Push the tag first, then `--verify-tag`. Never `--target <sha>`: it creates an `untagged-…`
draft instead of using the tag.

```sh
gh release create 'reactotron-core-client@2.11.5' --repo hurajgor/reactotron \
  --verify-tag --title 'reactotron-core-client@2.11.5' --generate-notes --draft
```

Keep GitHub releases in step with npm — every published version gets one, libraries included.

### 4. Desktop installers

Only for `reactotron-app`, and only these carry binary assets.

```sh
corepack enable
MAC_SIGN_IDENTITY="$(security find-identity -v -p codesigning | grep -m1 'Apple Development' | sed -E 's/.*"(.*)"/\1/')" \
  BUILD_TARGET=macos corepack yarn workspace reactotron-app build:release
```

Look the identity up rather than hard-coding it — `security find-identity -v -p codesigning`
lists what the local keychain actually holds.

- `BUILD_TARGET` (`macos` | `linux` | `windows`) is required; the script throws without it.
- Omitting `MAC_SIGN_IDENTITY` **silently ships an unsigned build** — it falls back to
  `-c.mac.identity=null`. Signed DMGs are mandatory.
- Output is `apps/reactotron-app/release/`, **not** `dist/`.
- Builds take 10–25 minutes for both arches. Run detached and poll `pgrep -f electron-builder`.
- Not notarized — no notarize config or credentials exist. Gatekeeper still warns, so keep the
  Gatekeeper paragraph in the release notes.

Verify the signature, upload, then undraft:

```sh
codesign --verify --deep --strict --verbose=2 apps/reactotron-app/release/mac/Reactotron.app
gh release upload 'reactotron-app@3.13.2' apps/reactotron-app/release/Reactotron-3.13.2*.dmg \
  apps/reactotron-app/release/Reactotron-3.13.2*.zip --repo hurajgor/reactotron --clobber
gh release edit 'reactotron-app@3.13.2' --repo hurajgor/reactotron --draft=false
```

**A bad build is not a new version.** If installers were unsigned or wrong, rebuild and
re-upload to the *existing* release with `--clobber`. Do not cut a version to fix a packaging
mistake.

## Environment gotchas

- **`yarn` is not on `PATH`.** Run `corepack enable` first, or prefix
  `PATH="<repo>/node_modules/.bin:$PATH"`.
- **`electron-builder` resolves from the repo root** `node_modules/.bin`, not the app workspace.
- **Run `jest` from inside a package.** The repo root has no TypeScript transform, so suites fail
  to parse there.
- Workspace symlinks mean a `bob build` in a lib is picked up by the desktop app without
  reinstalling — but a consuming RN app needs the built files copied in and Metro restarted with
  `--reset-cache`.
- The `bufferutil` / `utf-8-validate` "Module not found" warnings from `ws` are benign optional
  native deps. They appear in every successful build.

## Testing

Run from inside the package:

```sh
npx jest <path>                       # one suite
npx tsc --noEmit --emitDeclarationOnly false
npx nx run-many --target ci:test --parallel=1
```

`ci:test` has **pre-existing failures** in `reactotron-core-client` and `reactotron-mst` from
broken `src/@hurajgor/...` test imports introduced by the rescoping commit `429de116`. Confirm a
failure predates your change before treating it as a regression.

Before publishing:

```sh
npx zx scripts/package.validate.mjs   # publishable fields on every workspace
npx nx run-many --target typecheck
```

## React Native specifics

`ws` resolves to its **browser shim** under React Native — a function that throws, exposing no
constants. `WebSocket.OPEN` reads `undefined` there, so any `readyState` comparison against it
silently never matches. Node builds are unaffected, which is why unit tests miss this class of
bug entirely; `core-client` uses a numeric `SOCKET_OPEN = 1` for that reason.

When debugging a connection problem, prefer measuring sockets over reading the UI:

```sh
lsof -nP -iTCP:9090 | grep ESTABLISHED    # a changing source port means reconnect churn
```

## Code style

2-space indent, double quotes, no semicolons. Do not add AI attribution to code, commits, or
release notes.
