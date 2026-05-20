# Release process

The release workflow is **tag-triggered**. Pushing a commit to `main` does not
create a release on its own — only an explicit `v*` tag does.

## Workflows in play

| File                              | Trigger                                      | What it does                                            |
|-----------------------------------|----------------------------------------------|---------------------------------------------------------|
| `.github/workflows/validate.yml`  | PR to `main` or `dev-0-3`; push to `main`    | Lint + tests + manifest checks. No artifact, no release.|
| `.github/workflows/dev-build.yml` | PR to `dev-0-3`                              | Builds an internal-only zip artifact (7-day retention). |
| `.github/workflows/release.yml`   | Tag matching `v*`                            | Builds the zip and publishes a GitHub Release.          |

The validation logic lives in a composite action at
`.github/actions/build-extension/action.yml`, so the three workflows stay in
sync without duplication.

## Cutting a release

1. Land all feature work on the `dev-0-3` umbrella branch (or directly on
   `main` once the cycle is over).
2. On a release PR into `main`:
   - Bump `version` in `manifest.json` (e.g. `0.3.0`).
   - Add a `## [0.3.0] - YYYY-MM-DD` section to `CHANGELOG.md` describing the
     changes. The release workflow extracts this block as the GitHub Release
     body (see `scripts/extract-release-notes.mjs`).
3. Merge the PR into `main`.
4. Tag and push:

   ```sh
   git checkout main
   git pull
   git tag v0.3.0
   git push origin v0.3.0
   ```

5. `release.yml` runs, verifies the tag matches `manifest.json`, builds the
   zip, and publishes the GitHub Release. Watch the Actions tab for status.

## Dev builds

Every PR targeting `dev-0-3` produces a zip artifact named
`…-INTERNAL-pr-<n>-<sha>.zip`. The artifact is **internal to maintainers** —
the name is the only safeguard against end users grabbing it, so do not
share download links publicly.

## Verifying a build locally

The composite action's steps are runnable on your machine:

```sh
npm ci
npm test
npm install -g web-ext
web-ext lint --source-dir . --self-hosted
find . -name '*.js' -not -path './node_modules/*' -not -path './.github/*' \
  -exec node --check {} \;
```
