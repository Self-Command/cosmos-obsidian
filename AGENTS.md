# Repository Agent Rules

- Do not use subagents or delegate repository work to other agents.
- This is an independent replacement project. Do not patch the frozen legacy repository or installed legacy skills.
- The user approved development design 1.0 and its implementation plan on 2026-10-11. Implement the independent replacement in stages; install and retire only after the documented acceptance gates pass.
- Record every inherited behavior or source fragment in `docs/design/reuse-audit.md` with its reason, limitations, and validation evidence. A legacy test pass is not acceptance evidence for this project.
- Build and execute automated tests in GitHub Actions. Local work may edit source and documentation, inspect files, and verify downloaded artifact hashes.
- Never commit vault contents, local bindings, credentials, account settings, raw personal sessions, or private retirement inventories.
- All release artifacts must function without the legacy checkout, executor, state paths, or remote repository.
- Delete legacy local files and the legacy remote repository only after the retirement conditions in `docs/design/migration-retirement.md` are met. User authorization for that final deletion is already given; the conditions must still be verified.
