# Testing Guide

## Table of Contents
1. [Overview](#overview)
2. [Testing Philosophy](#testing-philosophy)
3. [Test Structure](#test-structure)
4. [Unit Testing](#unit-testing)
5. [Integration Testing](#integration-testing)
6. [End-to-End Testing](#end-to-end-testing)
7. [Performance Testing](#performance-testing)
8. [Security Testing](#security-testing)
9. [AI Testing](#ai-testing)
10. [Test Data Management](#test-data-management)
11. [CI/CD Integration](#cicd-integration)
12. [Best Practices](#best-practices)

## Overview

This guide covers comprehensive testing strategies for hasteCRM, ensuring code quality, reliability, and performance across all components. Our testing approach emphasizes automation, continuous integration, and maintaining high test coverage.

### Testing Stack
- **Unit Tests**: Jest, React Testing Library
- **Integration Tests**: Jest, Supertest
- **E2E Tests**: Playwright, Cypress
- **Performance Tests**: k6, Artillery
- **Security Tests**: OWASP ZAP, Snyk
- **AI Tests**: Custom frameworks for LLM testing

## Testing Philosophy

### Core Principles
1. **Test Pyramid**: More unit tests, fewer E2E tests
2. **Shift Left**: Test early in development cycle
3. **Automation First**: Automate repetitive tests
4. **Test in Production**: Monitor real user behavior
5. **Risk-Based Testing**: Focus on critical paths
6. **Continuous Testing**: Test on every commit

### Coverage Goals
```yaml
coverage:
  unit: 80%         # Minimum for all code
  integration: 70%  # API and service boundaries
  e2e: 60%         # Critical user journeys
  overall: 75%     # Combined coverage target
```

## Test Structure

### Directory Organization
```
tests/
   unit/              # Unit tests
      components/    # React component tests
      services/      # Service layer tests
      utils/         # Utility function tests
      hooks/         # React hook tests
   integration/       # Integration tests
      api/          # API endpoint tests
      services/     # Service integration tests
      database/     # Database tests
   e2e/              # End-to-end tests
      flows/        # User journey tests
      smoke/        # Smoke tests
      regression/   # Regression tests
   performance/      # Performance tests
      load/         # Load tests
      stress/       # Stress tests
      spike/        # Spike tests
   fixtures/         # Test data
   mocks/           # Mock implementations
   utils/           # Test utilities
```

### Naming Conventions
```typescript
// Test file naming
ComponentName.test.tsx      // Component tests
serviceName.test.ts         // Service tests
apiEndpoint.spec.ts        // API tests
userJourney.e2e.ts         // E2E tests

// Test description pattern
describe('ComponentName', () => {
  describe('methodName', () => {
    it('should [expected behavior] when [condition]', () => {
      // Test implementation
    });
  });
});
```

## Unit Testing

### React Component Testing
```typescript
// ContactCard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ContactCard } from '@/components/ContactCard';
import { mockContact } from '@/tests/fixtures/contacts';

describe('ContactCard', () => {
  const defaultProps = {
    contact: mockContact,
    onEdit: jest.fn(),
    onDelete: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render contact information correctly', () => {
    render(<ContactCard {...defaultProps} />);
    
    expect(screen.getByText(mockContact.name)).toBeInTheDocument();
    expect(screen.getByText(mockContact.email)).toBeInTheDocument();
    expect(screen.getByText(mockContact.company)).toBeInTheDocument();
  });

  it('should call onEdit when edit button is clicked', async () => {
    const user = userEvent.setup();
    render(<ContactCard {...defaultProps} />);
    
    await user.click(screen.getByRole('button', { name: /edit/i }));
    
    expect(defaultProps.onEdit).toHaveBeenCalledWith(mockContact.id);
    expect(defaultProps.onEdit).toHaveBeenCalledTimes(1);
  });

  it('should show confirmation dialog before deletion', async () => {
    const user = userEvent.setup();
    render(<ContactCard {...defaultProps} />);
    
    await user.click(screen.getByRole('button', { name: /delete/i }));
    
    expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
    
    await user.click(screen.getByRole('button', { name: /confirm/i }));
    
    expect(defaultProps.onDelete).toHaveBeenCalledWith(mockContact.id);
  });

  it('should handle missing optional fields gracefully', () => {
    const contactWithoutCompany = { ...mockContact, company: undefined };
    render(<ContactCard {...defaultProps} contact={contactWithoutCompany} />);
    
    expect(screen.queryByText('No company')).toBeInTheDocument();
  });
});
```

### Service Testing
```typescript
// ContactService.test.ts
import { ContactService } from '@/services/ContactService';
import { PrismaClient } from '@prisma/client';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';

describe('ContactService', () => {
  let service: ContactService;
  let prisma: DeepMockProxy<PrismaClient>;

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>();
    service = new ContactService(prisma);
  });

  describe('createContact', () => {
    it('should create a contact with valid data', async () => {
      const input = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        workspaceId: 'workspace_123',
      };

      const expectedContact = {
        id: 'contact_123',
        ...input,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.contact.create.mockResolvedValue(expectedContact);

      const result = await service.createContact(input);

      expect(result).toEqual(expectedContact);
      expect(prisma.contact.create).toHaveBeenCalledWith({
        data: input,
      });
    });

    it('should throw error for duplicate email', async () => {
      const input = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'existing@example.com',
        workspaceId: 'workspace_123',
      };

      prisma.contact.create.mockRejectedValue(
        new Error('Unique constraint failed on the fields: (`email`)')
      );

      await expect(service.createContact(input)).rejects.toThrow(
        'Contact with this email already exists'
      );
    });

    it('should validate email format', async () => {
      const input = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'invalid-email',
        workspaceId: 'workspace_123',
      };

      await expect(service.createContact(input)).rejects.toThrow(
        'Invalid email format'
      );
    });
  });

  describe('searchContacts', () => {
    it('should search contacts by query', async () => {
      const query = 'john';
      const mockContacts = [
        { id: '1', firstName: 'John', lastName: 'Doe', email: 'john@example.com' },
        { id: '2', firstName: 'Johnny', lastName: 'Smith', email: 'johnny@example.com' },
      ];

      prisma.contact.findMany.mockResolvedValue(mockContacts);

      const result = await service.searchContacts('workspace_123', query);

      expect(result).toEqual(mockContacts);
      expect(prisma.contact.findMany).toHaveBeenCalledWith({
        where: {
          workspaceId: 'workspace_123',
          OR: [
            { firstName: { contains: query, mode: 'insensitive' } },
            { lastName: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
            { company: { contains: query, mode: 'insensitive' } },
          ],
        },
        take: 20,
      });
    });
  });
});
```

### Hook Testing
```typescript
// useContactSearch.test.ts
import { renderHook, act, waitFor } from '@testing-library/react';
import { useContactSearch } from '@/hooks/useContactSearch';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('useContactSearch', () => {
  it('should search contacts with debouncing', async () => {
    const { result } = renderHook(() => useContactSearch(), {
      wrapper: createWrapper(),
    });

    expect(result.current.contacts).toEqual([]);
    expect(result.current.isLoading).toBe(false);

    act(() => {
      result.current.search('john');
    });

    // Should not search immediately
    expect(result.current.isLoading).toBe(false);

    // Wait for debounce
    await waitFor(() => {
      expect(result.current.isLoading).toBe(true);
    }, { timeout: 600 });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.contacts).toHaveLength(2);
    });
  });

  it('should cancel previous search on new input', async () => {
    const { result } = renderHook(() => useContactSearch(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.search('john');
    });

    // Change search before previous completes
    act(() => {
      result.current.search('jane');
    });

    await waitFor(() => {
      expect(result.current.contacts[0].firstName).toBe('Jane');
    });
  });
});
```

## Integration Testing

### API Integration Tests
```typescript
// contacts.api.test.ts
import request from 'supertest';
import { app } from '@/app';
import { prisma } from '@/lib/prisma';
import { generateAuthToken } from '@/tests/utils/auth';

describe('Contacts API', () => {
  let authToken: string;
  let workspaceId: string;

  beforeAll(async () => {
    // Setup test workspace and user
    const workspace = await prisma.workspace.create({
      data: { name: 'Test Workspace' },
    });
    workspaceId = workspace.id;

    const user = await prisma.user.create({
      data: {
        email: 'test@example.com',
        password: 'hashed_password',
        workspaceId,
      },
    });

    authToken = generateAuthToken(user);
  });

  afterAll(async () => {
    await prisma.$transaction([
      prisma.contact.deleteMany({ where: { workspaceId } }),
      prisma.user.deleteMany({ where: { workspaceId } }),
      prisma.workspace.delete({ where: { id: workspaceId } }),
    ]);
    await prisma.$disconnect();
  });

  describe('POST /api/contacts', () => {
    it('should create a new contact', async () => {
      const contactData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        phone: '+1234567890',
        company: 'Acme Corp',
      };

      const response = await request(app)
        .post('/api/contacts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(contactData)
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        ...contactData,
        workspaceId,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });

      // Verify in database
      const dbContact = await prisma.contact.findUnique({
        where: { id: response.body.id },
      });
      expect(dbContact).toBeTruthy();
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/contacts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ firstName: 'John' }) // Missing required fields
        .expect(400);

      expect(response.body.error).toMatchObject({
        code: 'VALIDATION_ERROR',
        details: {
          fields: {
            lastName: expect.arrayContaining(['Required']),
            email: expect.arrayContaining(['Required']),
          },
        },
      });
    });

    it('should prevent duplicate emails', async () => {
      const contactData = {
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
      };

      // Create first contact
      await request(app)
        .post('/api/contacts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(contactData)
        .expect(201);

      // Try to create duplicate
      const response = await request(app)
        .post('/api/contacts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(contactData)
        .expect(409);

      expect(response.body.error.code).toBe('DUPLICATE_RESOURCE');
    });
  });

  describe('GET /api/contacts', () => {
    beforeEach(async () => {
      // Create test contacts
      await prisma.contact.createMany({
        data: [
          {
            firstName: 'Alice',
            lastName: 'Smith',
            email: 'alice@example.com',
            workspaceId,
            createdAt: new Date('2024-01-01'),
          },
          {
            firstName: 'Bob',
            lastName: 'Johnson',
            email: 'bob@example.com',
            workspaceId,
            createdAt: new Date('2024-01-02'),
          },
          {
            firstName: 'Charlie',
            lastName: 'Brown',
            email: 'charlie@example.com',
            workspaceId,
            createdAt: new Date('2024-01-03'),
          },
        ],
      });
    });

    it('should list contacts with pagination', async () => {
      const response = await request(app)
        .get('/api/contacts?page[limit]=2&page[offset]=0')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        data: expect.arrayContaining([
          expect.objectContaining({ firstName: 'Charlie' }),
          expect.objectContaining({ firstName: 'Bob' }),
        ]),
        meta: {
          total: 3,
          limit: 2,
          offset: 0,
        },
      });
    });

    it('should filter contacts', async () => {
      const response = await request(app)
        .get('/api/contacts?filter[email]=alice@example.com')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].email).toBe('alice@example.com');
    });

    it('should sort contacts', async () => {
      const response = await request(app)
        .get('/api/contacts?sort=firstName')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const names = response.body.data.map((c: any) => c.firstName);
      expect(names).toEqual(['Alice', 'Bob', 'Charlie']);
    });
  });
});
```

### GraphQL Integration Tests
```typescript
// graphql.integration.test.ts
import { ApolloServer } from '@apollo/server';
import { createTestClient } from 'apollo-server-testing';
import { schema } from '@/graphql/schema';
import { createContext } from '@/graphql/context';
import { gql } from 'graphql-tag';

describe('GraphQL Integration', () => {
  let server: ApolloServer;
  let query: any;
  let mutate: any;

  beforeAll(() => {
    server = new ApolloServer({
      schema,
      context: createContext,
    });
    
    const testClient = createTestClient(server);
    query = testClient.query;
    mutate = testClient.mutate;
  });

  describe('Contact Queries', () => {
    it('should fetch contacts with nested data', async () => {
      const GET_CONTACTS = gql`
        query GetContacts($first: Int!, $after: String) {
          contacts(first: $first, after: $after) {
            edges {
              node {
                id
                firstName
                lastName
                email
                company {
                  id
                  name
                }
                deals {
                  id
                  title
                  value
                }
              }
              cursor
            }
            pageInfo {
              hasNextPage
              endCursor
            }
            totalCount
          }
        }
      `;

      const { data, errors } = await query({
        query: GET_CONTACTS,
        variables: { first: 10 },
      });

      expect(errors).toBeUndefined();
      expect(data.contacts).toMatchObject({
        edges: expect.any(Array),
        pageInfo: {
          hasNextPage: expect.any(Boolean),
          endCursor: expect.any(String),
        },
        totalCount: expect.any(Number),
      });
    });
  });

  describe('Contact Mutations', () => {
    it('should create contact with all fields', async () => {
      const CREATE_CONTACT = gql`
        mutation CreateContact($input: CreateContactInput!) {
          createContact(input: $input) {
            id
            firstName
            lastName
            email
            customFields
          }
        }
      `;

      const input = {
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        customFields: {
          source: 'API Test',
          priority: 'High',
        },
      };

      const { data, errors } = await mutate({
        mutation: CREATE_CONTACT,
        variables: { input },
      });

      expect(errors).toBeUndefined();
      expect(data.createContact).toMatchObject({
        id: expect.any(String),
        ...input,
      });
    });
  });
});
```

### Database Integration Tests
```typescript
// database.integration.test.ts
import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';

describe('Database Integration', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    // Use test database
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    
    // Run migrations
    execSync('npx prisma migrate deploy', {
      env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL },
    });

    prisma = new PrismaClient();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Transactions', () => {
    it('should rollback on error', async () => {
      const workspaceId = 'test_workspace';

      try {
        await prisma.$transaction(async (tx) => {
          // Create contact
          await tx.contact.create({
            data: {
              firstName: 'Transaction',
              lastName: 'Test',
              email: 'transaction@test.com',
              workspaceId,
            },
          });

          // This should fail
          throw new Error('Rollback test');
        });
      } catch (error) {
        // Expected error
      }

      // Verify rollback
      const contact = await prisma.contact.findFirst({
        where: { email: 'transaction@test.com' },
      });

      expect(contact).toBeNull();
    });
  });

  describe('Complex Queries', () => {
    it('should handle complex aggregations', async () => {
      const result = await prisma.$queryRaw`
        SELECT 
          DATE_TRUNC('month', created_at) as month,
          COUNT(*) as contact_count,
          COUNT(DISTINCT company) as company_count
        FROM contacts
        WHERE workspace_id = ${workspaceId}
          AND created_at >= NOW() - INTERVAL '6 months'
        GROUP BY month
        ORDER BY month DESC
      `;

      expect(result).toBeInstanceOf(Array);
      expect(result[0]).toHaveProperty('month');
      expect(result[0]).toHaveProperty('contact_count');
      expect(result[0]).toHaveProperty('company_count');
    });
  });
});
```

## End-to-End Testing

### Playwright E2E Tests
```typescript
// contact-management.e2e.ts
import { test, expect } from '@playwright/test';
import { loginAsUser, createTestWorkspace } from '@/tests/e2e/helpers';

test.describe('Contact Management', () => {
  test.beforeEach(async ({ page }) => {
    await createTestWorkspace();
    await loginAsUser(page, 'test@example.com', 'password');
  });

  test('should create a new contact', async ({ page }) => {
    // Navigate to contacts page
    await page.goto('/contacts');
    
    // Click create button
    await page.click('button:has-text("Create Contact")');
    
    // Fill form
    await page.fill('input[name="firstName"]', 'John');
    await page.fill('input[name="lastName"]', 'Doe');
    await page.fill('input[name="email"]', 'john.doe@example.com');
    await page.fill('input[name="phone"]', '+1234567890');
    await page.fill('input[name="company"]', 'Acme Corp');
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Verify success
    await expect(page.locator('.toast-success')).toContainText('Contact created');
    
    // Verify contact appears in list
    await expect(page.locator('[data-testid="contact-card"]')).toContainText('John Doe');
    await expect(page.locator('[data-testid="contact-card"]')).toContainText('john.doe@example.com');
  });

  test('should search contacts', async ({ page }) => {
    // Create test contacts
    await createTestContacts([
      { firstName: 'Alice', lastName: 'Smith', email: 'alice@example.com' },
      { firstName: 'Bob', lastName: 'Johnson', email: 'bob@example.com' },
      { firstName: 'Charlie', lastName: 'Brown', email: 'charlie@example.com' },
    ]);

    await page.goto('/contacts');
    
    // Search for contact
    await page.fill('input[placeholder="Search contacts..."]', 'alice');
    
    // Wait for search results
    await page.waitForTimeout(500); // Debounce delay
    
    // Verify results
    const contacts = page.locator('[data-testid="contact-card"]');
    await expect(contacts).toHaveCount(1);
    await expect(contacts.first()).toContainText('Alice Smith');
  });

  test('should bulk update contacts', async ({ page }) => {
    // Create test contacts
    await createTestContacts([
      { firstName: 'Contact', lastName: 'One', email: 'one@example.com' },
      { firstName: 'Contact', lastName: 'Two', email: 'two@example.com' },
      { firstName: 'Contact', lastName: 'Three', email: 'three@example.com' },
    ]);

    await page.goto('/contacts');
    
    // Select multiple contacts
    await page.click('[data-testid="contact-checkbox-1"]');
    await page.click('[data-testid="contact-checkbox-2"]');
    
    // Open bulk actions
    await page.click('button:has-text("Bulk Actions")');
    await page.click('button:has-text("Add Tag")');
    
    // Add tag
    await page.fill('input[name="tag"]', 'Important');
    await page.click('button:has-text("Apply")');
    
    // Verify success
    await expect(page.locator('.toast-success')).toContainText('2 contacts updated');
    
    // Verify tags appear
    await expect(page.locator('[data-testid="contact-1-tags"]')).toContainText('Important');
    await expect(page.locator('[data-testid="contact-2-tags"]')).toContainText('Important');
  });

  test('should handle form validation', async ({ page }) => {
    await page.goto('/contacts');
    await page.click('button:has-text("Create Contact")');
    
    // Submit empty form
    await page.click('button[type="submit"]');
    
    // Check validation messages
    await expect(page.locator('text=First name is required')).toBeVisible();
    await expect(page.locator('text=Last name is required')).toBeVisible();
    await expect(page.locator('text=Email is required')).toBeVisible();
    
    // Enter invalid email
    await page.fill('input[name="email"]', 'invalid-email');
    await page.click('button[type="submit"]');
    
    await expect(page.locator('text=Invalid email format')).toBeVisible();
  });
});
```

### Critical User Journeys
```typescript
// sales-pipeline-journey.e2e.ts
test.describe('Sales Pipeline Journey', () => {
  test('complete sales process from lead to close', async ({ page }) => {
    await loginAsUser(page, 'sales@example.com', 'password');
    
    // 1. Create new lead
    await page.goto('/pipeline/sales');
    await page.click('button:has-text("Add Deal")');
    
    await page.fill('input[name="title"]', 'Enterprise Deal - Acme Corp');
    await page.fill('input[name="value"]', '50000');
    await page.selectOption('select[name="contactId"]', 'contact_123');
    await page.click('button[type="submit"]');
    
    // 2. Move through pipeline stages
    const dealCard = page.locator('[data-testid="deal-card"]:has-text("Enterprise Deal")');
    
    // Move to Qualified
    await dealCard.dragTo(page.locator('[data-stage="qualified"]'));
    await expect(dealCard).toBeVisible({ timeout: 5000 });
    
    // Add activity
    await dealCard.click();
    await page.click('button:has-text("Add Activity")');
    await page.fill('textarea[name="note"]', 'Had initial call with decision maker');
    await page.click('button:has-text("Save")');
    
    // Move to Demo
    await dealCard.dragTo(page.locator('[data-stage="demo"]'));
    
    // Schedule demo
    await page.click('button:has-text("Schedule Demo")');
    await page.fill('input[name="date"]', '2024-01-15');
    await page.fill('input[name="time"]', '14:00');
    await page.click('button:has-text("Schedule")');
    
    // Move to Proposal
    await dealCard.dragTo(page.locator('[data-stage="proposal"]'));
    
    // Generate proposal with AI
    await page.click('button:has-text("Generate Proposal")');
    await page.waitForSelector('.proposal-preview');
    await page.click('button:has-text("Send Proposal")');
    
    // Move to Negotiation
    await dealCard.dragTo(page.locator('[data-stage="negotiation"]'));
    
    // Update deal value
    await dealCard.click();
    await page.fill('input[name="value"]', '45000');
    await page.click('button:has-text("Update")');
    
    // Close deal
    await dealCard.dragTo(page.locator('[data-stage="closed-won"]'));
    
    // Fill win details
    await page.fill('textarea[name="winReason"]', 'Better features than competition');
    await page.click('button:has-text("Close Deal")');
    
    // Verify deal closed
    await expect(page.locator('.toast-success')).toContainText('Deal closed successfully');
    await expect(page.locator('[data-stage="closed-won"]')).toContainText('Enterprise Deal');
  });
});
```

### Visual Regression Testing
```typescript
// visual-regression.test.ts
import { test } from '@playwright/test';
import { argosScreenshot } from '@argos-ci/playwright';

test.describe('Visual Regression', () => {
  test('dashboard layout', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await argosScreenshot(page, 'dashboard');
  });

  test('contact list views', async ({ page }) => {
    await page.goto('/contacts');
    
    // Grid view
    await argosScreenshot(page, 'contacts-grid');
    
    // List view
    await page.click('button[aria-label="List view"]');
    await argosScreenshot(page, 'contacts-list');
    
    // With filters
    await page.click('button:has-text("Filters")');
    await page.click('input[value="active"]');
    await argosScreenshot(page, 'contacts-filtered');
  });

  test('pipeline board', async ({ page }) => {
    await page.goto('/pipeline/sales');
    await page.waitForSelector('[data-testid="pipeline-board"]');
    await argosScreenshot(page, 'pipeline-board');
  });

  test('dark mode', async ({ page }) => {
    await page.goto('/settings');
    await page.click('button:has-text("Dark Mode")');
    
    await page.goto('/dashboard');
    await argosScreenshot(page, 'dashboard-dark');
  });
});
```

## Performance Testing

### Load Testing with k6
```javascript
// load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '2m', target: 100 },   // Ramp up to 100 users
    { duration: '5m', target: 100 },   // Stay at 100 users
    { duration: '2m', target: 200 },   // Ramp up to 200 users
    { duration: '5m', target: 200 },   // Stay at 200 users
    { duration: '2m', target: 0 },     // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests under 500ms
    errors: ['rate<0.1'],             // Error rate under 10%
  },
};

const BASE_URL = 'https://api.example.com';
const AUTH_TOKEN = __ENV.AUTH_TOKEN;

export default function () {
  const params = {
    headers: {
      'Authorization': `Bearer ${AUTH_TOKEN}`,
      'Content-Type': 'application/json',
    },
  };

  // Test 1: List contacts
  const listRes = http.get(`${BASE_URL}/api/contacts?limit=20`, params);
  check(listRes, {
    'list status is 200': (r) => r.status === 200,
    'list response time OK': (r) => r.timings.duration < 300,
  });
  errorRate.add(listRes.status !== 200);

  sleep(1);

  // Test 2: Search contacts
  const searchRes = http.get(`${BASE_URL}/api/contacts/search?q=john`, params);
  check(searchRes, {
    'search status is 200': (r) => r.status === 200,
    'search response time OK': (r) => r.timings.duration < 500,
  });
  errorRate.add(searchRes.status !== 200);

  sleep(1);

  // Test 3: Create contact
  const payload = JSON.stringify({
    firstName: 'Load',
    lastName: 'Test',
    email: `loadtest${Date.now()}@example.com`,
  });

  const createRes = http.post(`${BASE_URL}/api/contacts`, payload, params);
  check(createRes, {
    'create status is 201': (r) => r.status === 201,
    'create response time OK': (r) => r.timings.duration < 1000,
  });
  errorRate.add(createRes.status !== 201);

  sleep(2);
}
```

### Stress Testing
```javascript
// stress-test.js
export const options = {
  stages: [
    { duration: '5m', target: 500 },   // Ramp up to 500 users
    { duration: '10m', target: 500 },  // Stay at 500 users
    { duration: '5m', target: 1000 },  // Spike to 1000 users
    { duration: '10m', target: 1000 }, // Stay at 1000 users
    { duration: '5m', target: 500 },   // Scale down to 500
    { duration: '5m', target: 0 },     // Ramp down to 0
  ],
  thresholds: {
    http_req_duration: ['p(99)<2000'], // 99% of requests under 2s
    http_req_failed: ['rate<0.5'],     // Error rate under 50%
  },
};
```

### Database Performance Testing
```typescript
// db-performance.test.ts
describe('Database Performance', () => {
  test('bulk insert performance', async () => {
    const contacts = Array.from({ length: 10000 }, (_, i) => ({
      firstName: `First${i}`,
      lastName: `Last${i}`,
      email: `test${i}@example.com`,
      workspaceId: 'test_workspace',
    }));

    const startTime = Date.now();
    
    await prisma.contact.createMany({
      data: contacts,
      skipDuplicates: true,
    });
    
    const duration = Date.now() - startTime;
    
    expect(duration).toBeLessThan(5000); // Should complete in 5 seconds
    console.log(`Bulk insert of 10k records: ${duration}ms`);
  });

  test('complex query performance', async () => {
    const startTime = Date.now();
    
    const result = await prisma.contact.findMany({
      where: {
        workspaceId: 'test_workspace',
        deals: {
          some: {
            value: { gte: 10000 },
            stage: { name: 'Negotiation' },
          },
        },
      },
      include: {
        deals: {
          include: {
            stage: true,
            activities: {
              take: 5,
              orderBy: { createdAt: 'desc' },
            },
          },
        },
        company: true,
      },
      take: 100,
    });
    
    const duration = Date.now() - startTime;
    
    expect(duration).toBeLessThan(1000); // Should complete in 1 second
    console.log(`Complex query execution: ${duration}ms`);
  });
});
```

## Security Testing

### Security Test Suite
```typescript
// security.test.ts
import { OWASP } from '@/tests/security/owasp';

describe('Security Tests', () => {
  describe('Authentication', () => {
    test('should prevent brute force attacks', async () => {
      const attempts = 10;
      const results = [];

      for (let i = 0; i < attempts; i++) {
        const res = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'test@example.com',
            password: 'wrong_password',
          });
        results.push(res.status);
      }

      // Should get rate limited
      expect(results.filter(s => s === 429).length).toBeGreaterThan(0);
    });

    test('should enforce password complexity', async () => {
      const weakPasswords = [
        '12345678',
        'password',
        'qwerty123',
        'admin123',
      ];

      for (const password of weakPasswords) {
        const res = await request(app)
          .post('/api/auth/register')
          .send({
            email: 'new@example.com',
            password,
          });

        expect(res.status).toBe(400);
        expect(res.body.error.message).toContain('Password does not meet requirements');
      }
    });
  });

  describe('Input Validation', () => {
    test('should prevent SQL injection', async () => {
      const sqlInjectionPayloads = [
        "' OR '1'='1",
        "1; DROP TABLE contacts;--",
        "' UNION SELECT * FROM users--",
      ];

      for (const payload of sqlInjectionPayloads) {
        const res = await request(app)
          .get(`/api/contacts/search?q=${encodeURIComponent(payload)}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data).toEqual([]); // No results, no error
      }
    });

    test('should prevent XSS attacks', async () => {
      const xssPayloads = [
        '<script>alert("XSS")</script>',
        '<img src=x onerror=alert("XSS")>',
        'javascript:alert("XSS")',
      ];

      for (const payload of xssPayloads) {
        const res = await request(app)
          .post('/api/contacts')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            firstName: payload,
            lastName: 'Test',
            email: 'xss@test.com',
          });

        expect(res.status).toBe(201);
        
        // Verify sanitization
        const contact = res.body;
        expect(contact.firstName).not.toContain('<script>');
        expect(contact.firstName).not.toContain('javascript:');
      }
    });
  });

  describe('Authorization', () => {
    test('should prevent unauthorized access', async () => {
      // Try to access without token
      const res = await request(app)
        .get('/api/contacts')
        .expect(401);

      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });

    test('should prevent cross-workspace access', async () => {
      // Create contact in workspace A
      const contactA = await createContact(workspaceA, userA);

      // Try to access from workspace B
      const res = await request(app)
        .get(`/api/contacts/${contactA.id}`)
        .set('Authorization', `Bearer ${userBToken}`)
        .expect(404);

      expect(res.body.error.code).toBe('RESOURCE_NOT_FOUND');
    });
  });

  describe('Data Protection', () => {
    test('should mask sensitive data in logs', async () => {
      const logSpy = jest.spyOn(logger, 'info');

      await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'secretpassword123',
        });

      // Check that password is not logged
      const logCalls = logSpy.mock.calls;
      const logContent = JSON.stringify(logCalls);
      
      expect(logContent).not.toContain('secretpassword123');
      expect(logContent).toContain('[REDACTED]');
    });

    test('should encrypt sensitive fields', async () => {
      const contact = await prisma.contact.create({
        data: {
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com',
          ssn: '123-45-6789', // Sensitive field
          workspaceId: 'test',
        },
      });

      // Check database directly
      const rawData = await prisma.$queryRaw`
        SELECT ssn FROM contacts WHERE id = ${contact.id}
      `;

      expect(rawData[0].ssn).not.toBe('123-45-6789'); // Should be encrypted
      expect(rawData[0].ssn).toMatch(/^encrypted:/);
    });
  });
});
```

### OWASP Security Scan
```typescript
// owasp-scan.test.ts
import { ZAPClient } from '@/tests/security/zap-client';

describe('OWASP ZAP Security Scan', () => {
  let zap: ZAPClient;

  beforeAll(async () => {
    zap = new ZAPClient({
      proxy: 'http://localhost:8080',
      apiKey: process.env.ZAP_API_KEY,
    });

    await zap.start();
  });

  afterAll(async () => {
    await zap.shutdown();
  });

  test('should pass active security scan', async () => {
    // Spider the application
    await zap.spider(process.env.APP_URL);

    // Run active scan
    const scanId = await zap.activeScan(process.env.APP_URL);
    
    // Wait for scan to complete
    await zap.waitForScan(scanId);

    // Get alerts
    const alerts = await zap.getAlerts();
    
    // Filter out acceptable risks
    const criticalAlerts = alerts.filter(alert => 
      alert.risk === 'High' || alert.risk === 'Critical'
    );

    expect(criticalAlerts).toEqual([]);
  });
});
```

## AI Testing

### LLM Response Testing
```typescript
// ai-testing.test.ts
describe('AI Integration Tests', () => {
  describe('Email Generation', () => {
    test('should generate appropriate email content', async () => {
      const context = {
        recipient: 'John Doe',
        company: 'Acme Corp',
        purpose: 'follow_up',
        tone: 'professional',
        previousInteraction: 'Demo call on Monday',
      };

      const result = await aiService.generateEmail(context);

      // Verify structure
      expect(result).toHaveProperty('subject');
      expect(result).toHaveProperty('body');
      
      // Verify content quality
      expect(result.subject.length).toBeGreaterThan(10);
      expect(result.subject.length).toBeLessThan(100);
      
      // Check for required elements
      expect(result.body).toContain('John');
      expect(result.body).toContain('demo');
      expect(result.body.toLowerCase()).toContain('follow');
      
      // Verify tone
      const toneAnalysis = await analyzeTone(result.body);
      expect(toneAnalysis.formality).toBeGreaterThan(0.7);
    });

    test('should handle edge cases gracefully', async () => {
      const edgeCases = [
        { recipient: '', company: 'Test', purpose: 'intro' },
        { recipient: 'Test', company: '', purpose: 'follow_up' },
        { recipient: 'A'.repeat(1000), company: 'Test', purpose: 'intro' },
      ];

      for (const context of edgeCases) {
        const result = await aiService.generateEmail(context);
        
        expect(result).toHaveProperty('subject');
        expect(result).toHaveProperty('body');
        expect(result.subject.length).toBeGreaterThan(0);
        expect(result.body.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Contact Enrichment', () => {
    test('should enrich contact data accurately', async () => {
      const contact = {
        email: 'john.doe@example.com',
        company: 'Example Corp',
      };

      const enriched = await aiService.enrichContact(contact);

      // Verify enrichment
      expect(enriched).toHaveProperty('industry');
      expect(enriched).toHaveProperty('companySize');
      expect(enriched).toHaveProperty('likelihood');
      
      // Verify data quality
      expect(['Technology', 'Finance', 'Healthcare', 'Retail', 'Other'])
        .toContain(enriched.industry);
      expect(enriched.likelihood).toBeGreaterThanOrEqual(0);
      expect(enriched.likelihood).toBeLessThanOrEqual(1);
    });
  });

  describe('Deal Scoring', () => {
    test('should provide consistent scoring', async () => {
      const deal = {
        value: 50000,
        stage: 'Proposal',
        daysInStage: 5,
        activitiesCount: 10,
        emailEngagement: 0.8,
      };

      // Run multiple times to check consistency
      const scores = [];
      for (let i = 0; i < 5; i++) {
        const result = await aiService.scoreDeal(deal);
        scores.push(result.score);
      }

      // Check consistency (within 5% variance)
      const avgScore = scores.reduce((a, b) => a + b) / scores.length;
      const maxVariance = scores.reduce((max, score) => 
        Math.max(max, Math.abs(score - avgScore)), 0
      );

      expect(maxVariance).toBeLessThan(5);
    });
  });
});
```

### AI Performance Testing
```typescript
// ai-performance.test.ts
describe('AI Performance', () => {
  test('should handle concurrent requests', async () => {
    const requests = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      prompt: `Generate email for contact ${i}`,
    }));

    const startTime = Date.now();
    
    const results = await Promise.all(
      requests.map(req => aiService.generateEmail(req))
    );
    
    const duration = Date.now() - startTime;

    // All requests should complete
    expect(results).toHaveLength(50);
    expect(results.every(r => r !== null)).toBe(true);
    
    // Should complete within reasonable time
    expect(duration).toBeLessThan(30000); // 30 seconds for 50 requests
  });

  test('should implement rate limiting', async () => {
    const requests = Array.from({ length: 200 }, () => 
      aiService.generateEmail({ purpose: 'test' })
    );

    const results = await Promise.allSettled(requests);
    
    const rateLimited = results.filter(r => 
      r.status === 'rejected' && 
      r.reason.message.includes('rate limit')
    );

    expect(rateLimited.length).toBeGreaterThan(0);
  });
});
```

## Test Data Management

### Test Data Factories
```typescript
// factories/contact.factory.ts
import { Factory } from 'fishery';
import { faker } from '@faker-js/faker';
import { Contact } from '@prisma/client';

export const contactFactory = Factory.define<Contact>(() => ({
  id: faker.string.uuid(),
  firstName: faker.person.firstName(),
  lastName: faker.person.lastName(),
  email: faker.internet.email(),
  phone: faker.phone.number(),
  company: faker.company.name(),
  position: faker.person.jobTitle(),
  workspaceId: 'test_workspace',
  createdAt: faker.date.past(),
  updatedAt: new Date(),
}));

// Usage
const contact = contactFactory.build();
const contacts = contactFactory.buildList(10);
const vipContact = contactFactory.build({
  tags: ['vip'],
  customFields: { revenue: 1000000 },
});
```

### Test Data Seeding
```typescript
// seed/test-data.ts
import { PrismaClient } from '@prisma/client';
import { contactFactory } from '../factories/contact.factory';
import { dealFactory } from '../factories/deal.factory';

export async function seedTestData(prisma: PrismaClient) {
  // Create workspace
  const workspace = await prisma.workspace.create({
    data: {
      name: 'Test Workspace',
      subdomain: 'test',
    },
  });

  // Create users
  const users = await Promise.all([
    prisma.user.create({
      data: {
        email: 'admin@test.com',
        password: await hashPassword('password'),
        role: 'ADMIN',
        workspaceId: workspace.id,
      },
    }),
    prisma.user.create({
      data: {
        email: 'user@test.com',
        password: await hashPassword('password'),
        role: 'USER',
        workspaceId: workspace.id,
      },
    }),
  ]);

  // Create contacts
  const contacts = await prisma.contact.createMany({
    data: contactFactory.buildList(100, { workspaceId: workspace.id }),
  });

  // Create pipeline
  const pipeline = await prisma.pipeline.create({
    data: {
      name: 'Sales Pipeline',
      type: 'SALES',
      workspaceId: workspace.id,
      stages: {
        create: [
          { name: 'Lead', order: 1, probability: 10 },
          { name: 'Qualified', order: 2, probability: 25 },
          { name: 'Demo', order: 3, probability: 50 },
          { name: 'Proposal', order: 4, probability: 75 },
          { name: 'Closed Won', order: 5, probability: 100 },
          { name: 'Closed Lost', order: 6, probability: 0 },
        ],
      },
    },
  });

  // Create deals
  const stages = await prisma.stage.findMany({ where: { pipelineId: pipeline.id } });
  
  for (const stage of stages) {
    await prisma.deal.createMany({
      data: dealFactory.buildList(5, {
        workspaceId: workspace.id,
        pipelineId: pipeline.id,
        stageId: stage.id,
        ownerId: users[0].id,
      }),
    });
  }

  console.log('Test data seeded successfully');
}
```

### Test Database Management
```typescript
// test-db.ts
import { execSync } from 'child_process';

export class TestDatabase {
  private dbName: string;

  constructor() {
    this.dbName = `test_${process.env.JEST_WORKER_ID || '1'}`;
  }

  async setup() {
    // Create test database
    execSync(`createdb ${this.dbName}`, { stdio: 'ignore' });
    
    // Run migrations
    process.env.DATABASE_URL = this.getConnectionUrl();
    execSync('npx prisma migrate deploy', {
      env: { ...process.env },
    });
  }

  async teardown() {
    // Drop test database
    execSync(`dropdb ${this.dbName}`, { stdio: 'ignore' });
  }

  async reset() {
    // Truncate all tables
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE 
        contacts, deals, activities, users, workspaces 
      RESTART IDENTITY CASCADE
    `);
  }

  getConnectionUrl() {
    return `postgresql://postgres:password@localhost:5432/${this.dbName}`;
  }
}
```

## CI/CD Integration

### GitHub Actions Test Pipeline
```yaml
# .github/workflows/test.yml
name: Test Suite

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      
      - name: Run unit tests
        run: pnpm test:unit --coverage
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
          flags: unit

  integration-tests:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: password
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
      
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      
      - name: Setup database
        run: |
          cp .env.test .env
          pnpm prisma migrate deploy
      
      - name: Run integration tests
        run: pnpm test:integration
        env:
          DATABASE_URL: postgresql://postgres:password@localhost:5432/test
          REDIS_URL: redis://localhost:6379

  e2e-tests:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      
      - name: Install Playwright
        run: pnpm playwright install --with-deps
      
      - name: Build application
        run: pnpm build
      
      - name: Run E2E tests
        run: pnpm test:e2e
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/

  security-scan:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Run Snyk security scan
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
      
      - name: Run OWASP dependency check
        uses: dependency-check/Dependency-Check_Action@main
        with:
          project: 'hastecrm'
          path: '.'
          format: 'HTML'
      
      - name: Upload security reports
        uses: actions/upload-artifact@v3
        with:
          name: security-reports
          path: reports/

  performance-tests:
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Run performance tests
        uses: k6io/action@v0.3.0
        with:
          filename: tests/performance/load-test.js
      
      - name: Comment results on PR
        uses: actions/github-script@v6
        with:
          script: |
            const results = require('./results.json');
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `Performance test results: ${results.summary}`
            });
```

### Test Reporting
```typescript
// jest.config.js
module.exports = {
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.tsx',
    '!src/tests/**',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 75,
      statements: 75,
    },
  },
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: 'reports/junit',
      outputName: 'test-results.xml',
    }],
    ['jest-html-reporter', {
      pageTitle: 'Test Report',
      outputPath: 'reports/test-report.html',
      includeFailureMsg: true,
      includeConsoleLog: true,
    }],
  ],
};
```

## Best Practices

### Testing Principles
1. **Write tests first**: Follow TDD when possible
2. **Test behavior, not implementation**: Focus on what, not how
3. **Keep tests simple**: One assertion per test when practical
4. **Use descriptive names**: Tests should document behavior
5. **Maintain test independence**: No shared state between tests
6. **Mock external dependencies**: Keep tests fast and reliable

### Code Coverage Guidelines
```typescript
// Coverage requirements by type
const coverageRequirements = {
  // High coverage for critical paths
  authentication: 95,
  payments: 95,
  dataProcessing: 90,
  
  // Standard coverage for features
  features: 80,
  api: 85,
  services: 85,
  
  // Lower coverage acceptable for:
  ui: 70,      // Visual components
  utilities: 75, // Simple helpers
  mocks: 0,     // Test helpers
};
```

### Test Organization
```typescript
// Group related tests
describe('Feature Name', () => {
  describe('Happy Path', () => {
    // Normal scenarios
  });
  
  describe('Edge Cases', () => {
    // Boundary conditions
  });
  
  describe('Error Handling', () => {
    // Failure scenarios
  });
  
  describe('Performance', () => {
    // Performance-related tests
  });
});
```

### Test Data Best Practices
1. **Use factories**: Generate test data consistently
2. **Isolate test data**: Each test gets fresh data
3. **Clean up after tests**: Don't leave test data
4. **Use realistic data**: Match production patterns
5. **Seed sparingly**: Only what's needed for the test

### Continuous Improvement
1. **Monitor test metrics**: Track coverage, duration, flakiness
2. **Review test failures**: Fix flaky tests immediately
3. **Refactor tests**: Keep them maintainable
4. **Update test data**: Keep it relevant
5. **Document patterns**: Share testing knowledge

---

*Testing Guide v1.0*  
*Last Updated: January 2024*
