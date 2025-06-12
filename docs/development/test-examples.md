# Test Examples for hasteCRM

## Overview

This document provides comprehensive test examples for each phase of hasteCRM development. All tests use Jest, React Testing Library, and MSW for API mocking.

## Table of Contents

1. [Test Setup](#test-setup)
2. [Phase 1: Foundation Tests](#phase-1-foundation-tests)
3. [Phase 2: Contact Management Tests](#phase-2-contact-management-tests)
4. [Phase 3: Gmail Integration Tests](#phase-3-gmail-integration-tests)
5. [Test Utilities](#test-utilities)
6. [Mock Data](#mock-data)

## Test Setup

### Jest Configuration

```javascript
// jest.config.js
const nextJest = require('next/jest')

const createJestConfig = nextJest({
  dir: './',
})

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleDirectories: ['node_modules', '<rootDir>/'],
  testEnvironment: 'jest-environment-jsdom',
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{js,jsx,ts,tsx}',
    '!src/tests/**',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
}

module.exports = createJestConfig(customJestConfig)
```

### Test Setup File

```javascript
// jest.setup.js
import '@testing-library/jest-dom'
import { server } from './src/tests/mocks/server'
import { cleanup } from '@testing-library/react'
import { mockRouter } from './src/tests/mocks/next-router'

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  usePathname: () => mockRouter.pathname,
  useSearchParams: () => new URLSearchParams(mockRouter.query),
}))

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
})

// Establish API mocking before all tests
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))

// Reset any request handlers that we may add during the tests
afterEach(() => {
  server.resetHandlers()
  cleanup()
  jest.clearAllMocks()
})

// Clean up after the tests are finished
afterAll(() => server.close())
```

## Phase 1: Foundation Tests

### Authentication Tests

```typescript
// tests/auth/login.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LoginPage } from '@/app/(auth)/login/page'
import { server } from '@/tests/mocks/server'
import { rest } from 'msw'
import { mockRouter } from '@/tests/mocks/next-router'

describe('Login Page', () => {
  beforeEach(() => {
    mockRouter.push.mockClear()
  })

  it('renders login form', () => {
    render(<LoginPage />)
    
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
    expect(screen.getByText(/don't have an account/i)).toBeInTheDocument()
  })

  it('validates required fields', async () => {
    const user = userEvent.setup()
    render(<LoginPage />)
    
    const submitButton = screen.getByRole('button', { name: /sign in/i })
    await user.click(submitButton)
    
    expect(await screen.findByText(/email is required/i)).toBeInTheDocument()
    expect(await screen.findByText(/password is required/i)).toBeInTheDocument()
  })

  it('validates email format', async () => {
    const user = userEvent.setup()
    render(<LoginPage />)
    
    const emailInput = screen.getByLabelText(/email/i)
    await user.type(emailInput, 'invalid-email')
    await user.tab()
    
    expect(await screen.findByText(/invalid email address/i)).toBeInTheDocument()
  })

  it('handles successful login', async () => {
    const user = userEvent.setup()
    render(<LoginPage />)
    
    const emailInput = screen.getByLabelText(/email/i)
    const passwordInput = screen.getByLabelText(/password/i)
    const submitButton = screen.getByRole('button', { name: /sign in/i })
    
    await user.type(emailInput, 'test@haste.nyc')
    await user.type(passwordInput, 'password123')
    await user.click(submitButton)
    
    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith('/dashboard')
    })
    
    expect(screen.queryByText(/invalid credentials/i)).not.toBeInTheDocument()
  })

  it('handles login failure', async () => {
    server.use(
      rest.post('/api/auth/login', (req, res, ctx) => {
        return res(
          ctx.status(401),
          ctx.json({ message: 'Invalid credentials' })
        )
      })
    )
    
    const user = userEvent.setup()
    render(<LoginPage />)
    
    const emailInput = screen.getByLabelText(/email/i)
    const passwordInput = screen.getByLabelText(/password/i)
    const submitButton = screen.getByRole('button', { name: /sign in/i })
    
    await user.type(emailInput, 'test@haste.nyc')
    await user.type(passwordInput, 'wrongpassword')
    await user.click(submitButton)
    
    expect(await screen.findByText(/invalid credentials/i)).toBeInTheDocument()
    expect(mockRouter.push).not.toHaveBeenCalled()
  })

  it('shows loading state during submission', async () => {
    const user = userEvent.setup()
    render(<LoginPage />)
    
    const emailInput = screen.getByLabelText(/email/i)
    const passwordInput = screen.getByLabelText(/password/i)
    const submitButton = screen.getByRole('button', { name: /sign in/i })
    
    await user.type(emailInput, 'test@haste.nyc')
    await user.type(passwordInput, 'password123')
    
    const promise = user.click(submitButton)
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled()
    })
    
    await promise
  })
})
```

### JWT Token Management Tests

```typescript
// tests/auth/tokenManager.test.ts
import { TokenManager } from '@/lib/auth/tokenManager'
import { server } from '@/tests/mocks/server'
import { rest } from 'msw'

describe('TokenManager', () => {
  let tokenManager: TokenManager
  
  beforeEach(() => {
    tokenManager = new TokenManager()
    localStorage.clear()
  })
  
  describe('Token Storage', () => {
    it('stores tokens securely', () => {
      const accessToken = 'access-token-123'
      const refreshToken = 'refresh-token-456'
      
      tokenManager.setTokens({ accessToken, refreshToken })
      
      expect(tokenManager.getAccessToken()).toBe(accessToken)
      expect(tokenManager.getRefreshToken()).toBe(refreshToken)
    })
    
    it('clears tokens on logout', () => {
      tokenManager.setTokens({
        accessToken: 'access-token',
        refreshToken: 'refresh-token'
      })
      
      tokenManager.clearTokens()
      
      expect(tokenManager.getAccessToken()).toBeNull()
      expect(tokenManager.getRefreshToken()).toBeNull()
    })
  })
  
  describe('Token Validation', () => {
    it('validates token expiry', () => {
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.4Adcj3UFYzPUVaVF43FmMab6RlaQD8A9V8wFzzht-KQ'
      const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjk5OTk5OTk5OTl9.Vg30C57s3l90JNap_VgMhKZjfc-p7SoBXaSAy8c6BS8'
      
      expect(tokenManager.isTokenExpired(expiredToken)).toBe(true)
      expect(tokenManager.isTokenExpired(validToken)).toBe(false)
    })
    
    it('handles invalid tokens', () => {
      expect(tokenManager.isTokenExpired('invalid-token')).toBe(true)
      expect(tokenManager.isTokenExpired('')).toBe(true)
      expect(tokenManager.isTokenExpired(null)).toBe(true)
    })
  })
  
  describe('Token Refresh', () => {
    it('refreshes expired access token', async () => {
      tokenManager.setTokens({
        accessToken: 'expired-access-token',
        refreshToken: 'valid-refresh-token'
      })
      
      const newTokens = await tokenManager.refreshTokens()
      
      expect(newTokens.accessToken).toBe('new-access-token')
      expect(newTokens.refreshToken).toBe('new-refresh-token')
      expect(tokenManager.getAccessToken()).toBe('new-access-token')
    })
    
    it('handles refresh token failure', async () => {
      server.use(
        rest.post('/api/auth/refresh', (req, res, ctx) => {
          return res(ctx.status(401))
        })
      )
      
      tokenManager.setTokens({
        accessToken: 'expired-access-token',
        refreshToken: 'invalid-refresh-token'
      })
      
      await expect(tokenManager.refreshTokens()).rejects.toThrow('Token refresh failed')
      expect(tokenManager.getAccessToken()).toBeNull()
      expect(tokenManager.getRefreshToken()).toBeNull()
    })
  })
})
```

### Authorization Tests

```typescript
// tests/auth/authorization.test.tsx
import { render, screen } from '@testing-library/react'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { useAuthStore } from '@/stores/authStore'
import { mockRouter } from '@/tests/mocks/next-router'

jest.mock('@/stores/authStore')

describe('ProtectedRoute', () => {
  const mockUseAuthStore = useAuthStore as jest.MockedFunction<typeof useAuthStore>
  
  beforeEach(() => {
    mockRouter.push.mockClear()
  })
  
  it('renders children when authenticated', () => {
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: true,
      user: { id: '1', email: 'test@haste.nyc', role: 'USER' },
    })
    
    render(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>
    )
    
    expect(screen.getByText('Protected Content')).toBeInTheDocument()
  })
  
  it('redirects to login when not authenticated', () => {
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: false,
      user: null,
    })
    
    render(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>
    )
    
    expect(mockRouter.push).toHaveBeenCalledWith('/login')
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })
  
  it('enforces role-based access', () => {
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: true,
      user: { id: '1', email: 'test@haste.nyc', role: 'USER' },
    })
    
    render(
      <ProtectedRoute requiredRole="ADMIN">
        <div>Admin Content</div>
      </ProtectedRoute>
    )
    
    expect(screen.getByText('Access Denied')).toBeInTheDocument()
    expect(screen.queryByText('Admin Content')).not.toBeInTheDocument()
  })
  
  it('allows access with correct role', () => {
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: true,
      user: { id: '1', email: 'test@haste.nyc', role: 'ADMIN' },
    })
    
    render(
      <ProtectedRoute requiredRole="ADMIN">
        <div>Admin Content</div>
      </ProtectedRoute>
    )
    
    expect(screen.getByText('Admin Content')).toBeInTheDocument()
  })
})
```

## Phase 2: Contact Management Tests

### Contact CRUD Tests

```typescript
// tests/contacts/contactCrud.test.ts
import { renderWithProviders, screen, waitFor } from '@/tests/utils'
import userEvent from '@testing-library/user-event'
import { ContactForm } from '@/components/contacts/ContactForm'
import { server } from '@/tests/mocks/server'
import { rest } from 'msw'

describe('Contact CRUD Operations', () => {
  describe('Create Contact', () => {
    it('creates a new contact successfully', async () => {
      const user = userEvent.setup()
      const onSuccess = jest.fn()
      
      renderWithProviders(<ContactForm onSuccess={onSuccess} />)
      
      // Fill form
      await user.type(screen.getByLabelText(/first name/i), 'John')
      await user.type(screen.getByLabelText(/last name/i), 'Doe')
      await user.type(screen.getByLabelText(/email/i), 'john@haste.nyc')
      await user.type(screen.getByLabelText(/phone/i), '+1234567890')
      await user.type(screen.getByLabelText(/title/i), 'CEO')
      await user.type(screen.getByLabelText(/company/i), 'Acme Corp')
      
      // Submit
      await user.click(screen.getByRole('button', { name: /create/i }))
      
      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled()
      })
      
      expect(screen.getByText(/contact created successfully/i)).toBeInTheDocument()
    })
    
    it('validates required fields', async () => {
      const user = userEvent.setup()
      renderWithProviders(<ContactForm />)
      
      // Submit without filling required fields
      await user.click(screen.getByRole('button', { name: /create/i }))
      
      expect(await screen.findByText(/first name is required/i)).toBeInTheDocument()
      expect(await screen.findByText(/last name is required/i)).toBeInTheDocument()
    })
    
    it('validates email format', async () => {
      const user = userEvent.setup()
      renderWithProviders(<ContactForm />)
      
      await user.type(screen.getByLabelText(/email/i), 'invalid-email')
      await user.tab()
      
      expect(await screen.findByText(/invalid email address/i)).toBeInTheDocument()
    })
    
    it('handles API errors gracefully', async () => {
      server.use(
        rest.post('/api/contacts', (req, res, ctx) => {
          return res(
            ctx.status(422),
            ctx.json({
              message: 'Validation failed',
              errors: { email: 'Email already exists' }
            })
          )
        })
      )
      
      const user = userEvent.setup()
      renderWithProviders(<ContactForm />)
      
      await user.type(screen.getByLabelText(/first name/i), 'John')
      await user.type(screen.getByLabelText(/last name/i), 'Doe')
      await user.type(screen.getByLabelText(/email/i), 'existing@haste.nyc')
      
      await user.click(screen.getByRole('button', { name: /create/i }))
      
      expect(await screen.findByText(/email already exists/i)).toBeInTheDocument()
    })
  })
  
  describe('Update Contact', () => {
    const mockContact = {
      id: '1',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@haste.nyc',
      phone: '+1234567890',
      title: 'CEO',
      company: { id: '1', name: 'Acme Corp' },
    }
    
    it('updates contact successfully', async () => {
      const user = userEvent.setup()
      const onSuccess = jest.fn()
      
      renderWithProviders(
        <ContactForm contact={mockContact} onSuccess={onSuccess} />
      )
      
      // Update fields
      const titleInput = screen.getByLabelText(/title/i)
      await user.clear(titleInput)
      await user.type(titleInput, 'CTO')
      
      // Submit
      await user.click(screen.getByRole('button', { name: /update/i }))
      
      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled()
      })
      
      expect(screen.getByText(/contact updated successfully/i)).toBeInTheDocument()
    })
  })
  
  describe('Delete Contact', () => {
    it('deletes contact with confirmation', async () => {
      const user = userEvent.setup()
      const onDelete = jest.fn()
      
      renderWithProviders(
        <ContactCard 
          contact={mockContact} 
          onDelete={onDelete}
        />
      )
      
      // Click delete button
      await user.click(screen.getByRole('button', { name: /delete/i }))
      
      // Confirm in dialog
      expect(screen.getByText(/are you sure/i)).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: /confirm/i }))
      
      await waitFor(() => {
        expect(onDelete).toHaveBeenCalledWith('1')
      })
    })
  })
})
```

### Contact Search Tests

```typescript
// tests/contacts/contactSearch.test.tsx
import { renderWithProviders, screen, waitFor } from '@/tests/utils'
import userEvent from '@testing-library/user-event'
import { ContactSearch } from '@/components/contacts/ContactSearch'
import { server } from '@/tests/mocks/server'
import { rest } from 'msw'

describe('Contact Search', () => {
  it('searches contacts by name', async () => {
    const user = userEvent.setup()
    const onResults = jest.fn()
    
    renderWithProviders(<ContactSearch onResults={onResults} />)
    
    const searchInput = screen.getByPlaceholderText(/search contacts/i)
    await user.type(searchInput, 'john')
    
    await waitFor(() => {
      expect(onResults).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ firstName: 'John' })
        ])
      )
    })
  })
  
  it('debounces search requests', async () => {
    const user = userEvent.setup()
    let requestCount = 0
    
    server.use(
      rest.get('/api/contacts/search', (req, res, ctx) => {
        requestCount++
        return res(ctx.json({ data: [] }))
      })
    )
    
    renderWithProviders(<ContactSearch />)
    
    const searchInput = screen.getByPlaceholderText(/search contacts/i)
    
    // Type quickly
    await user.type(searchInput, 'test query')
    
    // Wait for debounce
    await waitFor(() => {
      expect(requestCount).toBe(1) // Only one request after debounce
    })
  })
  
  it('shows no results message', async () => {
    server.use(
      rest.get('/api/contacts/search', (req, res, ctx) => {
        return res(ctx.json({ data: [] }))
      })
    )
    
    const user = userEvent.setup()
    renderWithProviders(<ContactSearch />)
    
    await user.type(screen.getByPlaceholderText(/search contacts/i), 'nonexistent')
    
    expect(await screen.findByText(/no contacts found/i)).toBeInTheDocument()
  })
  
  it('handles search errors', async () => {
    server.use(
      rest.get('/api/contacts/search', (req, res, ctx) => {
        return res(ctx.status(500))
      })
    )
    
    const user = userEvent.setup()
    renderWithProviders(<ContactSearch />)
    
    await user.type(screen.getByPlaceholderText(/search contacts/i), 'error')
    
    expect(await screen.findByText(/search failed/i)).toBeInTheDocument()
  })
})
```

### Contact Import/Export Tests

```typescript
// tests/contacts/importExport.test.tsx
import { renderWithProviders, screen, waitFor } from '@/tests/utils'
import userEvent from '@testing-library/user-event'
import { ContactImport } from '@/components/contacts/ContactImport'
import { ContactExport } from '@/components/contacts/ContactExport'

describe('Contact Import/Export', () => {
  describe('Import', () => {
    it('imports CSV file successfully', async () => {
      const user = userEvent.setup()
      const onComplete = jest.fn()
      
      renderWithProviders(<ContactImport onComplete={onComplete} />)
      
      const file = new File(
        ['firstName,lastName,email\nJohn,Doe,john@haste.nyc'],
        'contacts.csv',
        { type: 'text/csv' }
      )
      
      const input = screen.getByLabelText(/upload csv/i)
      await user.upload(input, file)
      
      expect(await screen.findByText(/1 contact ready to import/i)).toBeInTheDocument()
      
      await user.click(screen.getByRole('button', { name: /import/i }))
      
      await waitFor(() => {
        expect(onComplete).toHaveBeenCalledWith({ imported: 1, failed: 0 })
      })
    })
    
    it('validates CSV format', async () => {
      const user = userEvent.setup()
      renderWithProviders(<ContactImport />)
      
      const invalidFile = new File(
        ['invalid,csv,format'],
        'invalid.csv',
        { type: 'text/csv' }
      )
      
      const input = screen.getByLabelText(/upload csv/i)
      await user.upload(input, invalidFile)
      
      expect(await screen.findByText(/invalid csv format/i)).toBeInTheDocument()
    })
    
    it('shows import preview', async () => {
      const user = userEvent.setup()
      renderWithProviders(<ContactImport />)
      
      const file = new File(
        [
          'firstName,lastName,email,phone,company\n' +
          'John,Doe,john@haste.nyc,+1234567890,Acme Corp\n' +
          'Jane,Smith,jane@haste.nyc,+0987654321,Tech Inc'
        ],
        'contacts.csv',
        { type: 'text/csv' }
      )
      
      const input = screen.getByLabelText(/upload csv/i)
      await user.upload(input, file)
      
      expect(await screen.findByText(/2 contacts ready to import/i)).toBeInTheDocument()
      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.getByText('Jane Smith')).toBeInTheDocument()
    })
  })
  
  describe('Export', () => {
    it('exports contacts to CSV', async () => {
      const user = userEvent.setup()
      const mockDownload = jest.fn()
      global.URL.createObjectURL = jest.fn()
      global.URL.revokeObjectURL = jest.fn()
      
      // Mock download
      const link = document.createElement('a')
      jest.spyOn(document, 'createElement').mockReturnValue(link)
      jest.spyOn(link, 'click').mockImplementation(mockDownload)
      
      renderWithProviders(<ContactExport />)
      
      await user.click(screen.getByRole('button', { name: /export to csv/i }))
      
      await waitFor(() => {
        expect(mockDownload).toHaveBeenCalled()
      })
    })
    
    it('allows field selection for export', async () => {
      const user = userEvent.setup()
      renderWithProviders(<ContactExport />)
      
      await user.click(screen.getByRole('button', { name: /configure export/i }))
      
      // Deselect some fields
      await user.click(screen.getByRole('checkbox', { name: /notes/i }))
      await user.click(screen.getByRole('checkbox', { name: /tags/i }))
      
      await user.click(screen.getByRole('button', { name: /export/i }))
      
      // Verify export was called with selected fields
      expect(screen.getByText(/export completed/i)).toBeInTheDocument()
    })
  })
})
```

## Phase 3: Gmail Integration Tests

### OAuth Flow Tests

```typescript
// tests/gmail/oauth.test.tsx
import { renderWithProviders, screen, waitFor } from '@/tests/utils'
import userEvent from '@testing-library/user-event'
import { GmailConnect } from '@/components/gmail/GmailConnect'
import { server } from '@/tests/mocks/server'
import { rest } from 'msw'

describe('Gmail OAuth Integration', () => {
  it('initiates OAuth flow', async () => {
    const user = userEvent.setup()
    const mockOpen = jest.fn()
    global.open = mockOpen
    
    renderWithProviders(<GmailConnect />)
    
    await user.click(screen.getByRole('button', { name: /connect gmail/i }))
    
    expect(mockOpen).toHaveBeenCalledWith(
      expect.stringContaining('accounts.google.com/o/oauth2/v2/auth'),
      'gmail-oauth',
      expect.any(String)
    )
  })
  
  it('handles OAuth callback', async () => {
    const onSuccess = jest.fn()
    
    renderWithProviders(<GmailConnect onSuccess={onSuccess} />)
    
    // Simulate OAuth callback
    window.postMessage(
      {
        type: 'oauth-callback',
        code: 'auth-code-123',
        state: 'valid-state'
      },
      window.location.origin
    )
    
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled()
    })
    
    expect(screen.getByText(/gmail connected successfully/i)).toBeInTheDocument()
  })
  
  it('handles OAuth errors', async () => {
    renderWithProviders(<GmailConnect />)
    
    // Simulate OAuth error
    window.postMessage(
      {
        type: 'oauth-callback',
        error: 'access_denied',
        error_description: 'User denied access'
      },
      window.location.origin
    )
    
    expect(await screen.findByText(/gmail connection failed/i)).toBeInTheDocument()
  })
  
  it('validates state parameter', async () => {
    renderWithProviders(<GmailConnect />)
    
    // Simulate OAuth callback with invalid state
    window.postMessage(
      {
        type: 'oauth-callback',
        code: 'auth-code-123',
        state: 'invalid-state'
      },
      window.location.origin
    )
    
    expect(await screen.findByText(/invalid authorization/i)).toBeInTheDocument()
  })
})
```

### Email Sync Tests

```typescript
// tests/gmail/emailSync.test.tsx
import { renderWithProviders, screen, waitFor } from '@/tests/utils'
import { EmailSyncStatus } from '@/components/gmail/EmailSyncStatus'
import { server } from '@/tests/mocks/server'
import { rest } from 'msw'

describe('Email Sync', () => {
  it('shows sync progress', async () => {
    renderWithProviders(<EmailSyncStatus accountId="1" />)
    
    expect(screen.getByText(/syncing emails/i)).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
    
    await waitFor(() => {
      expect(screen.getByText(/1,234 emails synced/i)).toBeInTheDocument()
    })
  })
  
  it('handles sync errors', async () => {
    server.use(
      rest.get('/api/email-accounts/:id/sync-status', (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            status: 'error',
            error: 'Rate limit exceeded',
            lastSyncAt: new Date().toISOString()
          })
        )
      })
    )
    
    renderWithProviders(<EmailSyncStatus accountId="1" />)
    
    expect(await screen.findByText(/sync error: rate limit exceeded/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /retry sync/i })).toBeInTheDocument()
  })
  
  it('retries failed sync', async () => {
    const user = userEvent.setup()
    let syncAttempts = 0
    
    server.use(
      rest.post('/api/email-accounts/:id/sync', (req, res, ctx) => {
        syncAttempts++
        return res(ctx.status(200))
      })
    )
    
    renderWithProviders(<EmailSyncStatus accountId="1" initialError="Previous error" />)
    
    await user.click(screen.getByRole('button', { name: /retry sync/i }))
    
    await waitFor(() => {
      expect(syncAttempts).toBe(1)
    })
    
    expect(screen.getByText(/syncing emails/i)).toBeInTheDocument()
  })
  
  it('shows last sync time', async () => {
    const lastSyncAt = new Date(Date.now() - 5 * 60 * 1000) // 5 minutes ago
    
    server.use(
      rest.get('/api/email-accounts/:id/sync-status', (req, res, ctx) => {
        return res(
          ctx.json({
            status: 'idle',
            lastSyncAt: lastSyncAt.toISOString(),
            emailCount: 1234
          })
        )
      })
    )
    
    renderWithProviders(<EmailSyncStatus accountId="1" />)
    
    expect(await screen.findByText(/last synced 5 minutes ago/i)).toBeInTheDocument()
  })
})
```

### Email Thread Tests

```typescript
// tests/gmail/emailThread.test.tsx
import { renderWithProviders, screen, fireEvent } from '@/tests/utils'
import { EmailThread } from '@/components/gmail/EmailThread'
import { mockEmailThread } from '@/tests/mocks/email'

describe('Email Thread Display', () => {
  it('renders email thread correctly', () => {
    renderWithProviders(<EmailThread thread={mockEmailThread} />)
    
    // Check subject
    expect(screen.getByText(mockEmailThread.subject)).toBeInTheDocument()
    
    // Check all messages
    mockEmailThread.messages.forEach(message => {
      expect(screen.getByText(message.from.name)).toBeInTheDocument()
      expect(screen.getByText(message.snippet)).toBeInTheDocument()
    })
    
    // Check participant count
    expect(screen.getByText(/3 participants/i)).toBeInTheDocument()
  })
  
  it('expands and collapses messages', async () => {
    renderWithProviders(<EmailThread thread={mockEmailThread} />)
    
    const firstMessage = screen.getByText(mockEmailThread.messages[0].snippet)
    
    // Initially collapsed
    expect(firstMessage).toHaveClass('truncate')
    
    // Click to expand
    fireEvent.click(firstMessage.closest('[role="button"]'))
    
    // Now expanded
    expect(screen.getByText(mockEmailThread.messages[0].body)).toBeInTheDocument()
    
    // Click to collapse
    fireEvent.click(firstMessage.closest('[role="button"]'))
    
    // Collapsed again
    expect(screen.queryByText(mockEmailThread.messages[0].body)).not.toBeInTheDocument()
  })
  
  it('shows attachments', () => {
    const threadWithAttachments = {
      ...mockEmailThread,
      messages: [
        {
          ...mockEmailThread.messages[0],
          attachments: [
            { id: '1', filename: 'document.pdf', mimeType: 'application/pdf', size: 1024000 },
            { id: '2', filename: 'image.png', mimeType: 'image/png', size: 2048000 }
          ]
        }
      ]
    }
    
    renderWithProviders(<EmailThread thread={threadWithAttachments} />)
    
    expect(screen.getByText('document.pdf')).toBeInTheDocument()
    expect(screen.getByText('image.png')).toBeInTheDocument()
    expect(screen.getByText('1 MB')).toBeInTheDocument()
    expect(screen.getByText('2 MB')).toBeInTheDocument()
  })
  
  it('handles reply action', async () => {
    const user = userEvent.setup()
    const onReply = jest.fn()
    
    renderWithProviders(<EmailThread thread={mockEmailThread} onReply={onReply} />)
    
    await user.click(screen.getByRole('button', { name: /reply/i }))
    
    expect(onReply).toHaveBeenCalledWith(mockEmailThread.id)
  })
})
```

## Test Utilities

### Custom Render Function

```typescript
// tests/utils/render.tsx
import { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'

const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  )
}

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options })

export * from '@testing-library/react'
export { customRender as render, customRender as renderWithProviders }
```

### MSW Server Setup

```typescript
// tests/mocks/server.ts
import { setupServer } from 'msw/node'
import { authHandlers } from './handlers/auth'
import { contactHandlers } from './handlers/contacts'
import { emailHandlers } from './handlers/email'

export const server = setupServer(
  ...authHandlers,
  ...contactHandlers,
  ...emailHandlers
)
```

### Mock Handlers

```typescript
// tests/mocks/handlers/auth.ts
import { rest } from 'msw'

export const authHandlers = [
  rest.post('/api/auth/login', async (req, res, ctx) => {
    const { email, password } = await req.json()
    
    if (email === 'test@haste.nyc' && password === 'password123') {
      return res(
        ctx.json({
          user: {
            id: '1',
            email: 'test@haste.nyc',
            firstName: 'Test',
            lastName: 'User',
            role: 'USER'
          },
          accessToken: 'mock-access-token',
          refreshToken: 'mock-refresh-token'
        })
      )
    }
    
    return res(
      ctx.status(401),
      ctx.json({ message: 'Invalid credentials' })
    )
  }),
  
  rest.post('/api/auth/refresh', async (req, res, ctx) => {
    const { refreshToken } = await req.json()
    
    if (refreshToken === 'valid-refresh-token') {
      return res(
        ctx.json({
          accessToken: 'new-access-token',
          refreshToken: 'new-refresh-token'
        })
      )
    }
    
    return res(ctx.status(401))
  }),
  
  rest.post('/api/auth/logout', (req, res, ctx) => {
    return res(ctx.status(200))
  })
]
```

## Mock Data

### Contact Mocks

```typescript
// tests/mocks/contact.ts
export const mockContact = {
  id: '1',
  firstName: 'John',
  lastName: 'Doe',
  fullName: 'John Doe',
  email: 'john@haste.nyc',
  phone: '+1234567890',
  title: 'CEO',
  company: {
    id: '1',
    name: 'Acme Corp',
    domain: 'acme.com'
  },
  avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=john',
  tags: [
    { id: '1', name: 'VIP' },
    { id: '2', name: 'Customer' }
  ],
  customFields: {},
  notes: 'Important contact',
  source: 'MANUAL',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-15T00:00:00Z'
}

export const mockContacts = [
  mockContact,
  {
    ...mockContact,
    id: '2',
    firstName: 'Jane',
    lastName: 'Smith',
    fullName: 'Jane Smith',
    email: 'jane@haste.nyc',
    company: {
      id: '2',
      name: 'Tech Inc',
      domain: 'techinc.com'
    }
  }
]
```

### Email Mocks

```typescript
// tests/mocks/email.ts
export const mockEmailThread = {
  id: 'thread-1',
  subject: 'Re: Project Update',
  snippet: 'Thanks for the update. Let me review and get back to you...',
  participants: [
    { email: 'john@haste.nyc', name: 'John Doe' },
    { email: 'jane@haste.nyc', name: 'Jane Smith' },
    { email: 'bob@haste.nyc', name: 'Bob Johnson' }
  ],
  messages: [
    {
      id: 'msg-1',
      threadId: 'thread-1',
      from: { email: 'john@haste.nyc', name: 'John Doe' },
      to: [{ email: 'jane@haste.nyc', name: 'Jane Smith' }],
      cc: [],
      bcc: [],
      subject: 'Project Update',
      snippet: 'Hi Jane, here is the latest update on the project...',
      body: '<p>Hi Jane,</p><p>Here is the latest update on the project. We have completed phase 1 and are moving to phase 2.</p><p>Best,<br>John</p>',
      date: '2024-01-15T10:30:00Z',
      isRead: true,
      labels: ['INBOX', 'IMPORTANT']
    },
    {
      id: 'msg-2',
      threadId: 'thread-1',
      from: { email: 'jane@haste.nyc', name: 'Jane Smith' },
      to: [{ email: 'john@haste.nyc', name: 'John Doe' }],
      cc: [{ email: 'bob@haste.nyc', name: 'Bob Johnson' }],
      bcc: [],
      subject: 'Re: Project Update',
      snippet: 'Thanks for the update. Let me review and get back to you...',
      body: '<p>Thanks for the update. Let me review and get back to you by EOD.</p><p>Jane</p>',
      date: '2024-01-15T11:45:00Z',
      isRead: true,
      labels: ['INBOX']
    }
  ],
  lastMessageDate: '2024-01-15T11:45:00Z',
  isStarred: false,
  hasAttachments: false
}
```

This completes the comprehensive test examples documentation for all three phases of the MVP.