# Security note — action required before you submit or push again

## What was found

The uploaded project contained `flowvoice.zip` (~79MB) at the repo root — an
old full snapshot of the project, including `backend/.env` **with real,
filled-in values** for:

- `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`
- `RIME_API_KEY`

This zip has been **removed** from the copy returned to you. It is not safe
to include in your submission — the challenge rules explicitly disqualify a
submission that "exposes a live credential or other secret," and any
repository that has ever contained this zip (even in an old commit) still
has the keys in its git history, retrievable by anyone with read access,
even after the file is deleted in a later commit.

## What you need to do right now

1. **Rotate every key that was in that file** — treat all four values above
   as compromised:
   - LiveKit: regenerate the API key/secret pair for the project in the
     LiveKit Cloud dashboard.
   - Rime: revoke the old API key and issue a new one from the Rime
     dashboard.
2. **Check your git history.** If `flowvoice.zip` (or any `.env`) was ever
   committed and pushed, deleting it in a new commit is not enough — the
   old blob is still fetchable from history. Use `git log --all --
   flowvoice.zip` to check, and if it's there, either:
   - Start the submission from a fresh repo/orphan branch containing only
     the current, cleaned tree (simplest, safest before a deadline), or
   - Purge it with `git filter-repo` (or the BFG Repo-Cleaner) and force-push,
     then have every collaborator re-clone.
3. Put the **new** keys only in a local `backend/.env`, which is now covered
   by `.gitignore` at both the repo root and `backend/`. Never zip the repo
   from a location that includes `.env` — zip from a clean `git archive` or
   a fresh clone instead.
4. Double check `frontend/.env` (if you create one from the new
   `frontend/.env.example`) never contains a secret — it should only ever
   hold `VITE_TOKEN_SERVER_URL`, a plain URL, not an API key.

## Why this matters for judging specifically

The problem statement's build rules say: *"Protect credentials. Keep Rime
and other service credentials in server-side secrets... Never commit
credentials to source, documentation, screenshots, recordings, or client
code."* and lists *"Exposes a live credential or other secret"* under
submissions that are **not eligible for judging**. Rotating the keys and
making sure the clean history is what you submit resolves this.
