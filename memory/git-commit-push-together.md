---
name: git-commit-push-together
description: When committing, always push in the same flow — never commit then pause
metadata:
  type: feedback
---

When the user asks to commit (or to "push the code"), do `git add` → `git commit` → `git push` as one continuous flow. Do not stop after the commit to verify before pushing.

**Why:** The user said "always do push when you do the add and commit" — they rejected a standalone push step that came after a separate commit. They want the three combined, not split into a commit-then-confirm-then-push sequence.

**How to apply:** On this repo (origin `github.com/MelvinDenish/PRISM`, working branch `wip/pre-m1-working-changes`), chain add+commit+push. `.env`/`client/.env` are gitignored (safe), so a full `git add -A` won't leak secrets. The branch tracks origin and pushes fast-forward.
