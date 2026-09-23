# Git sequence

After any edit, commit and push with: `git add .` / `git commit -m "[description]"` / `git push`.

If the push is rejected because origin is ahead, run `git fetch` and report the incoming commit before rebasing.

Pushing inside `eleventy-site/` triggers an automatic deploy via GitHub Actions.

"Commit and push" means this full sequence.
