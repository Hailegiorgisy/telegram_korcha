#!/bin/bash
set -e

# 1. Configure author details
git config user.name "Hailegiorgisy"
git config user.email "hgyirgu1@gmail.com"

# 2. Ensure sensitive files (.env, node_modules) are strictly ignored
cat << 'EOF' > .gitignore
node_modules/
.env
uploads/
dist/
.DS_Store
EOF

# Unstage .env if it was previously tracked
git rm --cached .env 2>/dev/null || true

# 3. Ensure the current branch is 'main'
git checkout -B main

# 4. Stage all files (respecting .gitignore)
git add -A

# 5. Commit changes
git commit -m "Full update: bot, mini app, and dependencies from plesk" || echo "No new changes to commit"

# 6. Push and overwrite main directly on GitHub
git push -u -f origin main