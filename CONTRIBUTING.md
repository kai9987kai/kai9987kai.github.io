All contributions are welcome and can be added to a log a public contribution acknowledgement page of wanted
# Contribution Rules (GitHub)

Thanks for taking the time to contribute. These rules keep changes reviewable, secure, and easy to maintain.

---

## 1) Ground Rules

* Be respectful and professional in issues, discussions, and PRs.
* Keep contributions relevant to the project scope.
* Don’t include secrets (API keys, tokens, passwords) anywhere—ever.
* Don’t upload copyrighted assets unless you own the rights or the license allows it.

---

## 2) Before You Start

1. **Search first**: check existing issues/PRs for duplicates.
2. **Open an issue** (recommended) for non-trivial changes:

   * What you’re changing and why
   * Expected behavior / acceptance criteria
   * Screenshots/logs if applicable
3. For security issues, **do not** open a public issue—use the project’s security contact or advisories.

---

## 3) How to Contribute

### Fork & Branch

* Fork the repository.
* Create a branch from `main`:

  * `feat/<short-topic>`
  * `fix/<short-topic>`
  * `docs/<short-topic>`
  * `chore/<short-topic>`

Example:

```bash
git checkout -b feat/add-export-button
```

### Commit Style

* Prefer **small, focused commits**.
* Use conventional-ish commit messages:

  * `feat: ...`
  * `fix: ...`
  * `docs: ...`
  * `refactor: ...`
  * `test: ...`
  * `chore: ...`

Example:

```bash
git commit -m "fix: prevent crash when config is missing"
```

---

## 4) Coding Standards

* Keep code readable: clear naming, minimal nesting, useful comments where needed.
* Avoid large rewrites in a single PR unless agreed in advance.
* Prefer deterministic output (avoid randomness unless it’s part of the feature).
* Follow existing project patterns and folder structure.

### Formatting & Linting

* Run formatter/linter before pushing.
* Don’t “format the whole repo” unless the PR is specifically a formatting PR.

---

## 5) Tests & Verification

Before opening a PR:

* Add or update tests when behavior changes.
* Run existing tests locally and ensure they pass.
* Include steps for reviewers to reproduce/verify your change.

If the repo has scripts, run:

```bash
npm test
npm run lint
# or
pytest
```

(Use whatever the project’s tooling is—match the repo.)

---

## 6) Documentation Requirements

If you change behavior, add features, or modify configuration:

* Update `README.md` / docs accordingly.
* Add usage examples when relevant.
* If you change flags/options, document defaults and edge cases.

---

## 7) Pull Request Rules

### PR Quality Checklist

Your PR should include:

* A clear title and description of **what** and **why**
* Linked issue(s) if applicable (`Fixes #123`)
* Screenshots/GIFs for UI changes
* Notes on breaking changes or migrations
* Performance impact notes (if relevant)

### Keep PRs Reviewable

* Prefer PRs under ~300–500 lines of meaningful diff (when possible).
* If bigger: split into logical PRs (refactor first, feature second).

---

## 8) Review & Merge Policy

* Maintainers may request changes for readability, correctness, security, or maintainability.
* Address review comments with follow-up commits (don’t rewrite history unless asked).
* A PR may be closed if it’s inactive, out-of-scope, or can’t be merged cleanly.

---

## 9) Security & Safety

* Don’t introduce:

  * Hardcoded secrets
  * Insecure defaults (e.g., open CORS/wildcard origins without justification)
  * Unsafe file operations or command execution without validation/sandboxing
* If your change touches auth, file IO, networking, or permissions: call it out in the PR.

---

## 10) Licensing & Attribution

* Your contribution must be compatible with the repository’s license.
* If adding third-party code/assets:

  * Provide license information
  * Add attribution if required
  * Avoid copy/paste from restricted sources

---

## 11) Contributor Checklist (Copy/Paste)

```md
- [ ] I searched existing issues/PRs to avoid duplicates
- [ ] I used a descriptive branch name
- [ ] I made small, focused commits with clear messages
- [ ] I ran tests/lint/format locally (or explained why not)
- [ ] I updated docs/README if behavior or usage changed
- [ ] I added screenshots/logs where helpful
- [ ] I did not include secrets or sensitive data
```

---

If you want, paste your repo’s tech stack (Node/Python/Maya/Unity/etc.) and I’ll tailor this to exact commands, tooling, and folder conventions.
