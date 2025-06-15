# Test Coverage Report - hasteCRM

## Summary

### API Application (`apps/api/`)

- **Total Tests**: 967 tests passing
- **Test Suites**: 65 passed, 65 total
- **Execution Time**: ~4.8 seconds

#### Coverage Percentages:

- **Statements**: 89.1% (2960/3322)
- **Branches**: 77.14% (1333/1728)
- **Functions**: 76.03% (498/655)
- **Lines**: 88.61% (2762/3117)

### Web Application (`apps/web/`)

- **Total Tests**: 601 passing, 66 failing, 3 skipped
- **Test Suites**: 32 passed, 12 failed, 44 total
- **Execution Time**: ~21.2 seconds

#### Coverage Percentages:

- **Statements**: ~86.29%
- **Branches**: ~73.46%
- **Functions**: ~82.14%
- **Lines**: ~86.48%

## Files Needing Attention (< 100% Coverage)

### API - Low Coverage Files:

1. **Auth Module** (Low coverage areas):

   - `auth.service.ts`: 73.17% statements (missing coverage for password reset, OAuth flows)
   - `two-factor.service.ts`: 66.99% statements (missing 2FA setup/verification flows)
   - `google.strategy.ts`: 60% statements (OAuth callback handling)

2. **Gmail Module**:

   - `gmail.service.ts`: 63.49% statements (missing Gmail API error handling)
   - `gmail-sync.service.ts`: 66.66% statements (sync error scenarios)
   - `gmail-history.service.ts`: 72% statements (history sync edge cases)
   - `email-parser.service.ts`: 81.3% statements (attachment parsing)

3. **Import/Export Module**:

   - `import-export.resolver.ts`: 68.91% statements (bulk operations)
   - `contact-export.service.ts`: 82.05% statements (Excel export)
   - `contact-import.service.ts`: 86% statements (CSV parsing errors)

4. **Companies & Contacts**:

   - `companies.resolver.ts`: 72.72% statements (GraphQL mutations)
   - `contacts.resolver.ts`: 69.11% statements (complex queries)

5. **Pipelines Module**:

   - `pipelines.resolver.ts`: 72.94% statements (automation triggers)
   - `pipeline-analytics.service.ts`: 92.59% statements (edge cases in analytics)

6. **Core Modules**:
   - `app.module.ts`: 68.75% statements (dynamic module loading)
   - `main.ts`: 97.61% statements (missing one error case)

### Web - Low Coverage Files:

1. **API Client**:

   - `lib/api.ts`: 22.58% statements (needs comprehensive testing)

2. **Page Components** (Missing tests):

   - Dashboard pages need test coverage
   - Email pages have no tests
   - Settings page needs more coverage

3. **UI Components**:

   - `dropdown-menu.tsx`: 94.28% statements
   - `dialog.tsx`: 75% statements
   - `select.tsx`: 79.16% statements
   - `scroll-area.tsx`: 85.71% statements

4. **Feature Components**:
   - `PipelineBoard.tsx`: 54.09% statements (drag-drop functionality)
   - `ContactImportWizard.tsx`: 69.69% statements (import flows)
   - `EmailComposer.tsx`: 85% statements (AI features)

## Recommendations

### Priority 1 - Critical Gaps:

1. **Web API Client** - Only 22.58% coverage, critical for all features
2. **Auth Services** - Security-critical code needs full coverage
3. **Gmail Integration** - Core feature with multiple low-coverage files

### Priority 2 - Feature Completeness:

1. **Import/Export** - User-facing feature needs error case coverage
2. **Pipeline Board** - Complex UI interactions need testing
3. **GraphQL Resolvers** - API endpoints need full coverage

### Priority 3 - UI Polish:

1. **Dashboard Pages** - Add integration tests
2. **UI Components** - Complete coverage for all components
3. **Email Features** - Test email viewing/composing flows

## Next Steps

To achieve 100% coverage:

1. Add ~355 more tests for API (focusing on error cases)
2. Fix failing Web tests and add ~200 more tests
3. Focus on integration tests for complex features
4. Add E2E tests for critical user flows
