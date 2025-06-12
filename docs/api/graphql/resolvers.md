# GraphQL Resolvers Implementation Guide

## Overview

This guide covers the implementation of GraphQL resolvers in hasteCRM using NestJS and Apollo Server. We follow a modular approach with clear separation between schema definition and business logic.

## Architecture

### Module Structure
```
apps/api/src/
├── graphql/
│   ├── schema.graphql          # Generated schema
│   ├── common/
│   │   ├── scalars/
│   │   ├── interfaces/
│   │   └── directives/
│   └── modules/
│       ├── auth/
│       ├── contacts/
│       ├── companies/
│       ├── deals/
│       └── activities/
```

## Base Resolver Pattern

### Abstract Base Resolver
```typescript
import { UseGuards } from '@nestjs/common';
import { Resolver } from '@nestjs/graphql';
import { GqlAuthGuard } from '@/auth/guards/gql-auth.guard';
import { WorkspaceGuard } from '@/auth/guards/workspace.guard';

@Resolver()
@UseGuards(GqlAuthGuard, WorkspaceGuard)
export abstract class BaseResolver {
  // Common resolver functionality
}
```

## Contact Resolver Example

### Schema Definition
```graphql
# contacts.graphql
type Query {
  contact(id: ID!): Contact
  contacts(
    first: Int = 20
    after: String
    filter: ContactFilter
    orderBy: ContactOrderBy
  ): ContactConnection!
}

type Mutation {
  createContact(input: CreateContactInput!): ContactPayload!
  updateContact(input: UpdateContactInput!): ContactPayload!
  deleteContact(id: ID!): DeletePayload!
  batchUpdateContacts(
    ids: [ID!]!
    data: UpdateContactData!
  ): BatchUpdatePayload!
}

type Subscription {
  contactCreated(workspaceId: ID!): Contact!
  contactUpdated(contactId: ID!): Contact!
  contactDeleted(contactId: ID!): ID!
}
```

### Resolver Implementation
```typescript
// contacts/contacts.resolver.ts
import { Resolver, Query, Mutation, Subscription, Args, Parent, ResolveField } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import { CurrentWorkspace } from '@/auth/decorators/current-workspace.decorator';
import { Contact } from './entities/contact.entity';
import { ContactsService } from './contacts.service';
import { PubSubService } from '@/pubsub/pubsub.service';

@Resolver(() => Contact)
@UseGuards(GqlAuthGuard, WorkspaceGuard)
export class ContactsResolver extends BaseResolver {
  constructor(
    private readonly contactsService: ContactsService,
    private readonly pubsub: PubSubService,
  ) {
    super();
  }

  // ==========================================
  // Queries
  // ==========================================

  @Query(() => Contact, { nullable: true })
  async contact(
    @Args('id') id: string,
    @CurrentWorkspace() workspaceId: string,
  ): Promise<Contact | null> {
    return this.contactsService.findOne(id, workspaceId);
  }

  @Query(() => ContactConnection)
  async contacts(
    @Args('first', { type: () => Int, defaultValue: 20 }) first: number,
    @Args('after', { nullable: true }) after?: string,
    @Args('filter', { nullable: true }) filter?: ContactFilter,
    @Args('orderBy', { nullable: true }) orderBy?: ContactOrderBy,
    @CurrentWorkspace() workspaceId: string,
  ): Promise<ContactConnection> {
    return this.contactsService.findAll({
      first,
      after,
      filter,
      orderBy,
      workspaceId,
    });
  }

  // ==========================================
  // Mutations
  // ==========================================

  @Mutation(() => ContactPayload)
  async createContact(
    @Args('input') input: CreateContactInput,
    @CurrentUser() user: User,
    @CurrentWorkspace() workspaceId: string,
  ): Promise<ContactPayload> {
    try {
      const contact = await this.contactsService.create({
        ...input,
        workspaceId,
        createdById: user.id,
      });

      // Publish event
      await this.pubsub.publish('contactCreated', {
        contactCreated: contact,
        workspaceId,
      });

      return { contact, errors: [] };
    } catch (error) {
      return this.handleMutationError(error);
    }
  }

  @Mutation(() => ContactPayload)
  async updateContact(
    @Args('input') input: UpdateContactInput,
    @CurrentWorkspace() workspaceId: string,
  ): Promise<ContactPayload> {
    try {
      const contact = await this.contactsService.update(
        input.id,
        input,
        workspaceId,
      );

      // Publish event
      await this.pubsub.publish(`contact.${input.id}.updated`, {
        contactUpdated: contact,
      });

      return { contact, errors: [] };
    } catch (error) {
      return this.handleMutationError(error);
    }
  }

  @Mutation(() => DeletePayload)
  async deleteContact(
    @Args('id') id: string,
    @CurrentWorkspace() workspaceId: string,
  ): Promise<DeletePayload> {
    try {
      await this.contactsService.delete(id, workspaceId);

      // Publish event
      await this.pubsub.publish(`contact.${id}.deleted`, {
        contactDeleted: id,
      });

      return { success: true, errors: [] };
    } catch (error) {
      return this.handleMutationError(error);
    }
  }

  // ==========================================
  // Field Resolvers
  // ==========================================

  @ResolveField(() => String)
  fullName(@Parent() contact: Contact): string {
    const parts = [contact.firstName, contact.lastName].filter(Boolean);
    return parts.join(' ') || 'Unnamed Contact';
  }

  @ResolveField(() => Company, { nullable: true })
  async company(
    @Parent() contact: Contact,
    @CurrentWorkspace() workspaceId: string,
  ): Promise<Company | null> {
    if (!contact.companyId) return null;
    return this.companiesService.findOne(contact.companyId, workspaceId);
  }

  @ResolveField(() => ActivityConnection)
  async activities(
    @Parent() contact: Contact,
    @Args('first', { type: () => Int, defaultValue: 20 }) first: number,
    @Args('after', { nullable: true }) after?: string,
    @Args('filter', { nullable: true }) filter?: ActivityFilter,
  ): Promise<ActivityConnection> {
    return this.activitiesService.findByContact({
      contactId: contact.id,
      first,
      after,
      filter,
    });
  }

  @ResolveField(() => [Tag])
  async tags(@Parent() contact: Contact): Promise<Tag[]> {
    return this.tagsService.findByContact(contact.id);
  }

  // ==========================================
  // Subscriptions
  // ==========================================

  @Subscription(() => Contact, {
    filter: (payload, variables) => {
      return payload.workspaceId === variables.workspaceId;
    },
  })
  contactCreated(@Args('workspaceId') workspaceId: string) {
    return this.pubsub.asyncIterator('contactCreated');
  }

  @Subscription(() => Contact)
  contactUpdated(@Args('contactId') contactId: string) {
    return this.pubsub.asyncIterator(`contact.${contactId}.updated`);
  }

  @Subscription(() => ID)
  contactDeleted(@Args('contactId') contactId: string) {
    return this.pubsub.asyncIterator(`contact.${contactId}.deleted`);
  }

  // ==========================================
  // Helper Methods
  // ==========================================

  private handleMutationError(error: any): any {
    if (error.code === 'P2002') {
      return {
        contact: null,
        errors: [{
          field: 'email',
          message: 'A contact with this email already exists',
          code: 'DUPLICATE',
        }],
      };
    }

    throw error;
  }
}
```

## Service Layer

### Contact Service
```typescript
// contacts/contacts.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CacheService } from '@/cache/cache.service';
import { SearchService } from '@/search/search.service';
import { EnrichmentService } from '@/enrichment/enrichment.service';

@Injectable()
export class ContactsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly search: SearchService,
    private readonly enrichment: EnrichmentService,
  ) {}

  async findOne(id: string, workspaceId: string): Promise<Contact | null> {
    // Check cache first
    const cached = await this.cache.get(`contact:${id}`);
    if (cached) return cached;

    const contact = await this.prisma.contact.findFirst({
      where: {
        id,
        workspaceId,
        deletedAt: null,
      },
      include: {
        company: true,
        tags: {
          include: {
            tag: true,
          },
        },
        customFields: {
          include: {
            field: true,
          },
        },
      },
    });

    if (contact) {
      await this.cache.set(`contact:${id}`, contact, 300); // 5 min cache
    }

    return contact;
  }

  async findAll(params: {
    first: number;
    after?: string;
    filter?: ContactFilter;
    orderBy?: ContactOrderBy;
    workspaceId: string;
  }): Promise<ContactConnection> {
    const { first, after, filter, orderBy, workspaceId } = params;

    // Build where clause
    const where = this.buildWhereClause(filter, workspaceId);

    // Decode cursor
    const cursor = after ? this.decodeCursor(after) : null;

    // Fetch data
    const contacts = await this.prisma.contact.findMany({
      where,
      take: first + 1, // Fetch one extra to check hasNextPage
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: this.buildOrderBy(orderBy),
      include: {
        company: true,
      },
    });

    // Build connection
    const hasNextPage = contacts.length > first;
    const edges = contacts.slice(0, first).map(contact => ({
      node: contact,
      cursor: this.encodeCursor(contact.id),
    }));

    return {
      edges,
      pageInfo: {
        hasNextPage,
        hasPreviousPage: !!after,
        startCursor: edges[0]?.cursor,
        endCursor: edges[edges.length - 1]?.cursor,
      },
      totalCount: await this.prisma.contact.count({ where }),
    };
  }

  async create(data: CreateContactData): Promise<Contact> {
    const contact = await this.prisma.contact.create({
      data: {
        ...data,
        score: 0,
        source: data.source || 'MANUAL',
        status: 'ACTIVE',
      },
      include: {
        company: true,
      },
    });

    // Index in search
    await this.search.indexContact(contact);

    // Trigger enrichment if email provided
    if (contact.email) {
      await this.enrichment.enrichContact(contact.id);
    }

    // Clear cache
    await this.cache.invalidatePattern(`contacts:${data.workspaceId}:*`);

    return contact;
  }

  private buildWhereClause(
    filter: ContactFilter | undefined,
    workspaceId: string,
  ): any {
    const where: any = {
      workspaceId,
      deletedAt: null,
    };

    if (!filter) return where;

    if (filter.search) {
      where.OR = [
        { firstName: { contains: filter.search, mode: 'insensitive' } },
        { lastName: { contains: filter.search, mode: 'insensitive' } },
        { email: { contains: filter.search, mode: 'insensitive' } },
        { company: { name: { contains: filter.search, mode: 'insensitive' } } },
      ];
    }

    if (filter.status) {
      where.status = filter.status;
    }

    if (filter.source) {
      where.source = filter.source;
    }

    if (filter.companyId) {
      where.companyId = filter.companyId;
    }

    if (filter.tags?.length) {
      where.tags = {
        some: {
          tagId: { in: filter.tags },
        },
      };
    }

    if (filter.createdAfter) {
      where.createdAt = { gte: filter.createdAfter };
    }

    if (filter.createdBefore) {
      where.createdAt = { ...where.createdAt, lte: filter.createdBefore };
    }

    return where;
  }

  private buildOrderBy(orderBy?: ContactOrderBy): any {
    if (!orderBy) {
      return { createdAt: 'desc' };
    }

    const { field, direction } = orderBy;
    
    switch (field) {
      case 'NAME':
        return [
          { firstName: direction.toLowerCase() },
          { lastName: direction.toLowerCase() },
        ];
      case 'EMAIL':
        return { email: direction.toLowerCase() };
      case 'CREATED_AT':
        return { createdAt: direction.toLowerCase() };
      case 'UPDATED_AT':
        return { updatedAt: direction.toLowerCase() };
      case 'LAST_ACTIVITY':
        return { lastActivityAt: direction.toLowerCase() };
      default:
        return { createdAt: 'desc' };
    }
  }

  private encodeCursor(id: string): string {
    return Buffer.from(id).toString('base64');
  }

  private decodeCursor(cursor: string): string {
    return Buffer.from(cursor, 'base64').toString('utf-8');
  }
}
```

## Advanced Patterns

### DataLoader Integration
```typescript
// contacts/contact.loader.ts
import DataLoader from 'dataloader';
import { Injectable, Scope } from '@nestjs/common';
import { Contact } from './entities/contact.entity';

@Injectable({ scope: Scope.REQUEST })
export class ContactLoader {
  private readonly loader: DataLoader<string, Contact>;

  constructor(private readonly contactsService: ContactsService) {
    this.loader = new DataLoader<string, Contact>(
      async (ids: string[]) => {
        const contacts = await this.contactsService.findByIds(ids);
        const contactMap = new Map(contacts.map(c => [c.id, c]));
        return ids.map(id => contactMap.get(id) || null);
      },
      { cache: true },
    );
  }

  async load(id: string): Promise<Contact> {
    return this.loader.load(id);
  }

  async loadMany(ids: string[]): Promise<Contact[]> {
    return this.loader.loadMany(ids);
  }
}
```

### Field Middleware
```typescript
// Optimize N+1 queries
@ResolveField(() => Company, { 
  nullable: true,
  middleware: [DataLoaderMiddleware],
})
async company(
  @Parent() contact: Contact,
  @Context('companyLoader') companyLoader: CompanyLoader,
): Promise<Company | null> {
  if (!contact.companyId) return null;
  return companyLoader.load(contact.companyId);
}
```

### Complex Filtering
```typescript
// Complex filter with AND/OR logic
input ContactFilter {
  AND: [ContactFilter!]
  OR: [ContactFilter!]
  search: String
  status: ContactStatus
  source: ContactSource
  companyId: ID
  tags: [ID!]
  scoreRange: IntRange
  createdAfter: DateTime
  createdBefore: DateTime
  hasEmail: Boolean
  hasPhone: Boolean
  customFields: [CustomFieldFilter!]
}

input CustomFieldFilter {
  fieldId: ID!
  operator: FilterOperator!
  value: String!
}

enum FilterOperator {
  EQ
  NEQ
  GT
  GTE
  LT
  LTE
  CONTAINS
  NOT_CONTAINS
  IN
  NOT_IN
  IS_NULL
  IS_NOT_NULL
}
```

### Error Handling
```typescript
// Custom GraphQL errors
import { GraphQLError } from 'graphql';

export class ValidationError extends GraphQLError {
  constructor(message: string, field?: string) {
    super(message, {
      extensions: {
        code: 'VALIDATION_ERROR',
        field,
      },
    });
  }
}

export class NotFoundError extends GraphQLError {
  constructor(entity: string, id: string) {
    super(`${entity} with id ${id} not found`, {
      extensions: {
        code: 'NOT_FOUND',
        entity,
        id,
      },
    });
  }
}

export class ForbiddenError extends GraphQLError {
  constructor(message = 'You do not have permission to perform this action') {
    super(message, {
      extensions: {
        code: 'FORBIDDEN',
      },
    });
  }
}
```

## Performance Optimization

### Query Complexity
```typescript
// Limit query complexity
import { GraphQLSchemaHost } from '@nestjs/graphql';
import { fieldExtensionsEstimator, simpleEstimator } from 'graphql-query-complexity';

@Injectable()
export class ComplexityPlugin implements GraphQLPlugin {
  constructor(private gqlSchemaHost: GraphQLSchemaHost) {}

  async serverWillStart() {
    const { schema } = this.gqlSchemaHost;
    
    return {
      async requestDidStart() {
        return {
          async willSendResponse(requestContext) {
            const complexity = getComplexity({
              schema,
              query: requestContext.request.query,
              variables: requestContext.request.variables,
              estimators: [
                fieldExtensionsEstimator(),
                simpleEstimator({ defaultComplexity: 1 }),
              ],
            });

            if (complexity > 1000) {
              throw new Error(`Query too complex: ${complexity}. Maximum allowed: 1000`);
            }
          },
        };
      },
    };
  }
}
```

### Caching Strategy
```typescript
// Response caching
@Query(() => ContactConnection)
@CacheControl({ maxAge: 60 }) // Cache for 60 seconds
async contacts(
  @Args() args: ContactsArgs,
  @Info() info: GraphQLResolveInfo,
): Promise<ContactConnection> {
  const cacheKey = this.buildCacheKey(args, info);
  
  return this.cache.remember(
    cacheKey,
    () => this.contactsService.findAll(args),
    60,
  );
}
```

## Testing Resolvers

### Unit Testing
```typescript
// contacts.resolver.spec.ts
describe('ContactsResolver', () => {
  let resolver: ContactsResolver;
  let service: ContactsService;
  let pubsub: PubSubService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContactsResolver,
        {
          provide: ContactsService,
          useValue: createMock<ContactsService>(),
        },
        {
          provide: PubSubService,
          useValue: createMock<PubSubService>(),
        },
      ],
    }).compile();

    resolver = module.get<ContactsResolver>(ContactsResolver);
    service = module.get<ContactsService>(ContactsService);
    pubsub = module.get<PubSubService>(PubSubService);
  });

  describe('contacts query', () => {
    it('should return paginated contacts', async () => {
      const mockConnection = {
        edges: [{ node: { id: '1' }, cursor: 'cursor1' }],
        pageInfo: {
          hasNextPage: false,
          hasPreviousPage: false,
          startCursor: 'cursor1',
          endCursor: 'cursor1',
        },
        totalCount: 1,
      };

      jest.spyOn(service, 'findAll').mockResolvedValue(mockConnection);

      const result = await resolver.contacts(10, null, null, null, 'workspace1');

      expect(result).toEqual(mockConnection);
      expect(service.findAll).toHaveBeenCalledWith({
        first: 10,
        after: null,
        filter: null,
        orderBy: null,
        workspaceId: 'workspace1',
      });
    });
  });
});
```

### Integration Testing
```typescript
// contacts.e2e-spec.ts
describe('Contacts GraphQL', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('should create a contact', async () => {
    const mutation = `
      mutation CreateContact($input: CreateContactInput!) {
        createContact(input: $input) {
          contact {
            id
            fullName
            email
          }
          errors {
            field
            message
          }
        }
      }
    `;

    const variables = {
      input: {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@haste.nyc',
      },
    };

    const response = await request(app.getHttpServer())
      .post('/graphql')
      .send({ query: mutation, variables })
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body.data.createContact.contact).toMatchObject({
      fullName: 'John Doe',
      email: 'john.doe@haste.nyc',
    });
    expect(response.body.data.createContact.errors).toHaveLength(0);
  });
});
```