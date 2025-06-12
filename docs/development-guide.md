# Development Guide

## Quick Start

```bash
# Clone and setup
git clone https://github.com/hasteNYC/hasteCRM.git
cd hasteCRM
./scripts/init.sh

# Start development
pnpm dev
```

Access:
- Web: http://localhost:3000
- API: http://localhost:4000/graphql

## Project Structure

```
hasteCRM/
├── apps/
│   ├── web/          # Next.js frontend
│   ├── api/          # NestJS backend
│   └── worker/       # Background jobs
├── packages/
│   ├── database/     # Prisma schema & migrations
│   ├── ui/          # Shared React components
│   ├── types/       # TypeScript types
│   └── shared/      # Shared utilities
└── docs/            # Documentation
```

## Development Workflow

### 1. Create Feature Branch
```bash
git checkout -b feature/your-feature
```

### 2. Make Changes

#### Frontend (Next.js)
```typescript
// apps/web/app/contacts/page.tsx
export default async function ContactsPage() {
  const contacts = await getContacts();
  return <ContactList contacts={contacts} />;
}
```

#### Backend (NestJS)
```typescript
// apps/api/src/contacts/contacts.service.ts
@Injectable()
export class ContactsService {
  async findAll(workspaceId: string) {
    return this.prisma.contact.findMany({
      where: { workspaceId }
    });
  }
}
```

### 3. Run Tests
```bash
pnpm test
pnpm typecheck
pnpm lint
```

### 4. Commit Changes
```bash
git add .
git commit -m "feat: add contact filtering"
```

## Key Commands

```bash
# Development
pnpm dev              # Start all services
pnpm dev:api         # Start API only
pnpm dev:web         # Start web only

# Database
pnpm db:migrate      # Run migrations
pnpm db:seed         # Seed data
pnpm db:studio       # Open Prisma Studio

# Testing
pnpm test            # Run all tests
pnpm test:watch      # Watch mode
pnpm test:e2e        # E2E tests

# Building
pnpm build           # Build all packages
pnpm build:api       # Build API only

# Utilities
pnpm clean           # Clean all builds
pnpm typecheck       # Check TypeScript
pnpm lint            # Run linter
```

## Environment Setup

Copy `.env.example` to `.env` and configure:

```env
# Required
DATABASE_URL=postgresql://postgres:password@localhost:5432/hasteCRM_dev
JWT_SECRET=your-secret-key-min-32-chars
ANTHROPIC_API_KEY=your-anthropic-key

# Optional
GOOGLE_CLIENT_ID=your-google-oauth-id
GOOGLE_CLIENT_SECRET=your-google-oauth-secret
```

## Common Tasks

### Add New Package
```bash
pnpm add package-name --filter=web
pnpm add package-name --filter=api
```

### Create Migration
```bash
# Edit schema.prisma first
pnpm -F database prisma migrate dev --name your_migration_name
```

### Debug API
```bash
# Start with debugger
pnpm -F api dev:debug

# Attach VS Code debugger on port 9229
```

## Code Style

### TypeScript
```typescript
// ✅ Good
export async function getContact(id: string): Promise<Contact> {
  const contact = await db.contact.findUnique({ where: { id } });
  if (!contact) throw new NotFoundError('Contact not found');
  return contact;
}

// ❌ Bad
export async function getContact(id) {
  return await db.contact.findUnique({ where: { id } });
}
```

### React Components
```tsx
// ✅ Good
interface ContactCardProps {
  contact: Contact;
  onEdit?: (id: string) => void;
}

export function ContactCard({ contact, onEdit }: ContactCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{contact.fullName}</CardTitle>
      </CardHeader>
    </Card>
  );
}
```

### GraphQL Resolvers
```typescript
@Resolver(() => Contact)
export class ContactResolver {
  @Query(() => Contact, { nullable: true })
  async contact(
    @Args('id') id: string,
    @CurrentWorkspace() workspaceId: string
  ): Promise<Contact | null> {
    return this.contactService.findOne(id, workspaceId);
  }
}
```

## Troubleshooting

### Port Already in Use
```bash
lsof -ti:3000 | xargs kill -9
lsof -ti:4000 | xargs kill -9
```

### Database Connection Error
```bash
docker-compose restart postgres
```

### Type Errors
```bash
pnpm clean
pnpm install
pnpm build:packages
```

### Clear Cache
```bash
rm -rf .next .turbo node_modules/.cache