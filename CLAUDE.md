# Git sequence

After any edit, commit and push with: `git add .` / `git commit -m "[description]"` / `git push`.

If the push is rejected because origin is ahead, run `git fetch` and report the incoming commit before rebasing.

Pushing inside `eleventy-site/` triggers an automatic deploy via GitHub Actions.

"Commit and push" means this full sequence.

## MOS Guardrails

### Editorial law (applies to anything written into people.json, templates, or captions)
- No em-dashes. No double hyphens. No spaced hyphen as a separator (use a pipe or colon).
  Hyphens inside the real title of a work are fine and are never reworked.
- "Of" in Masters Of Sight is always capitalized.
- Bios: 3-5 dense, precise sentences. Exceptions that may run longer: Bungie,
  Naughty Dog, Rockstar Games, Steven Spielberg.
- Traits: exactly five specific, observable qualities.
- Works: 3-5, one precise detail each. If a year can't be verified, omit it.
- No philosophy or ethos section on any profile. The galleryLayout key must never
  appear in people.json.
- Never state a specific creator count in copy. The homepage count line, computed
  at build time, is the only exception.

### Pre-flight before any edit to eleventy-site/src/_data/people.json
1. Grep for ID collisions before inserting.
2. Place by last name. Do NOT fix the known anomalies (gmunk, annie-liebovitz)
   as a side effect of another edit.
3. In galleryMedia, video objects are always last. Minimum four images.
4. Every ID in a related array must exist.
5. Cloudinary URLs carry f_auto,q_auto after /upload/ and before the version
   string, never as query parameters.
6. Never guess external links (JustWatch, Bookshop.org, platform badges). Mark
   them [VERIFY] and ask.
7. Validate JSON after every edit, and run the validate script once it exists.
8. Touch only the requested entry. For any change inside eleventy-site/,
   commit locally and do not push until Benny says "push", because a push
   there is a live deploy. This is the one exception to the Git sequence
   above. When Benny says "commit and push" explicitly, run the full
   sequence as written. Changes outside eleventy-site/ (like CLAUDE.md
   itself) do not trigger a deploy and follow the Git sequence normally.

### Secrets
Never read, print, or commit .env files or any API key or secret.
