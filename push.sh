#!/bin/bash
# 1. Initialize git on the server
git init

# 2. Configure identity
git config user.name "Hailegiorgisy"
git config user.email "hailegiorgisy@gmail.com"

# 3. Set branch to main and connect to your GitHub repository
git branch -M main
git remote remove origin 2>/dev/null || true
git remote add origin https://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@github.com/Hailegiorgisy/telegram_korcha.git

# 4. Stage all updated files (respecting .gitignore) and commit
git add .
git commit -m "Full sync from Plesk server"

# 5. Push all files to GitHub
git push -u -f origin main