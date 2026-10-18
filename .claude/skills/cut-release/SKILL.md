---
name: cut-release
description: Cut a Deutsch-Atlas release — fold [Unreleased] into a version heading, bump the three version files, merge, and tag so the release workflow builds the installers. Use only when the owner asks for a release ("release it", "cut 0.7.0", "tag a version"); never as part of an ordinary PR.
---

# Cut a release

Releases are cut **per batch, never per PR**. Ordinary PRs write under `## [Unreleased]` and
touch no version. A release happens only when the owner calls it.

1. **Choose the version.** Use semver on the learner-visible change. If an untagged version
   heading already sits under `[Unreleased]`, fold it into the new one as well
   (`git tag --sort=-v:refname | head` shows what is actually tagged).
2. **On a release branch:**
   - Rename `## [Unreleased]` to `## [X.Y.Z] — YYYY-MM-DD`, and open a fresh empty
     `## [Unreleased]` above it.
   - Merge duplicate `### Changed` / `### Fixed` subsections inside the new heading.
   - Add `[X.Y.Z]: https://github.com/VitalyVorobyev/deutsch-textbook/releases/tag/vX.Y.Z` to the
     link definitions at the foot.
   - Bump `"version"` in `package.json` and `src-tauri/tauri.conf.json`, and `version` in
     `src-tauri/Cargo.toml`. Then run `cargo check --manifest-path src-tauri/Cargo.toml` so
     `Cargo.lock` follows.
3. **Gates and PR** as in the `pr-cycle` skill. Squash-merge.
4. **Tag the merge commit** on an up-to-date `main`:

   ```sh
   git tag vX.Y.Z && git push origin vX.Y.Z
   ```

   `.github/workflows/release.yml` builds the Windows, Linux and macOS installers. It stamps the
   version from the tag and uses the `## [X.Y.Z]` section as the release notes, so a missing
   section ships install instructions only.
5. **Watch the workflow** to the end and report the release URL. If it fails, report the failing
   job and its log. Never delete and re-push a published tag without the owner.
