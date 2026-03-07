#!/usr/bin/env bash
# Demo script for RepoKeeper
# This is used with asciinema to record the demo

set -e

echo "# RepoKeeper Demo"
echo "# ================"
echo ""
sleep 1

echo "# Starting RepoKeeper..."
echo "$ pnpm start"
sleep 1
echo '{"timestamp":"...","level":"info","message":"RepoKeeper listening on port 3001"}'
echo '{"timestamp":"...","level":"info","message":"AI provider: claude (claude-haiku-4-5)"}'
echo '{"timestamp":"...","level":"info","message":"Triage: enabled"}'
echo '{"timestamp":"...","level":"info","message":"PR summariser: enabled"}'
echo ""
sleep 2

echo "# Creating a test issue via GitHub CLI..."
echo '$ gh issue create --title "Login page crashes on mobile" --body "The login page crashes when I try to log in on my iPhone. I see a white screen after tapping the login button. Using Safari on iOS 17. The error in console shows: TypeError: Cannot read property of undefined."'
sleep 2

echo ""
echo "# Issue created: #7"
echo ""
sleep 1

echo "# RepoKeeper received the webhook and is triaging..."
sleep 1
echo '{"level":"info","message":"Received webhook: issues.opened"}'
echo '{"level":"info","message":"Triaging issue #7: Login page crashes on mobile"}'
sleep 1
echo '{"level":"info","message":"Added labels [bug] to #7"}'
echo '{"level":"info","message":"Posted comment on #7"}'
echo '{"level":"info","message":"Issue #7 classified as \"bug\", labelled [bug]"}'
echo ""
sleep 2

echo "# Checking the issue on GitHub..."
echo '$ gh issue view 7 --repo GodsBoy/repokeeper'
echo ""
echo "Login page crashes on mobile        #7"
echo "Open · GodsBoy opened about 1 minute ago · 1 comment"
echo ""
echo "Labels: bug"
echo ""
echo "  The login page crashes when I try to log in on my iPhone. I see a"
echo "  white screen after tapping the login button. Using Safari on iOS 17."
echo "  The error in console shows: TypeError: Cannot read property of undefined."
echo ""
echo "--- RepoKeeper comment ---"
echo "  Thanks for reporting this crash on the mobile login page. The TypeError"
echo "  you're seeing on Safari iOS 17 suggests a compatibility issue we'll need"
echo "  to investigate. We'll look into this and follow up."
echo ""
sleep 3

echo "# RepoKeeper automatically:"
echo "#   1. Classified the issue as 'bug'"
echo "#   2. Applied the 'bug' label"
echo "#   3. Posted a contextual comment referencing the specific issue"
echo ""
echo "# That's RepoKeeper — AI-powered repo maintenance on autopilot."
sleep 2
