#!/bin/bash
# 1. Configure author
git config user.name "Hailegiorgisy"
git config user.email "hgyirgu1@gmail.com"

# 2. Add ALL files, components, and code on the server
git add -A

# 3. Commit everything
git commit -m "Full update: bot, mini app, and dependencies from plesk" || true

# 4. Overwrite main directly on GitHub (bypasses pull requests)
git push -u -f origin server-sync:main