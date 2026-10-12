# Repository Agent Rules

- Do not use subagents or delegate repository work to other agents.
- This is the production distribution repository. Keep runtime files, skills, user documentation, configuration examples, licenses, and release verification only.
- Preserve the accepted runtime bytes and original candidate identity in `runtime/manifest.json`. A packaging or documentation change must not claim a new functional acceptance campaign.
- Run executable verification and packaging in GitHub Actions. Local work may edit documentation and release scripts, inspect files, and verify artifact hashes.
- Never commit vault contents, local bindings, credentials, account settings, raw personal sessions, or private retirement inventories.
- All release artifacts must function without the legacy checkout, executor, state paths, or remote repository.
