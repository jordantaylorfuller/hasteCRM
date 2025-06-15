# Detailed Coverage Gaps Analysis

## API Application - Specific Coverage Gaps

### 1. Authentication Module

#### auth.service.ts (73.17% coverage)

**Missing Coverage:**

- Line 111: Error handling in validateUser
- Line 151: OAuth profile validation
- Line 162: OAuth account creation error
- Lines 210-231: Password reset flow
- Lines 354-446: Entire refreshToken method
- Lines 490-529: Session management logic
- Lines 623-647: 2FA verification flow

**Branches to Cover:**

- OAuth provider validation (Google, GitHub)
- Password strength validation
- Session expiration handling
- 2FA backup codes

#### two-factor.service.ts (66.99% coverage)

**Missing Coverage:**

- Line 27: QR code generation error
- Line 59: Secret validation
- Line 95: Backup code generation
- Lines 193-203: Enable 2FA flow
- Lines 215-247: Disable 2FA flow
- Lines 294-327: Backup code verification

### 2. Gmail Integration

#### gmail.service.ts (63.49% coverage)

**Missing Coverage:**

- Lines 32-34: Constructor initialization
- Lines 158-217: getGmailClient method (OAuth refresh logic)
- Lines 245-269: Error handling in message fetching
- Lines 324-326: Attachment download errors

**Critical Branches:**

- OAuth token expiration and refresh
- API rate limit handling
- Network error recovery

#### gmail-sync.service.ts (66.66% coverage)

**Missing Coverage:**

- Line 46: Sync initialization
- Lines 79-80: History sync error handling
- Line 116: Full sync trigger logic
- Lines 211-278: Entire syncMessages method

### 3. Import/Export Module

#### import-export.resolver.ts (68.91% coverage)

**Missing Mutations to Test:**

- importContacts mutation
- exportContacts mutation
- getImportStatus query
- cancelImport mutation

### 4. App Module

#### app.module.ts (68.75% coverage)

**Missing Lines 44-59:**

- GraphQL module configuration
- Redis session configuration
- Global filters and interceptors setup

## Web Application - Specific Coverage Gaps

### 1. Page Components (0% coverage)

#### companies/page.tsx

- Component rendering
- Data fetching
- Error states
- User interactions

#### dashboard/page.tsx

- Analytics display
- Chart rendering
- Data aggregation
- Loading states

#### emails/page.tsx

- Email list rendering
- Email selection
- Search functionality
- Pagination

#### pipelines/page.tsx

- Pipeline board rendering
- Deal drag and drop
- Stage management
- Analytics display

#### settings/page.tsx

- Form validation
- Settings update
- 2FA configuration
- Email account management

#### register/page.tsx

- Form validation
- Password strength
- Email verification
- Error handling

#### verify-email/page.tsx

- Token validation
- Success/error states
- Redirect logic

### 2. Layout Component

#### layout.tsx (51.51% coverage)

**Missing Lines 25-27, 34-46, 49:**

- Navigation active state logic
- User menu interactions
- Logout functionality
- Mobile menu handling

### 3. Login Page

#### login/page.tsx (50% coverage)

**Missing Lines:**

- 50-51: Form submission error handling
- 58-59: OAuth login errors
- 105: Redirect after login

### 4. Pipeline Board

#### PipelineBoard.tsx (54.09% coverage)

**Missing Lines 125-127, 132-183:**

- Drag start handler
- Drag end handler
- Deal movement between stages
- Optimistic updates
- Error recovery

### 5. UI Components

#### dialog.tsx (75% coverage)

**Missing Lines 113-116, 119, 121:**

- Portal rendering
- Focus management
- Escape key handling

#### dropdown-menu.tsx (94.28% coverage)

**Missing Lines 186-187:**

- Sub-menu trigger handling

#### select.tsx (79.16% coverage)

**Missing Lines 146, 150, 152-154:**

- Keyboard navigation
- Multi-select logic

## Testing Priorities

### Critical (Security & Data Integrity):

1. Auth refresh token flow
2. OAuth token refresh
3. 2FA complete flow
4. Password reset process
5. Session management

### High (Core Features):

1. Gmail sync error recovery
2. Import/export error handling
3. Pipeline board drag/drop
4. All page component rendering

### Medium (User Experience):

1. Form validation errors
2. Loading states
3. Navigation states
4. UI component interactions

### Low (Edge Cases):

1. Keyboard navigation in selects
2. Dialog focus trapping
3. Mobile menu interactions

## Recommended Test Scenarios

### Authentication:

```typescript
// Test refresh token rotation
it("should rotate refresh token on use");
it("should handle expired refresh tokens");
it("should prevent refresh token reuse");

// Test OAuth scenarios
it("should refresh expired Google OAuth tokens");
it("should handle OAuth consent revocation");
```

### Gmail Integration:

```typescript
// Test sync recovery
it("should resume sync after network failure");
it("should handle rate limit errors with backoff");
it("should recover from partial sync failure");

// Test webhook processing
it("should process webhooks in order");
it("should handle duplicate webhooks");
```

### UI Components:

```typescript
// Test drag and drop
it("should move deal between stages");
it("should cancel drag on escape");
it("should show drop indicators");

// Test form validation
it("should validate email format");
it("should enforce password requirements");
it("should show field-level errors");
```
