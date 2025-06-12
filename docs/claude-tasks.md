# Claude Code Implementation Phases

## Phase 1: Foundation (Days 1-3)

### Tasks

- [ ] Initialize monorepo with Turborepo
- [ ] Set up Next.js 14 web app
- [x] Set up NestJS API with GraphQL
- [x] Configure PostgreSQL + Prisma
- [x] Implement JWT authentication
- [x] Create workspace management
- [x] Set up development environment

### Key Files

- `/packages/database/prisma/schema.prisma`
- `/apps/api/src/auth/auth.module.ts`
- `/apps/web/app/layout.tsx`

## Phase 2: Contact Management (Days 4-5)

### Tasks

- [ ] Create contact CRUD operations
- [ ] Implement contact search
- [ ] Add company relationships
- [ ] Build contact UI components
- [ ] Add bulk import/export

### Key Files

- `/apps/api/src/contacts/contacts.resolver.ts`
- `/apps/web/app/contacts/page.tsx`

## Phase 3: Gmail Integration (Days 6-7)

### Tasks

- [ ] Implement Google OAuth
- [ ] Set up Gmail API sync
- [ ] Configure webhooks for real-time updates
- [ ] Create email UI components
- [ ] Add email search and filtering

### Key Files

- `/apps/api/src/gmail/gmail.service.ts`
- `/apps/api/src/webhooks/gmail-webhook.controller.ts`

## Phase 4: AI Features (Days 8-9)

### Tasks

- [ ] Integrate Claude API
- [ ] Add email summarization
- [ ] Implement smart compose
- [ ] Create AI insights dashboard
- [ ] Add contact enrichment

### Key Files

- `/apps/api/src/ai/ai.service.ts`
- `/apps/web/components/ai/email-composer.tsx`

## Phase 5: Pipeline Management (Days 10-11)

### Tasks

- [ ] Create pipeline/stage models
- [ ] Build deal management
- [ ] Add drag-and-drop UI
- [ ] Implement pipeline analytics
- [ ] Create automation rules

### Key Files

- `/apps/api/src/pipelines/pipelines.resolver.ts`
- `/apps/web/app/pipelines/page.tsx`

## Phase 6: Production Prep (Days 12-14)

### Tasks

- [ ] Add comprehensive error handling
- [x] Implement rate limiting
- [ ] Set up monitoring
- [ ] Create Docker configurations
- [ ] Write E2E tests
- [ ] Deploy to staging

### Key Files

- `/docker-compose.production.yml`
- `/.github/workflows/ci.yml`

## Implementation Tips

### Start Each Phase

1. Read phase documentation
2. Set up required services
3. Create database migrations
4. Build API endpoints first
5. Then create UI components

### Testing Strategy

- Unit tests for services
- Integration tests for API
- E2E tests for critical flows

### Common Patterns

#### API Service

```typescript
@Injectable()
export class ContactService {
  constructor(private prisma: PrismaService) {}

  async findAll(workspaceId: string) {
    return this.prisma.contact.findMany({
      where: { workspaceId },
    });
  }
}
```

#### React Component

```tsx
export function ContactList({ contacts }: Props) {
  return (
    <div className="grid gap-4">
      {contacts.map((contact) => (
        <ContactCard key={contact.id} contact={contact} />
      ))}
    </div>
  );
}
```

## Success Criteria

Each phase is complete when:

- All tasks checked off
- Tests passing
- No TypeScript errors
- Code reviewed and clean
