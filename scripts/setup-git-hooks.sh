#!/bin/bash

# Setup git hooks to enforce documentation references

echo "📝 Setting up git hooks for documentation enforcement..."

# Create hooks directory if it doesn't exist
mkdir -p .git/hooks

# Create pre-commit hook
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash

# Check if code files reference documentation

echo "🔍 Checking documentation references..."

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check staged TypeScript/JavaScript files
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(ts|tsx|js|jsx)$')

if [ -z "$STAGED_FILES" ]; then
    exit 0
fi

MISSING_REFS=0
WARNINGS=""

for FILE in $STAGED_FILES; do
    # Skip test files and config files
    if [[ "$FILE" =~ \.(test|spec|config)\.(ts|js) ]] || [[ "$FILE" =~ (jest|babel|webpack)\.config\. ]]; then
        continue
    fi
    
    # Check if file contains documentation reference
    if ! grep -q "@docs\|@implements\|Implementation.*docs/\|Based on.*docs/\|See:.*docs/" "$FILE" 2>/dev/null; then
        WARNINGS="${WARNINGS}\n  - $FILE (missing doc reference)"
        MISSING_REFS=$((MISSING_REFS + 1))
    fi
done

if [ $MISSING_REFS -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Warning: $MISSING_REFS files lack documentation references${NC}"
    echo -e "${YELLOW}Files missing references:$WARNINGS${NC}"
    echo ""
    echo "Consider adding documentation references like:"
    echo "  // @docs docs/claude-tasks/phase-X-feature.md#section"
    echo "  // Implementation based on: docs/api/graphql-schema.md#Type"
    echo ""
    echo "This is a warning only. Commit will proceed."
    echo ""
fi

# Check if CLAUDE.md might need updating
if git diff --cached --name-only | grep -qE "^(apps|packages)/.*\.(ts|tsx|js|jsx)$"; then
    echo -e "${YELLOW}📋 Reminder: Update docs/CLAUDE.md with your progress!${NC}"
fi

echo -e "${GREEN}✓ Pre-commit checks complete${NC}"
exit 0
EOF

# Make hook executable
chmod +x .git/hooks/pre-commit

# Create commit message template
cat > .gitmessage << 'EOF'
# <type>: <subject>
# |<----  Using a maximum of 50 characters  ---->|

# Explain why this change is being made
# |<----   Try to limit each line to 72 characters   ---->|

# Provide links to any relevant tickets, issues, or documentation
# Docs: docs/claude-tasks/phase-X-feature.md#section

# --- COMMIT END ---
# Type can be 
#   feat     (new feature)
#   fix      (bug fix)
#   refactor (code change that neither fixes a bug nor adds a feature)
#   style    (formatting, missing semicolons, etc; no code change)
#   docs     (changes to documentation)
#   test     (adding or refactoring tests; no production code change)
#   chore    (updating build tasks, package manager configs, etc)
# --------------------
# Remember to
#   - Reference documentation in your code
#   - Update docs/CLAUDE.md with progress
#   - Run tests before committing
# --------------------
EOF

# Configure git to use the template
git config --local commit.template .gitmessage

# Create pre-push hook to check for secrets
cat > .git/hooks/pre-push << 'EOF'
#!/bin/bash

# Prevent pushing files with potential secrets

echo "🔍 Checking for potential secrets before push..."

# Check for common secret file patterns
SECRET_FILES=$(git ls-files | grep -E "(secrets|credentials|apikey|api_key|private|\.key|\.pem)\.json$|^\.env$" | grep -v ".example")

if [ ! -z "$SECRET_FILES" ]; then
    echo "❌ BLOCKED: Found potential secret files:"
    echo "$SECRET_FILES"
    echo ""
    echo "These files should not be committed. Please:"
    echo "1. Remove them from git: git rm --cached <filename>"
    echo "2. Add them to .gitignore"
    echo "3. Use environment variables instead"
    echo ""
    echo "See docs/SECRETS-MANAGEMENT.md for guidance."
    exit 1
fi

# Scan for potential secrets in content
SUSPECT_CONTENT=$(git diff --cached --name-only | xargs grep -l -E "sk-[a-zA-Z0-9]{40,}|AIza[a-zA-Z0-9]{35}|[0-9a-f]{40}" 2>/dev/null || true)

if [ ! -z "$SUSPECT_CONTENT" ]; then
    echo "⚠️  WARNING: Found potential secrets in:"
    echo "$SUSPECT_CONTENT"
    echo ""
    echo "Please review these files for hardcoded secrets."
    echo "Press Ctrl+C to cancel, or Enter to continue anyway..."
    read
fi

echo "✅ Security check passed"
EOF

chmod +x .git/hooks/pre-push

echo "✅ Git hooks installed successfully!"
echo ""
echo "Features added:"
echo "  • Pre-commit hook checks for documentation references"
echo "  • Pre-push hook blocks secret files"
echo "  • Commit message template with documentation reminder"
echo "  • Progress update reminders"
echo ""
echo "To skip hooks temporarily: git commit --no-verify"