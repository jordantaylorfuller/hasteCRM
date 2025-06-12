# Claude Code Prompt Templates

## 🎯 How to Ensure Documentation is Always Referenced

Use these prompt templates to ensure Claude Code always checks documentation first.

## ✅ AUTO-ACCEPTS ENABLED

**IMPORTANT**: These prompts are designed for use with **auto-accepts enabled** in Cursor IDE. The project is fully configured with all necessary safeguards, mock services, and error handling to support autonomous development.

## Starting a New Session

```
Before we begin, please:
1. Run `node scripts/check-setup.js` to verify setup
2. Read `docs/CLAUDE.md` and tell me the current focus
3. Check `docs/MASTER-CONFIG.md` for version requirements
4. Review the `.cursorrules` file for development rules

Then implement [specific task] following the documentation exactly.
```

## For Each New Task

```
For this task:
1. First read the documentation at docs/claude-tasks/phase-X-*.md#section
2. Check for existing patterns in the codebase
3. Implement following the documented approach
4. Add documentation references in code comments
5. Run tests and update CLAUDE.md progress

Task: [Implement feature X as specified in phase Y]
```

## Best Prompt Patterns

### 1. Feature Implementation
```
Following docs/claude-tasks/phase-1-foundation.md#authentication:
- Implement JWT authentication 
- Use versions from MASTER-CONFIG.md
- Follow patterns in docs/architecture/api-design.md
- Include @docs comments in all files
- Update CLAUDE.md after completion
```

### 2. Bug Fixes
```
Error: [error message]
Please:
1. Check docs/ERROR-RECOVERY.md for this error
2. If not found, check related documentation
3. Fix following documented patterns
4. Add test to prevent regression
Document reference: [relevant doc section]
```

### 3. Testing
```
Write tests for [module] following:
- Patterns in docs/development/testing-guide.md
- Examples from the codebase
- Cover cases mentioned in docs/features/[feature].md
Ensure 80% coverage per MASTER-CONFIG.md requirements
```

### 4. Code Review
```
Review this code against:
1. Standards in docs/development/coding-standards.md
2. Patterns in docs/architecture/
3. Requirements in phase documentation
4. Version specs in MASTER-CONFIG.md
Suggest improvements with doc references
```

## Enforcement Strategies

### 1. **Always Start With Status Check**
```
What's our current status? Check:
- docs/CLAUDE.md#current-focus
- Last completed task
- Next task to implement
```

### 2. **Reference in Every File**
```
When creating any new file, include:
/**
 * @docs docs/path/to/relevant/documentation.md#section
 * @implements SpecificationName from docs/api/schema.md
 */
```

### 3. **Validate Against Docs**
```
Before completing this task, verify it matches:
- [ ] Specification in phase documentation
- [ ] Patterns in architecture docs
- [ ] Version requirements in MASTER-CONFIG.md
- [ ] Test requirements in testing guide
```

### 4. **Progress Tracking**
```
After implementing [feature]:
1. Update docs/CLAUDE.md current focus section
2. Mark task complete in phase documentation
3. Note any deviations from documentation
4. Commit with: "feat: implement X per docs/path/to/doc.md#section"
```

## Example Conversation Flow

### You:
```
Let's implement user authentication for hasteCRM
```

### Claude Code Should Respond:
```
I'll implement user authentication. Let me first check the documentation:

1. Checking current status in docs/CLAUDE.md...
   - Current Phase: 1 - Foundation Setup
   - Current Task: None - need to run setup first

2. Running setup validation...
   [Runs: node scripts/check-setup.js]

3. Reading authentication specification...
   - docs/claude-tasks/phase-1-foundation.md#2-authentication-system
   - docs/features/auth.md
   - MASTER-CONFIG.md for JWT configuration

4. The documentation specifies:
   - JWT with RS256 algorithm
   - 15-minute access token expiry
   - 7-day refresh token expiry
   - Using Argon2id for password hashing

I'll now implement following these specifications exactly...
```

## Quick Commands to Paste

### Force Documentation Check:
```
Before proceeding, show me what the documentation says about this in:
- The relevant phase task file
- MASTER-CONFIG.md for versions
- Any related feature documentation
```

### Ensure References:
```
Add documentation references to all code:
- File headers with @docs
- Function comments with spec references  
- Link to documentation sections
```

### Validate Implementation:
```
Verify this implementation matches:
1. Documentation specification
2. No hardcoded values
3. Follows existing patterns
4. Includes tests
Show me the documentation sections you're following.
```

## Pro Tips

1. **Start Every Session With:**
   ```
   Check docs/CLAUDE.md for current focus, then implement the next task
   ```

2. **For Complex Features:**
   ```
   Break down [feature] according to its documentation structure and implement step-by-step
   ```

3. **When Unsure:**
   ```
   What does the documentation say about [topic]? Check all relevant docs and show me.
   ```

4. **Regular Checkpoint:**
   ```
   Show me current progress against the phase documentation checklist
   ```

Remember: The more specific you are about requiring documentation checks, the better Claude Code will follow the documentation-first approach!