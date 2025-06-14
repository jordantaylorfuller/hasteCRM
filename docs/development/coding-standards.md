# Coding Standards

## Overview

This document defines the coding standards and best practices for hasteCRM. Following these standards ensures code consistency, maintainability, and quality across the entire codebase.

## Table of Contents

1. [General Principles](#general-principles)
2. [TypeScript/JavaScript Standards](#typescriptjavascript-standards)
3. [React/Frontend Standards](#reactfrontend-standards)
4. [Node.js/Backend Standards](#nodejsbackend-standards)
5. [Database Standards](#database-standards)
6. [API Design Standards](#api-design-standards)
7. [Testing Standards](#testing-standards)
8. [Security Standards](#security-standards)
9. [Documentation Standards](#documentation-standards)
10. [Git & Version Control](#git--version-control)

## General Principles

### Core Values

1. **Readability** - Code should be self-documenting and easy to understand
2. **Maintainability** - Code should be easy to modify and extend
3. **Consistency** - Follow established patterns throughout the codebase
4. **Simplicity** - Prefer simple solutions over complex ones
5. **Performance** - Consider performance implications, but don't optimize prematurely

### Code Quality Rules

- No commented-out code in production
- No console.log statements in production code
- Handle all error cases explicitly
- Avoid magic numbers and strings - use constants
- Keep functions small and focused (single responsibility)
- Limit function parameters to 3-4 maximum
- Use early returns to reduce nesting

## TypeScript/JavaScript Standards

### Language Version

- TypeScript 5.0+
- Target ES2022 for Node.js
- Target ES2020 for browser code
- Use strict mode always

### File Organization

```typescript
// 1. Imports - grouped and ordered
import React, { useState, useEffect } from "react"; // React imports first
import { useRouter } from "next/router"; // Framework imports

import { Button, Card } from "@/components/ui"; // Internal UI components
import { ContactService } from "@/services/contact"; // Internal services
import { Contact, ContactInput } from "@/types"; // Types

import { formatDate, validateEmail } from "@/utils"; // Utilities
import styles from "./ContactList.module.css"; // Styles last

// 2. Type definitions
interface ContactListProps {
  workspaceId: string;
  onContactSelect: (contact: Contact) => void;
}

// 3. Constants
const ITEMS_PER_PAGE = 20;
const DEBOUNCE_DELAY = 300;

// 4. Component/Function definition
export function ContactList({
  workspaceId,
  onContactSelect,
}: ContactListProps) {
  // Implementation
}

// 5. Helper functions (if needed)
function filterContacts(contacts: Contact[], query: string): Contact[] {
  // Implementation
}
```

### Naming Conventions

#### Variables and Functions

```typescript
// Use camelCase for variables and functions
const userEmail = "user@haste.nyc";
function calculateTotalRevenue(deals: Deal[]): number {
  // Implementation
}

// Use UPPER_SNAKE_CASE for constants
const MAX_RETRY_ATTEMPTS = 3;
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

// Use descriptive names
// Bad
const d = new Date();
const u = await getUser();

// Good
const createdDate = new Date();
const currentUser = await getUser();
```

#### Classes and Interfaces

```typescript
// Use PascalCase for classes, interfaces, types, and enums
class ContactService {
  // Implementation
}

interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

type ContactStatus = "active" | "inactive" | "pending";

enum ErrorCode {
  NotFound = "NOT_FOUND",
  Unauthorized = "UNAUTHORIZED",
  ValidationError = "VALIDATION_ERROR",
}
```

#### Files and Directories

```
// Use kebab-case for file names
contact-service.ts
email-template.tsx
api-client.ts

// Use PascalCase for React components
ContactList.tsx
EmailComposer.tsx
DealPipeline.tsx

// Group related files in directories
/components
  /contacts
    ContactList.tsx
    ContactCard.tsx
    ContactForm.tsx
    index.ts
```

### TypeScript Best Practices

#### Type Safety

```typescript
// Always use explicit types for function parameters and return values
function createContact(input: ContactInput): Promise<Contact> {
  // Implementation
}

// Use type guards
function isContact(value: unknown): value is Contact {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    "email" in value
  );
}

// Avoid 'any' type - use 'unknown' if type is truly unknown
// Bad
function processData(data: any) {
  // Implementation
}

// Good
function processData(data: unknown) {
  if (isValidData(data)) {
    // Process with type safety
  }
}

// Use discriminated unions for complex types
type ApiResponse<T> =
  | { status: "success"; data: T }
  | { status: "error"; error: string }
  | { status: "loading" };
```

#### Null/Undefined Handling

```typescript
// Use optional chaining
const userName = user?.profile?.name ?? "Unknown";

// Use nullish coalescing
const port = process.env.PORT ?? 3000;

// Be explicit about null/undefined
interface User {
  id: string;
  email: string;
  phone?: string; // Optional
  deletedAt: Date | null; // Nullable
}
```

### Async/Await Best Practices

```typescript
// Always use try-catch for async operations
async function fetchContact(id: string): Promise<Contact> {
  try {
    const response = await api.get(`/contacts/${id}`);
    return response.data;
  } catch (error) {
    logger.error("Failed to fetch contact", { id, error });
    throw new ContactNotFoundError(id);
  }
}

// Parallel execution when possible
const [contacts, companies, deals] = await Promise.all([
  fetchContacts(),
  fetchCompanies(),
  fetchDeals(),
]);

// Handle errors in parallel operations
const results = await Promise.allSettled([
  fetchContacts(),
  fetchCompanies(),
  fetchDeals(),
]);

results.forEach((result, index) => {
  if (result.status === "rejected") {
    logger.error(`Operation ${index} failed:`, result.reason);
  }
});
```

## React/Frontend Standards

### Component Structure

```typescript
// Functional components with TypeScript
import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'next-i18next';

interface ContactCardProps {
  contact: Contact;
  onEdit: (contact: Contact) => void;
  onDelete: (id: string) => void;
  isSelected?: boolean;
}

export function ContactCard({
  contact,
  onEdit,
  onDelete,
  isSelected = false
}: ContactCardProps) {
  // 1. Hooks at the top
  const { t } = useTranslation('contacts');
  const [isDeleting, setIsDeleting] = useState(false);

  // 2. Computed values
  const fullName = useMemo(
    () => `${contact.firstName} ${contact.lastName}`.trim(),
    [contact.firstName, contact.lastName]
  );

  // 3. Effects
  useEffect(() => {
    // Effect logic
  }, [contact.id]);

  // 4. Event handlers
  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete(contact.id);
    } catch (error) {
      console.error('Failed to delete contact:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  // 5. Render
  return (
    <div className={`contact-card ${isSelected ? 'selected' : ''}`}>
      {/* Component JSX */}
    </div>
  );
}
```

### Hooks Best Practices

```typescript
// Custom hooks for reusable logic
function useContacts(workspaceId: string) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadContacts() {
      try {
        setLoading(true);
        const data = await ContactService.list(workspaceId);
        if (!cancelled) {
          setContacts(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err as Error);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadContacts();

    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  return { contacts, loading, error, refetch: loadContacts };
}

// Memoization for expensive computations
const sortedContacts = useMemo(
  () => contacts.sort((a, b) => a.lastName.localeCompare(b.lastName)),
  [contacts],
);

// useCallback for stable function references
const handleSearch = useCallback(
  debounce((query: string) => {
    searchContacts(query);
  }, 300),
  [searchContacts],
);
```

### State Management

```typescript
// Use Zustand for global state
import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

interface AppState {
  user: User | null;
  workspace: Workspace | null;
  setUser: (user: User | null) => void;
  setWorkspace: (workspace: Workspace | null) => void;
}

export const useAppStore = create<AppState>()(
  devtools(
    persist(
      (set) => ({
        user: null,
        workspace: null,
        setUser: (user) => set({ user }),
        setWorkspace: (workspace) => set({ workspace }),
      }),
      {
        name: "app-storage",
      },
    ),
  ),
);

// Component state for local UI state
const [isOpen, setIsOpen] = useState(false);
const [selectedItems, setSelectedItems] = useState<string[]>([]);
```

### Performance Optimization

```typescript
// Lazy loading for code splitting
const EmailComposer = lazy(() => import('./EmailComposer'));

// React.memo for expensive components
export const ContactList = memo(({ contacts }: ContactListProps) => {
  return (
    <div>
      {contacts.map(contact => (
        <ContactCard key={contact.id} contact={contact} />
      ))}
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison if needed
  return prevProps.contacts.length === nextProps.contacts.length;
});

// Virtualization for large lists
import { FixedSizeList } from 'react-window';

function VirtualContactList({ contacts }: { contacts: Contact[] }) {
  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => (
    <div style={style}>
      <ContactCard contact={contacts[index]} />
    </div>
  );

  return (
    <FixedSizeList
      height={600}
      itemCount={contacts.length}
      itemSize={80}
      width="100%"
    >
      {Row}
    </FixedSizeList>
  );
}
```

## Node.js/Backend Standards

### Project Structure

```
/src
  /config         # Configuration files
  /controllers    # Request handlers
  /services       # Business logic
  /repositories   # Data access layer
  /models         # Database models
  /middlewares    # Express middlewares
  /utils          # Utility functions
  /types          # TypeScript type definitions
  /validators     # Input validation schemas
  /workers        # Background job handlers
```

### Service Layer Pattern

```typescript
// services/contact.service.ts
export class ContactService {
  constructor(
    private contactRepo: ContactRepository,
    private emailService: EmailService,
    private aiService: AIService,
  ) {}

  async createContact(input: CreateContactInput): Promise<Contact> {
    // Validate input
    const validated = contactSchema.parse(input);

    // Business logic
    const enrichedData = await this.aiService.enrichContact(validated.email);

    // Data persistence
    const contact = await this.contactRepo.create({
      ...validated,
      enrichmentData: enrichedData,
    });

    // Side effects
    await this.emailService.sendWelcomeEmail(contact);

    return contact;
  }

  async searchContacts(
    workspaceId: string,
    query: string,
    options: SearchOptions,
  ): Promise<PaginatedResult<Contact>> {
    // Complex search logic
    const filters = this.buildSearchFilters(query);
    return this.contactRepo.search(workspaceId, filters, options);
  }
}
```

### Error Handling

```typescript
// Custom error classes
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string,
    public details?: any,
  ) {
    super(message);
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details: any) {
    super(message, 400, "VALIDATION_ERROR", details);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(`${resource} with id ${id} not found`, 404, "NOT_FOUND");
  }
}

// Global error handler middleware
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
  }

  // Log unexpected errors
  logger.error("Unexpected error:", err);

  res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred",
    },
  });
}
```

### Dependency Injection

```typescript
// Use a DI container (e.g., tsyringe)
import { container, injectable, inject } from "tsyringe";

@injectable()
export class ContactController {
  constructor(
    @inject("ContactService") private contactService: ContactService,
    @inject("Logger") private logger: Logger,
  ) {}

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const contact = await this.contactService.createContact(req.body);
      res.status(201).json({ data: contact });
    } catch (error) {
      next(error);
    }
  }
}

// Container setup
container.register("ContactService", { useClass: ContactService });
container.register("Logger", { useValue: logger });
```

## Database Standards

### Query Patterns

```typescript
// Use query builders for complex queries
export class ContactRepository {
  async search(
    workspaceId: string,
    filters: ContactFilters,
    options: PaginationOptions,
  ): Promise<PaginatedResult<Contact>> {
    const query = db
      .select("*")
      .from("contacts")
      .where("workspace_id", workspaceId)
      .where("deleted_at", null);

    // Dynamic filters
    if (filters.email) {
      query.where("email", "ilike", `%${filters.email}%`);
    }

    if (filters.tags?.length) {
      query.whereIn("id", function () {
        this.select("contact_id")
          .from("contact_tags")
          .whereIn("tag_id", filters.tags);
      });
    }

    // Sorting
    const sortColumn = options.sortBy || "created_at";
    const sortOrder = options.sortOrder || "desc";
    query.orderBy(sortColumn, sortOrder);

    // Pagination
    const page = options.page || 1;
    const limit = options.limit || 20;
    const offset = (page - 1) * limit;

    const [data, countResult] = await Promise.all([
      query.limit(limit).offset(offset),
      db("contacts")
        .where("workspace_id", workspaceId)
        .where("deleted_at", null)
        .count("* as total"),
    ]);

    const total = parseInt(countResult[0].total);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
```

### Transaction Management

```typescript
// Use transactions for data consistency
async function transferDeal(
  dealId: string,
  fromUserId: string,
  toUserId: string,
): Promise<void> {
  await db.transaction(async (trx) => {
    // Update deal owner
    await trx("deals").where("id", dealId).update({
      owner_id: toUserId,
      updated_at: new Date(),
    });

    // Log the transfer
    await trx("deal_history").insert({
      deal_id: dealId,
      field_name: "owner_id",
      old_value: fromUserId,
      new_value: toUserId,
      changed_by: getCurrentUserId(),
      changed_at: new Date(),
    });

    // Update activity
    await trx("activities").insert({
      type: "deal_transferred",
      entity_type: "deal",
      entity_id: dealId,
      metadata: { from: fromUserId, to: toUserId },
      user_id: getCurrentUserId(),
      occurred_at: new Date(),
    });
  });
}
```

## API Design Standards

### RESTful Conventions

```typescript
// Resource naming - use plural nouns
GET    /api/contacts           // List contacts
GET    /api/contacts/:id       // Get single contact
POST   /api/contacts           // Create contact
PUT    /api/contacts/:id       // Update entire contact
PATCH  /api/contacts/:id       // Partial update
DELETE /api/contacts/:id       // Delete contact

// Nested resources
GET    /api/contacts/:id/activities
POST   /api/contacts/:id/tags
DELETE /api/contacts/:id/tags/:tagId

// Actions that don't fit REST
POST   /api/contacts/:id/merge
POST   /api/contacts/bulk/import
POST   /api/emails/send
```

### Request/Response Format

```typescript
// Consistent response structure
interface ApiResponse<T> {
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    pagination?: PaginationMeta;
    rateLimit?: RateLimitMeta;
  };
}

// Success response
{
  "data": {
    "id": "123",
    "email": "john@haste.nyc",
    "firstName": "John",
    "lastName": "Doe"
  },
  "meta": {
    "rateLimit": {
      "limit": 1000,
      "remaining": 999,
      "reset": 1634567890
    }
  }
}

// Error response
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": {
      "email": "Invalid email format",
      "phone": "Phone number too long"
    }
  }
}

// List response with pagination
{
  "data": [...],
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "totalPages": 8,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

### API Versioning

```typescript
// Version in URL path
app.use("/api/v1", v1Routes);
app.use("/api/v2", v2Routes);

// Version in header (alternative)
app.use((req, res, next) => {
  const version = req.headers["api-version"] || "v1";
  req.apiVersion = version;
  next();
});
```

## Testing Standards

### Test Organization

```typescript
// Mirror source structure
/src
  /services
    contact.service.ts
/tests
  /unit
    /services
      contact.service.test.ts
  /integration
    /api
      contacts.test.ts
  /e2e
    contact-management.test.ts
```

### Unit Testing

```typescript
// Use descriptive test names
describe("ContactService", () => {
  let contactService: ContactService;
  let mockContactRepo: jest.Mocked<ContactRepository>;

  beforeEach(() => {
    mockContactRepo = createMockContactRepo();
    contactService = new ContactService(mockContactRepo);
  });

  describe("createContact", () => {
    it("should create a contact with valid input", async () => {
      // Arrange
      const input: CreateContactInput = {
        email: "test@haste.nyc",
        firstName: "John",
        lastName: "Doe",
      };

      const expectedContact = {
        id: "123",
        ...input,
        createdAt: new Date(),
      };

      mockContactRepo.create.mockResolvedValue(expectedContact);

      // Act
      const result = await contactService.createContact(input);

      // Assert
      expect(result).toEqual(expectedContact);
      expect(mockContactRepo.create).toHaveBeenCalledWith(input);
    });

    it("should throw ValidationError for invalid email", async () => {
      // Arrange
      const input = {
        email: "invalid-email",
        firstName: "John",
      };

      // Act & Assert
      await expect(contactService.createContact(input)).rejects.toThrow(
        ValidationError,
      );
    });
  });
});
```

### Integration Testing

```typescript
// Test API endpoints with real database
describe("POST /api/contacts", () => {
  let app: Application;
  let testDb: TestDatabase;

  beforeAll(async () => {
    testDb = await createTestDatabase();
    app = createApp(testDb);
  });

  afterAll(async () => {
    await testDb.cleanup();
  });

  beforeEach(async () => {
    await testDb.reset();
  });

  it("should create a contact successfully", async () => {
    const response = await request(app)
      .post("/api/contacts")
      .set("Authorization", "Bearer test-token")
      .send({
        email: "test@haste.nyc",
        firstName: "John",
        lastName: "Doe",
      });

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      email: "test@haste.nyc",
      firstName: "John",
      lastName: "Doe",
    });

    // Verify in database
    const contact = await testDb.query(
      "SELECT * FROM contacts WHERE email = $1",
      ["test@haste.nyc"],
    );
    expect(contact.rows).toHaveLength(1);
  });
});
```

### Test Coverage Requirements

- Minimum 80% code coverage
- 100% coverage for critical business logic
- Focus on behavior, not implementation
- Test edge cases and error scenarios

## Security Standards

### Input Validation

```typescript
// Use Zod for schema validation
import { z } from "zod";

const createContactSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  phone: z
    .string()
    .regex(/^\+?[1-9]\d{1,14}$/)
    .optional(),
  customFields: z.record(z.unknown()).optional(),
});

// Validate in middleware
export function validate<T>(schema: z.Schema<T>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid input",
            details: error.errors,
          },
        });
      }
      next(error);
    }
  };
}
```

### Authentication & Authorization

```typescript
// JWT authentication middleware
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      throw new UnauthorizedError("No token provided");
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await userService.findById(payload.userId);

    if (!user) {
      throw new UnauthorizedError("User not found");
    }

    req.user = user;
    next();
  } catch (error) {
    next(new UnauthorizedError("Invalid token"));
  }
}

// Role-based authorization
export function authorize(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new UnauthorizedError("Not authenticated"));
    }

    if (!roles.includes(req.user.role)) {
      return next(new ForbiddenError("Insufficient permissions"));
    }

    next();
  };
}

// Usage
router.post(
  "/api/users",
  authenticate,
  authorize("admin"),
  validate(createUserSchema),
  userController.create,
);
```

### Security Best Practices

```typescript
// Prevent SQL injection - use parameterized queries
// Bad
const query = `SELECT * FROM users WHERE email = '${email}'`;

// Good
const query = "SELECT * FROM users WHERE email = $1";
const result = await db.query(query, [email]);

// Prevent XSS - sanitize user input
import DOMPurify from "isomorphic-dompurify";

const sanitizedHtml = DOMPurify.sanitize(userInput);

// Rate limiting
import rateLimit from "express-rate-limit";

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP",
});

app.use("/api/", apiLimiter);

// CORS configuration
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(",") || "*",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
```

## Documentation Standards

### Code Comments

```typescript
/**
 * Creates a new contact in the system.
 *
 * @param input - The contact creation data
 * @returns The created contact with generated ID and timestamps
 * @throws {ValidationError} If input data is invalid
 * @throws {DuplicateError} If email already exists in workspace
 *
 * @example
 * const contact = await contactService.createContact({
 *   email: 'john@haste.nyc',
 *   firstName: 'John',
 *   lastName: 'Doe',
 * });
 */
async function createContact(input: CreateContactInput): Promise<Contact> {
  // Implementation
}

// Use inline comments sparingly for complex logic
const score = contacts.reduce((total, contact) => {
  // Weight recent activity higher using exponential decay
  const daysSinceActivity = getDaysSince(contact.lastActivityAt);
  const activityScore = Math.exp(-daysSinceActivity / 30);

  return total + contact.baseScore * activityScore;
}, 0);
```

### API Documentation

```typescript
/**
 * @swagger
 * /api/contacts:
 *   post:
 *     summary: Create a new contact
 *     tags: [Contacts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateContactInput'
 *     responses:
 *       201:
 *         description: Contact created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Contact'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post(
  "/contacts",
  authenticate,
  validate(createContactSchema),
  contactController.create,
);
```

### README Files

Each module should have a README explaining:

- Purpose and functionality
- Setup instructions
- API endpoints (if applicable)
- Environment variables
- Testing instructions
- Common issues and solutions

## Git & Version Control

### Branch Naming

```
feature/add-email-templates
bugfix/fix-contact-search
hotfix/security-patch
chore/update-dependencies
refactor/improve-query-performance
```

### Commit Messages

Follow conventional commits format:

```
feat: add email template management
fix: resolve contact search pagination issue
docs: update API documentation
style: format code with prettier
refactor: extract email service from contact service
test: add integration tests for deal pipeline
chore: upgrade TypeScript to v5.0
perf: optimize contact list query
```

### Pull Request Guidelines

1. Keep PRs small and focused
2. Include tests for new features
3. Update documentation as needed
4. Ensure all CI checks pass
5. Request review from appropriate team members
6. Squash commits when merging

### Code Review Checklist

- [ ] Code follows style guidelines
- [ ] Tests are included and passing
- [ ] Documentation is updated
- [ ] No security vulnerabilities
- [ ] Performance impact considered
- [ ] Error handling is appropriate
- [ ] Code is DRY and maintainable

## Enforcement

### Automated Tools

```json
// .eslintrc.json
{
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "prettier"
  ],
  "rules": {
    "no-console": "error",
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/explicit-function-return-type": "error",
    "@typescript-eslint/no-explicit-any": "error"
  }
}

// .prettierrc
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2
}
```

### Pre-commit Hooks

```json
// package.json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged",
      "commit-msg": "commitlint -E HUSKY_GIT_PARAMS"
    }
  },
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{json,md}": ["prettier --write"]
  }
}
```

### CI/CD Checks

- Linting (ESLint)
- Formatting (Prettier)
- Type checking (TypeScript)
- Unit tests
- Integration tests
- Code coverage
- Security scanning
- Bundle size analysis

## Conclusion

These coding standards are living documents that should evolve with the project. All team members are expected to follow these guidelines and contribute to their improvement. When in doubt, prioritize code readability and maintainability over clever solutions.

For questions or suggestions, please open a discussion in the team's communication channel or submit a pull request to update this document.
