# Integration Testing Guide

## Table of Contents
1. [Overview](#overview)
2. [Test Environment Setup](#test-environment-setup)
3. [API Integration Tests](#api-integration-tests)
4. [Database Integration Tests](#database-integration-tests)
5. [GraphQL Integration Tests](#graphql-integration-tests)
6. [Authentication & Authorization Tests](#authentication--authorization-tests)
7. [External Service Integration Tests](#external-service-integration-tests)
8. [WebSocket Integration Tests](#websocket-integration-tests)
9. [Queue Integration Tests](#queue-integration-tests)
10. [End-to-End Workflow Tests](#end-to-end-workflow-tests)

## Overview

This guide provides comprehensive integration test examples for hasteCRM, ensuring all components work together correctly.

## Test Environment Setup

### Test Configuration

```typescript
// test/config/test-config.ts
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@/prisma/prisma.service';
import { RedisService } from '@/redis/redis.service';
import * as Docker from 'dockerode';

export class TestEnvironment {
  private static instance: TestEnvironment;
  private docker: Docker;
  private containers: Map<string, Docker.Container> = new Map();
  
  private constructor() {
    this.docker = new Docker();
  }

  static getInstance(): TestEnvironment {
    if (!TestEnvironment.instance) {
      TestEnvironment.instance = new TestEnvironment();
    }
    return TestEnvironment.instance;
  }

  async setup() {
    console.log('🚀 Setting up test environment...');
    
    // Start PostgreSQL
    await this.startPostgres();
    
    // Start Redis
    await this.startRedis();
    
    // Start LocalStack for AWS services
    await this.startLocalStack();
    
    // Wait for services to be ready
    await this.waitForServices();
    
    console.log('✅ Test environment ready');
  }

  async teardown() {
    console.log('🧹 Cleaning up test environment...');
    
    // Stop all containers
    for (const [name, container] of this.containers) {
      await container.stop();
      await container.remove();
    }
    
    this.containers.clear();
    console.log('✅ Test environment cleaned up');
  }

  private async startPostgres() {
    const container = await this.docker.createContainer({
      Image: 'postgres:15-alpine',
      name: 'test-postgres',
      Env: [
        'POSTGRES_USER=test',
        'POSTGRES_PASSWORD=test',
        'POSTGRES_DB=hastecrm_test',
      ],
      HostConfig: {
        PortBindings: {
          '5432/tcp': [{ HostPort: '5433' }],
        },
      },
    });
    
    await container.start();
    this.containers.set('postgres', container);
  }

  private async startRedis() {
    const container = await this.docker.createContainer({
      Image: 'redis:7-alpine',
      name: 'test-redis',
      HostConfig: {
        PortBindings: {
          '6379/tcp': [{ HostPort: '6380' }],
        },
      },
    });
    
    await container.start();
    this.containers.set('redis', container);
  }

  private async startLocalStack() {
    const container = await this.docker.createContainer({
      Image: 'localstack/localstack:latest',
      name: 'test-localstack',
      Env: [
        'SERVICES=s3,ses,sqs',
        'DEFAULT_REGION=us-east-1',
        'DATA_DIR=/tmp/localstack/data',
      ],
      HostConfig: {
        PortBindings: {
          '4566/tcp': [{ HostPort: '4566' }],
        },
      },
    });
    
    await container.start();
    this.containers.set('localstack', container);
  }

  private async waitForServices() {
    // Wait for PostgreSQL
    await this.waitForPostgres();
    
    // Wait for Redis
    await this.waitForRedis();
    
    // Wait for LocalStack
    await this.waitForLocalStack();
  }

  private async waitForPostgres(maxAttempts = 30) {
    const { Client } = require('pg');
    const client = new Client({
      host: 'localhost',
      port: 5433,
      user: 'test',
      password: 'test',
      database: 'hastecrm_test',
    });

    for (let i = 0; i < maxAttempts; i++) {
      try {
        await client.connect();
        await client.end();
        return;
      } catch (error) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    throw new Error('PostgreSQL failed to start');
  }

  private async waitForRedis(maxAttempts = 30) {
    const redis = require('redis');
    const client = redis.createClient({
      url: 'redis://localhost:6380',
    });

    for (let i = 0; i < maxAttempts; i++) {
      try {
        await client.connect();
        await client.disconnect();
        return;
      } catch (error) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    throw new Error('Redis failed to start');
  }

  private async waitForLocalStack(maxAttempts = 30) {
    const axios = require('axios');
    
    for (let i = 0; i < maxAttempts; i++) {
      try {
        await axios.get('http://localhost:4566/_localstack/health');
        return;
      } catch (error) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    throw new Error('LocalStack failed to start');
  }

  getConnectionStrings() {
    return {
      DATABASE_URL: 'postgresql://test:test@localhost:5433/hastecrm_test',
      REDIS_URL: 'redis://localhost:6380',
      AWS_ENDPOINT: 'http://localhost:4566',
    };
  }
}
```

### Test Database Setup

```typescript
// test/helpers/database.helper.ts
import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export class DatabaseTestHelper {
  private prisma: PrismaClient;

  constructor(databaseUrl: string) {
    this.prisma = new PrismaClient({
      datasources: {
        db: {
          url: databaseUrl,
        },
      },
    });
  }

  async setup() {
    // Run migrations
    execSync('pnpm prisma migrate deploy', {
      env: {
        ...process.env,
        DATABASE_URL: this.prisma._dmmf.datamodel.datasources[0].url,
      },
    });

    // Seed test data
    await this.seedTestData();
  }

  async cleanup() {
    // Clean all tables
    const tables = await this.prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename NOT LIKE '_prisma%'
    `;

    for (const { tablename } of tables) {
      await this.prisma.$executeRawUnsafe(
        `TRUNCATE TABLE "${tablename}" CASCADE`
      );
    }
  }

  async teardown() {
    await this.prisma.$disconnect();
  }

  private async seedTestData() {
    // Create test workspace
    const workspace = await this.prisma.workspace.create({
      data: {
        id: 'test-workspace',
        name: 'Test Workspace',
        slug: 'test-workspace',
        settings: {},
      },
    });

    // Create test users
    const admin = await this.prisma.user.create({
      data: {
        id: 'test-admin',
        email: 'admin@test.com',
        firstName: 'Test',
        lastName: 'Admin',
        passwordHash: '$2b$10$test', // bcrypt hash of 'password'
        emailVerified: true,
        role: 'ADMIN',
      },
    });

    const user = await this.prisma.user.create({
      data: {
        id: 'test-user',
        email: 'user@test.com',
        firstName: 'Test',
        lastName: 'User',
        passwordHash: '$2b$10$test',
        emailVerified: true,
        role: 'USER',
      },
    });

    // Create workspace memberships
    await this.prisma.workspaceMember.createMany({
      data: [
        {
          userId: admin.id,
          workspaceId: workspace.id,
          role: 'ADMIN',
          status: 'ACTIVE',
        },
        {
          userId: user.id,
          workspaceId: workspace.id,
          role: 'MEMBER',
          status: 'ACTIVE',
        },
      ],
    });

    // Create test contacts
    await this.prisma.contact.createMany({
      data: [
        {
          id: 'test-contact-1',
          email: 'contact1@haste.nyc',
          firstName: 'John',
          lastName: 'Doe',
          workspaceId: workspace.id,
          createdById: user.id,
        },
        {
          id: 'test-contact-2',
          email: 'contact2@haste.nyc',
          firstName: 'Jane',
          lastName: 'Smith',
          workspaceId: workspace.id,
          createdById: user.id,
        },
      ],
    });
  }

  async createTestUser(data: Partial<any> = {}) {
    return this.prisma.user.create({
      data: {
        email: `test-${Date.now()}@haste.nyc`,
        firstName: 'Test',
        lastName: 'User',
        passwordHash: '$2b$10$test',
        emailVerified: true,
        ...data,
      },
    });
  }

  async createTestWorkspace(data: Partial<any> = {}) {
    return this.prisma.workspace.create({
      data: {
        name: `Test Workspace ${Date.now()}`,
        slug: `test-workspace-${Date.now()}`,
        ...data,
      },
    });
  }

  getPrismaClient() {
    return this.prisma;
  }
}
```

## API Integration Tests

### REST API Integration Tests

```typescript
// test/integration/api/contacts.integration.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '@/app.module';
import { DatabaseTestHelper } from '../../helpers/database.helper';
import { AuthHelper } from '../../helpers/auth.helper';

describe('Contacts API Integration', () => {
  let app: INestApplication;
  let dbHelper: DatabaseTestHelper;
  let authHelper: AuthHelper;
  let authToken: string;
  let workspaceId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dbHelper = new DatabaseTestHelper(process.env.DATABASE_URL);
    await dbHelper.setup();

    authHelper = new AuthHelper(app);
    const authResult = await authHelper.loginAsUser();
    authToken = authResult.token;
    workspaceId = authResult.workspaceId;
  });

  afterAll(async () => {
    await dbHelper.cleanup();
    await dbHelper.teardown();
    await app.close();
  });

  describe('POST /api/contacts', () => {
    it('should create a new contact', async () => {
      const contactData = {
        email: 'newcontact@haste.nyc',
        firstName: 'New',
        lastName: 'Contact',
        phone: '+1234567890',
        company: 'Test Company',
        tags: ['lead', 'priority'],
      };

      const response = await request(app.getHttpServer())
        .post('/api/contacts')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Workspace-ID', workspaceId)
        .send(contactData)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: expect.any(String),
          email: contactData.email,
          firstName: contactData.firstName,
          lastName: contactData.lastName,
          tags: expect.arrayContaining(contactData.tags),
        },
      });

      // Verify in database
      const prisma = dbHelper.getPrismaClient();
      const contact = await prisma.contact.findUnique({
        where: { id: response.body.data.id },
      });

      expect(contact).toBeTruthy();
      expect(contact.email).toBe(contactData.email);
    });

    it('should prevent duplicate email in same workspace', async () => {
      const contactData = {
        email: 'duplicate@haste.nyc',
        firstName: 'Test',
        lastName: 'User',
      };

      // Create first contact
      await request(app.getHttpServer())
        .post('/api/contacts')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Workspace-ID', workspaceId)
        .send(contactData)
        .expect(201);

      // Try to create duplicate
      const response = await request(app.getHttpServer())
        .post('/api/contacts')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Workspace-ID', workspaceId)
        .send(contactData)
        .expect(409);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'CONFLICT',
          message: expect.stringContaining('already exists'),
        },
      });
    });

    it('should validate required fields', async () => {
      const invalidData = {
        firstName: 'Test', // Missing required email
      };

      const response = await request(app.getHttpServer())
        .post('/api/contacts')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Workspace-ID', workspaceId)
        .send(invalidData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          details: expect.arrayContaining([
            expect.objectContaining({
              field: 'email',
              message: expect.any(String),
            }),
          ]),
        },
      });
    });
  });

  describe('GET /api/contacts', () => {
    beforeEach(async () => {
      // Create test contacts
      const prisma = dbHelper.getPrismaClient();
      await prisma.contact.createMany({
        data: Array.from({ length: 25 }, (_, i) => ({
          email: `test${i}@haste.nyc`,
          firstName: `Test${i}`,
          lastName: 'User',
          workspaceId,
          createdById: 'test-user',
        })),
      });
    });

    it('should list contacts with pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/contacts')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Workspace-ID', workspaceId)
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            email: expect.any(String),
            firstName: expect.any(String),
          }),
        ]),
        meta: {
          total: expect.any(Number),
          page: 1,
          limit: 10,
          totalPages: expect.any(Number),
        },
      });

      expect(response.body.data).toHaveLength(10);
      expect(response.body.meta.total).toBeGreaterThanOrEqual(25);
    });

    it('should filter contacts by search query', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/contacts')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Workspace-ID', workspaceId)
        .query({ search: 'test10@haste.nyc' })
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].email).toBe('test10@haste.nyc');
    });

    it('should sort contacts', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/contacts')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Workspace-ID', workspaceId)
        .query({ sortBy: 'email', sortOrder: 'asc' })
        .expect(200);

      const emails = response.body.data.map(c => c.email);
      const sortedEmails = [...emails].sort();
      expect(emails).toEqual(sortedEmails);
    });
  });

  describe('PUT /api/contacts/:id', () => {
    let contactId: string;

    beforeEach(async () => {
      const contact = await dbHelper.getPrismaClient().contact.create({
        data: {
          email: 'update-test@haste.nyc',
          firstName: 'Update',
          lastName: 'Test',
          workspaceId,
          createdById: 'test-user',
        },
      });
      contactId = contact.id;
    });

    it('should update contact details', async () => {
      const updateData = {
        firstName: 'Updated',
        lastName: 'Name',
        phone: '+9876543210',
        company: 'New Company',
      };

      const response = await request(app.getHttpServer())
        .put(`/api/contacts/${contactId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Workspace-ID', workspaceId)
        .send(updateData)
        .expect(200);

      expect(response.body.data).toMatchObject(updateData);

      // Verify in database
      const updated = await dbHelper.getPrismaClient().contact.findUnique({
        where: { id: contactId },
      });

      expect(updated.firstName).toBe(updateData.firstName);
      expect(updated.company).toBe(updateData.company);
    });

    it('should track update history', async () => {
      const updateData = { firstName: 'Tracked' };

      await request(app.getHttpServer())
        .put(`/api/contacts/${contactId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Workspace-ID', workspaceId)
        .send(updateData)
        .expect(200);

      // Check activity log
      const activities = await dbHelper.getPrismaClient().activity.findMany({
        where: {
          entityId: contactId,
          entityType: 'CONTACT',
          type: 'UPDATED',
        },
      });

      expect(activities).toHaveLength(1);
      expect(activities[0].metadata).toMatchObject({
        changes: {
          firstName: {
            old: 'Update',
            new: 'Tracked',
          },
        },
      });
    });
  });

  describe('DELETE /api/contacts/:id', () => {
    it('should soft delete contact', async () => {
      const contact = await dbHelper.getPrismaClient().contact.create({
        data: {
          email: 'delete-test@haste.nyc',
          firstName: 'Delete',
          lastName: 'Test',
          workspaceId,
          createdById: 'test-user',
        },
      });

      await request(app.getHttpServer())
        .delete(`/api/contacts/${contact.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Workspace-ID', workspaceId)
        .expect(200);

      // Verify soft delete
      const deleted = await dbHelper.getPrismaClient().contact.findUnique({
        where: { id: contact.id },
      });

      expect(deleted.deletedAt).toBeTruthy();
    });

    it('should require proper permissions', async () => {
      // Login as user without delete permissions
      const limitedAuth = await authHelper.loginAsUser({ role: 'VIEWER' });

      await request(app.getHttpServer())
        .delete('/api/contacts/some-id')
        .set('Authorization', `Bearer ${limitedAuth.token}`)
        .set('X-Workspace-ID', workspaceId)
        .expect(403);
    });
  });

  describe('Bulk Operations', () => {
    it('should bulk import contacts', async () => {
      const contacts = Array.from({ length: 100 }, (_, i) => ({
        email: `bulk${i}@haste.nyc`,
        firstName: `Bulk${i}`,
        lastName: 'Import',
        company: i % 2 === 0 ? 'Company A' : 'Company B',
      }));

      const response = await request(app.getHttpServer())
        .post('/api/contacts/bulk-import')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Workspace-ID', workspaceId)
        .send({ contacts })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          imported: 100,
          failed: 0,
          errors: [],
        },
      });

      // Verify in database
      const count = await dbHelper.getPrismaClient().contact.count({
        where: {
          workspaceId,
          email: { startsWith: 'bulk' },
        },
      });

      expect(count).toBe(100);
    });

    it('should handle partial failures in bulk import', async () => {
      const contacts = [
        { email: 'valid@haste.nyc', firstName: 'Valid' },
        { email: 'invalid-email', firstName: 'Invalid' }, // Invalid email
        { email: 'valid2@haste.nyc', firstName: 'Valid2' },
      ];

      const response = await request(app.getHttpServer())
        .post('/api/contacts/bulk-import')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Workspace-ID', workspaceId)
        .send({ contacts })
        .expect(200);

      expect(response.body.data).toMatchObject({
        imported: 2,
        failed: 1,
        errors: expect.arrayContaining([
          expect.objectContaining({
            row: 2,
            email: 'invalid-email',
            error: expect.any(String),
          }),
        ]),
      });
    });
  });
});
```

## Database Integration Tests

### Transaction Tests

```typescript
// test/integration/database/transactions.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@/prisma/prisma.service';
import { DatabaseTestHelper } from '../../helpers/database.helper';

describe('Database Transactions', () => {
  let prisma: PrismaService;
  let dbHelper: DatabaseTestHelper;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();

    prisma = module.get<PrismaService>(PrismaService);
    dbHelper = new DatabaseTestHelper(process.env.DATABASE_URL);
    await dbHelper.setup();
  });

  afterAll(async () => {
    await dbHelper.cleanup();
    await dbHelper.teardown();
  });

  describe('Workspace creation with related entities', () => {
    it('should create workspace with all related entities in transaction', async () => {
      const workspaceData = {
        name: 'Transaction Test Workspace',
        slug: 'transaction-test',
        ownerId: 'test-user',
      };

      const result = await prisma.$transaction(async (tx) => {
        // Create workspace
        const workspace = await tx.workspace.create({
          data: workspaceData,
        });

        // Create default pipeline
        const pipeline = await tx.pipeline.create({
          data: {
            workspaceId: workspace.id,
            name: 'Sales Pipeline',
            stages: {
              create: [
                { name: 'Lead', order: 0, color: '#3B82F6' },
                { name: 'Qualified', order: 1, color: '#10B981' },
                { name: 'Proposal', order: 2, color: '#F59E0B' },
                { name: 'Closed', order: 3, color: '#22C55E' },
              ],
            },
          },
        });

        // Create default tags
        const tags = await tx.tag.createMany({
          data: [
            { workspaceId: workspace.id, name: 'Hot Lead', color: '#EF4444' },
            { workspaceId: workspace.id, name: 'Customer', color: '#22C55E' },
            { workspaceId: workspace.id, name: 'Partner', color: '#3B82F6' },
          ],
        });

        // Create workspace settings
        const settings = await tx.workspaceSettings.create({
          data: {
            workspaceId: workspace.id,
            emailBranding: true,
            autoAssignLeads: false,
            leadScoringEnabled: true,
          },
        });

        return { workspace, pipeline, tags, settings };
      });

      expect(result.workspace.id).toBeTruthy();
      expect(result.pipeline.id).toBeTruthy();
      expect(result.tags.count).toBe(3);
      expect(result.settings.id).toBeTruthy();

      // Verify all created
      const workspace = await prisma.workspace.findUnique({
        where: { id: result.workspace.id },
        include: {
          pipelines: true,
          tags: true,
          settings: true,
        },
      });

      expect(workspace.pipelines).toHaveLength(1);
      expect(workspace.tags).toHaveLength(3);
      expect(workspace.settings).toBeTruthy();
    });

    it('should rollback transaction on failure', async () => {
      const workspaceId = 'rollback-test-workspace';

      try {
        await prisma.$transaction(async (tx) => {
          // Create workspace
          await tx.workspace.create({
            data: {
              id: workspaceId,
              name: 'Rollback Test',
              slug: 'rollback-test',
            },
          });

          // This should fail due to missing required field
          await tx.pipeline.create({
            data: {
              workspaceId: workspaceId,
              // Missing required 'name' field
            } as any,
          });
        });
      } catch (error) {
        // Expected to fail
      }

      // Verify workspace was not created
      const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
      });

      expect(workspace).toBeNull();
    });
  });

  describe('Concurrent operations', () => {
    it('should handle concurrent updates with optimistic locking', async () => {
      // Create test contact
      const contact = await prisma.contact.create({
        data: {
          email: 'concurrent@haste.nyc',
          firstName: 'Concurrent',
          lastName: 'Test',
          workspaceId: 'test-workspace',
          createdById: 'test-user',
          version: 0, // Version for optimistic locking
        },
      });

      // Simulate concurrent updates
      const update1 = prisma.contact.update({
        where: { 
          id: contact.id,
          version: 0, // Expected version
        },
        data: {
          firstName: 'Update1',
          version: { increment: 1 },
        },
      });

      const update2 = prisma.contact.update({
        where: { 
          id: contact.id,
          version: 0, // Same expected version
        },
        data: {
          firstName: 'Update2',
          version: { increment: 1 },
        },
      });

      // Execute concurrently
      const results = await Promise.allSettled([update1, update2]);

      // One should succeed, one should fail
      const succeeded = results.filter(r => r.status === 'fulfilled');
      const failed = results.filter(r => r.status === 'rejected');

      expect(succeeded).toHaveLength(1);
      expect(failed).toHaveLength(1);

      // Verify final state
      const final = await prisma.contact.findUnique({
        where: { id: contact.id },
      });

      expect(final.version).toBe(1);
      expect(['Update1', 'Update2']).toContain(final.firstName);
    });
  });

  describe('Database constraints', () => {
    it('should enforce unique constraints', async () => {
      const email = 'unique@haste.nyc';

      // Create first contact
      await prisma.contact.create({
        data: {
          email,
          firstName: 'First',
          lastName: 'User',
          workspaceId: 'test-workspace',
          createdById: 'test-user',
        },
      });

      // Try to create duplicate in same workspace
      await expect(
        prisma.contact.create({
          data: {
            email,
            firstName: 'Second',
            lastName: 'User',
            workspaceId: 'test-workspace',
            createdById: 'test-user',
          },
        })
      ).rejects.toThrow();

      // Should succeed in different workspace
      const differentWorkspace = await prisma.contact.create({
        data: {
          email,
          firstName: 'Third',
          lastName: 'User',
          workspaceId: 'other-workspace',
          createdById: 'test-user',
        },
      });

      expect(differentWorkspace.id).toBeTruthy();
    });

    it('should cascade deletes properly', async () => {
      // Create contact with related data
      const contact = await prisma.contact.create({
        data: {
          email: 'cascade@haste.nyc',
          firstName: 'Cascade',
          lastName: 'Test',
          workspaceId: 'test-workspace',
          createdById: 'test-user',
          activities: {
            create: [
              { type: 'NOTE', content: 'Test note', userId: 'test-user' },
              { type: 'CALL', content: 'Test call', userId: 'test-user' },
            ],
          },
          emails: {
            create: [
              {
                messageId: 'test-email-1',
                subject: 'Test Email',
                from: 'sender@haste.nyc',
                to: ['cascade@haste.nyc'],
                content: 'Test content',
              },
            ],
          },
        },
      });

      // Verify related data exists
      const activities = await prisma.activity.count({
        where: { entityId: contact.id },
      });
      const emails = await prisma.email.count({
        where: { contactId: contact.id },
      });

      expect(activities).toBe(2);
      expect(emails).toBe(1);

      // Delete contact
      await prisma.contact.delete({
        where: { id: contact.id },
      });

      // Verify cascade delete
      const activitiesAfter = await prisma.activity.count({
        where: { entityId: contact.id },
      });
      const emailsAfter = await prisma.email.count({
        where: { contactId: contact.id },
      });

      expect(activitiesAfter).toBe(0);
      expect(emailsAfter).toBe(0);
    });
  });
});
```

## GraphQL Integration Tests

### GraphQL Testing Setup

```typescript
// test/integration/graphql/graphql-test.helper.ts
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';

export class GraphQLTestHelper {
  constructor(private app: INestApplication) {}

  async query(
    query: string,
    variables?: Record<string, any>,
    headers?: Record<string, string>
  ) {
    const req = request(this.app.getHttpServer())
      .post('/graphql')
      .send({ query, variables });

    if (headers) {
      Object.entries(headers).forEach(([key, value]) => {
        req.set(key, value);
      });
    }

    const response = await req;
    return response.body;
  }

  async mutate(
    mutation: string,
    variables?: Record<string, any>,
    headers?: Record<string, string>
  ) {
    return this.query(mutation, variables, headers);
  }

  expectNoErrors(response: any) {
    expect(response.errors).toBeUndefined();
  }

  expectError(response: any, message?: string) {
    expect(response.errors).toBeDefined();
    expect(response.errors.length).toBeGreaterThan(0);
    
    if (message) {
      expect(response.errors[0].message).toContain(message);
    }
  }
}
```

### GraphQL Mutation Tests

```typescript
// test/integration/graphql/mutations.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '@/app.module';
import { GraphQLTestHelper } from './graphql-test.helper';
import { DatabaseTestHelper } from '../../helpers/database.helper';
import { AuthHelper } from '../../helpers/auth.helper';

describe('GraphQL Mutations', () => {
  let app: INestApplication;
  let graphqlHelper: GraphQLTestHelper;
  let dbHelper: DatabaseTestHelper;
  let authHelper: AuthHelper;
  let authToken: string;
  let workspaceId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    graphqlHelper = new GraphQLTestHelper(app);
    dbHelper = new DatabaseTestHelper(process.env.DATABASE_URL);
    await dbHelper.setup();

    authHelper = new AuthHelper(app);
    const auth = await authHelper.loginAsUser();
    authToken = auth.token;
    workspaceId = auth.workspaceId;
  });

  afterAll(async () => {
    await dbHelper.cleanup();
    await dbHelper.teardown();
    await app.close();
  });

  describe('createContact mutation', () => {
    it('should create contact with nested company', async () => {
      const mutation = `
        mutation CreateContact($input: CreateContactInput!) {
          createContact(input: $input) {
            id
            email
            firstName
            lastName
            company {
              id
              name
              domain
            }
          }
        }
      `;

      const variables = {
        input: {
          email: 'graphql@haste.nyc',
          firstName: 'GraphQL',
          lastName: 'Test',
          company: {
            name: 'GraphQL Corp',
            domain: 'graphql.com',
          },
        },
      };

      const response = await graphqlHelper.mutate(mutation, variables, {
        Authorization: `Bearer ${authToken}`,
        'X-Workspace-ID': workspaceId,
      });

      graphqlHelper.expectNoErrors(response);
      expect(response.data.createContact).toMatchObject({
        id: expect.any(String),
        email: 'graphql@haste.nyc',
        company: {
          id: expect.any(String),
          name: 'GraphQL Corp',
          domain: 'graphql.com',
        },
      });

      // Verify company was created
      const company = await dbHelper.getPrismaClient().company.findUnique({
        where: { id: response.data.createContact.company.id },
      });
      expect(company).toBeTruthy();
    });

    it('should handle validation errors', async () => {
      const mutation = `
        mutation CreateContact($input: CreateContactInput!) {
          createContact(input: $input) {
            id
          }
        }
      `;

      const variables = {
        input: {
          email: 'invalid-email', // Invalid email format
          firstName: 'Test',
        },
      };

      const response = await graphqlHelper.mutate(mutation, variables, {
        Authorization: `Bearer ${authToken}`,
        'X-Workspace-ID': workspaceId,
      });

      graphqlHelper.expectError(response, 'Validation failed');
      expect(response.errors[0].extensions.code).toBe('BAD_USER_INPUT');
    });
  });

  describe('updateContact mutation', () => {
    let contactId: string;

    beforeEach(async () => {
      const contact = await dbHelper.getPrismaClient().contact.create({
        data: {
          email: 'update@haste.nyc',
          firstName: 'Update',
          lastName: 'Test',
          workspaceId,
          createdById: 'test-user',
        },
      });
      contactId = contact.id;
    });

    it('should update contact with optimistic locking', async () => {
      const mutation = `
        mutation UpdateContact($id: ID!, $input: UpdateContactInput!) {
          updateContact(id: $id, input: $input) {
            id
            firstName
            lastName
            version
          }
        }
      `;

      const variables = {
        id: contactId,
        input: {
          firstName: 'Updated',
          lastName: 'Name',
          version: 0, // Current version
        },
      };

      const response = await graphqlHelper.mutate(mutation, variables, {
        Authorization: `Bearer ${authToken}`,
        'X-Workspace-ID': workspaceId,
      });

      graphqlHelper.expectNoErrors(response);
      expect(response.data.updateContact).toMatchObject({
        firstName: 'Updated',
        lastName: 'Name',
        version: 1,
      });
    });

    it('should fail with outdated version', async () => {
      // First update
      await dbHelper.getPrismaClient().contact.update({
        where: { id: contactId },
        data: { version: { increment: 1 } },
      });

      const mutation = `
        mutation UpdateContact($id: ID!, $input: UpdateContactInput!) {
          updateContact(id: $id, input: $input) {
            id
          }
        }
      `;

      const variables = {
        id: contactId,
        input: {
          firstName: 'Should Fail',
          version: 0, // Outdated version
        },
      };

      const response = await graphqlHelper.mutate(mutation, variables, {
        Authorization: `Bearer ${authToken}`,
        'X-Workspace-ID': workspaceId,
      });

      graphqlHelper.expectError(response, 'version mismatch');
    });
  });

  describe('Complex mutations', () => {
    it('should create deal with all relationships', async () => {
      const mutation = `
        mutation CreateDeal($input: CreateDealInput!) {
          createDeal(input: $input) {
            id
            title
            value
            stage {
              id
              name
            }
            contact {
              id
              email
            }
            activities {
              id
              type
              content
            }
          }
        }
      `;

      // Create pipeline and stage first
      const pipeline = await dbHelper.getPrismaClient().pipeline.create({
        data: {
          workspaceId,
          name: 'Test Pipeline',
          stages: {
            create: {
              id: 'test-stage',
              name: 'Negotiation',
              order: 0,
            },
          },
        },
      });

      const variables = {
        input: {
          title: 'Big Deal',
          value: 50000,
          stageId: 'test-stage',
          contactId: 'test-contact-1',
          expectedCloseDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          activities: [
            {
              type: 'NOTE',
              content: 'Initial discussion completed',
            },
            {
              type: 'TASK',
              content: 'Send proposal',
              dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            },
          ],
        },
      };

      const response = await graphqlHelper.mutate(mutation, variables, {
        Authorization: `Bearer ${authToken}`,
        'X-Workspace-ID': workspaceId,
      });

      graphqlHelper.expectNoErrors(response);
      expect(response.data.createDeal).toMatchObject({
        title: 'Big Deal',
        value: 50000,
        stage: {
          name: 'Negotiation',
        },
        contact: {
          id: 'test-contact-1',
        },
        activities: expect.arrayContaining([
          expect.objectContaining({ type: 'NOTE' }),
          expect.objectContaining({ type: 'TASK' }),
        ]),
      });
    });
  });
});
```

### GraphQL Query Tests

```typescript
// test/integration/graphql/queries.spec.ts
describe('GraphQL Queries', () => {
  describe('contacts query with filters', () => {
    beforeEach(async () => {
      // Create test data
      const contacts = [
        {
          email: 'john@company-a.com',
          firstName: 'John',
          lastName: 'Doe',
          tags: ['customer', 'vip'],
          score: 85,
          lastActivityAt: new Date('2024-01-01'),
        },
        {
          email: 'jane@company-b.com',
          firstName: 'Jane',
          lastName: 'Smith',
          tags: ['lead'],
          score: 65,
          lastActivityAt: new Date('2024-01-15'),
        },
        {
          email: 'bob@company-a.com',
          firstName: 'Bob',
          lastName: 'Johnson',
          tags: ['customer'],
          score: 70,
          lastActivityAt: new Date('2024-01-10'),
        },
      ];

      for (const contact of contacts) {
        await dbHelper.getPrismaClient().contact.create({
          data: {
            ...contact,
            workspaceId,
            createdById: 'test-user',
          },
        });
      }
    });

    it('should filter by tags', async () => {
      const query = `
        query GetContacts($filter: ContactFilterInput) {
          contacts(filter: $filter) {
            edges {
              node {
                id
                email
                tags
              }
            }
            totalCount
          }
        }
      `;

      const response = await graphqlHelper.query(
        query,
        {
          filter: {
            tags: ['customer'],
          },
        },
        {
          Authorization: `Bearer ${authToken}`,
          'X-Workspace-ID': workspaceId,
        }
      );

      graphqlHelper.expectNoErrors(response);
      expect(response.data.contacts.totalCount).toBe(2);
      expect(response.data.contacts.edges).toHaveLength(2);
      
      response.data.contacts.edges.forEach(edge => {
        expect(edge.node.tags).toContain('customer');
      });
    });

    it('should filter by score range', async () => {
      const query = `
        query GetContacts($filter: ContactFilterInput) {
          contacts(filter: $filter) {
            edges {
              node {
                email
                score
              }
            }
          }
        }
      `;

      const response = await graphqlHelper.query(
        query,
        {
          filter: {
            scoreMin: 70,
            scoreMax: 90,
          },
        },
        {
          Authorization: `Bearer ${authToken}`,
          'X-Workspace-ID': workspaceId,
        }
      );

      graphqlHelper.expectNoErrors(response);
      expect(response.data.contacts.edges).toHaveLength(2);
      
      response.data.contacts.edges.forEach(edge => {
        expect(edge.node.score).toBeGreaterThanOrEqual(70);
        expect(edge.node.score).toBeLessThanOrEqual(90);
      });
    });

    it('should support complex filters', async () => {
      const query = `
        query GetContacts($filter: ContactFilterInput, $sort: ContactSortInput) {
          contacts(filter: $filter, sort: $sort) {
            edges {
              node {
                email
                firstName
                lastName
                score
                lastActivityAt
              }
              cursor
            }
            pageInfo {
              hasNextPage
              hasPreviousPage
              startCursor
              endCursor
            }
          }
        }
      `;

      const response = await graphqlHelper.query(
        query,
        {
          filter: {
            OR: [
              { firstName: { contains: 'J' } },
              { score: { gte: 80 } },
            ],
            lastActivityAfter: '2024-01-05',
          },
          sort: {
            field: 'LAST_ACTIVITY',
            direction: 'DESC',
          },
        },
        {
          Authorization: `Bearer ${authToken}`,
          'X-Workspace-ID': workspaceId,
        }
      );

      graphqlHelper.expectNoErrors(response);
      expect(response.data.contacts.edges).toHaveLength(2);
      
      // Verify sorting
      const dates = response.data.contacts.edges.map(e => 
        new Date(e.node.lastActivityAt).getTime()
      );
      expect(dates[0]).toBeGreaterThanOrEqual(dates[1]);
    });
  });

  describe('Nested queries with DataLoader', () => {
    it('should efficiently load nested relationships', async () => {
      // Create test data with relationships
      const company = await dbHelper.getPrismaClient().company.create({
        data: {
          name: 'Test Company',
          domain: 'test.com',
          workspaceId,
        },
      });

      const contacts = await Promise.all(
        Array.from({ length: 5 }, (_, i) => 
          dbHelper.getPrismaClient().contact.create({
            data: {
              email: `employee${i}@test.com`,
              firstName: `Employee${i}`,
              lastName: 'Test',
              companyId: company.id,
              workspaceId,
              createdById: 'test-user',
              deals: {
                create: Array.from({ length: 3 }, (_, j) => ({
                  title: `Deal ${i}-${j}`,
                  value: (i + 1) * (j + 1) * 1000,
                  stageId: 'test-stage',
                  ownerId: 'test-user',
                })),
              },
            },
          })
        )
      );

      const query = `
        query GetCompanyWithContacts($id: ID!) {
          company(id: $id) {
            id
            name
            contacts {
              id
              email
              deals {
                id
                title
                value
              }
            }
          }
        }
      `;

      const response = await graphqlHelper.query(
        query,
        { id: company.id },
        {
          Authorization: `Bearer ${authToken}`,
          'X-Workspace-ID': workspaceId,
        }
      );

      graphqlHelper.expectNoErrors(response);
      expect(response.data.company.contacts).toHaveLength(5);
      
      response.data.company.contacts.forEach(contact => {
        expect(contact.deals).toHaveLength(3);
      });

      // Verify DataLoader worked (check query count in logs)
      // This should result in 3 queries total, not N+1
    });
  });
});
```

## Authentication & Authorization Tests

```typescript
// test/integration/auth/auth.integration.spec.ts
describe('Authentication & Authorization', () => {
  describe('JWT Authentication', () => {
    it('should authenticate with valid credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'admin@test.com',
          password: 'password',
        })
        .expect(200);

      expect(response.body).toMatchObject({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
        user: {
          id: expect.any(String),
          email: 'admin@test.com',
          role: 'ADMIN',
        },
      });

      // Verify JWT structure
      const decoded = jwt.decode(response.body.accessToken);
      expect(decoded).toMatchObject({
        sub: expect.any(String),
        email: 'admin@test.com',
        role: 'ADMIN',
        exp: expect.any(Number),
      });
    });

    it('should refresh access token', async () => {
      // Login first
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'user@test.com',
          password: 'password',
        })
        .expect(200);

      const refreshToken = loginResponse.body.refreshToken;

      // Wait a bit to ensure new token has different timestamp
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Refresh token
      const refreshResponse = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(refreshResponse.body).toMatchObject({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
      });

      // Tokens should be different
      expect(refreshResponse.body.accessToken).not.toBe(loginResponse.body.accessToken);
    });

    it('should reject expired tokens', async () => {
      // Create expired token
      const expiredToken = jwt.sign(
        { sub: 'test-user', email: 'test@haste.nyc' },
        process.env.JWT_SECRET,
        { expiresIn: '-1h' }
      );

      await request(app.getHttpServer())
        .get('/api/me')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);
    });
  });

  describe('Role-based authorization', () => {
    let adminToken: string;
    let userToken: string;
    let viewerToken: string;

    beforeAll(async () => {
      // Create users with different roles
      const admin = await authHelper.loginAsUser({ role: 'ADMIN' });
      const user = await authHelper.loginAsUser({ role: 'USER' });
      const viewer = await authHelper.loginAsUser({ role: 'VIEWER' });

      adminToken = admin.token;
      userToken = user.token;
      viewerToken = viewer.token;
    });

    it('should allow admin to access admin endpoints', async () => {
      await request(app.getHttpServer())
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('should deny non-admin access to admin endpoints', async () => {
      await request(app.getHttpServer())
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      await request(app.getHttpServer())
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(403);
    });

    it('should enforce write permissions', async () => {
      const contactData = { email: 'test@haste.nyc', firstName: 'Test' };

      // User can create
      await request(app.getHttpServer())
        .post('/api/contacts')
        .set('Authorization', `Bearer ${userToken}`)
        .set('X-Workspace-ID', workspaceId)
        .send(contactData)
        .expect(201);

      // Viewer cannot create
      await request(app.getHttpServer())
        .post('/api/contacts')
        .set('Authorization', `Bearer ${viewerToken}`)
        .set('X-Workspace-ID', workspaceId)
        .send({ ...contactData, email: 'viewer@haste.nyc' })
        .expect(403);
    });
  });

  describe('OAuth integration', () => {
    it('should handle Google OAuth callback', async () => {
      // Mock Google OAuth response
      const mockGoogleUser = {
        id: 'google-123',
        email: 'user@gmail.com',
        verified_email: true,
        name: 'Google User',
        given_name: 'Google',
        family_name: 'User',
        picture: 'https://haste.nyc/photo.jpg',
      };

      // Simulate OAuth callback
      const response = await request(app.getHttpServer())
        .get('/auth/google/callback')
        .query({
          code: 'mock-auth-code',
          state: 'mock-state',
        })
        .expect(302);

      // Should redirect with auth token
      expect(response.headers.location).toMatch(/token=[^&]+/);

      // Verify user was created/updated
      const user = await dbHelper.getPrismaClient().user.findUnique({
        where: { email: 'user@gmail.com' },
      });

      expect(user).toBeTruthy();
      expect(user.googleId).toBe('google-123');
      expect(user.emailVerified).toBe(true);
    });
  });
});
```

## External Service Integration Tests

### AI Service Integration Tests

```typescript
// test/integration/external/ai-service.integration.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { AIOrchestrator } from '@/ai/services/ai-orchestrator.service';
import { CacheService } from '@/cache/cache.service';
import { MetricsService } from '@/monitoring/metrics.service';
import nock from 'nock';

describe('AI Service Integration', () => {
  let orchestrator: AIOrchestrator;
  let cacheService: CacheService;
  let metricsService: MetricsService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AIOrchestrator, CacheService, MetricsService],
    }).compile();

    orchestrator = module.get<AIOrchestrator>(AIOrchestrator);
    cacheService = module.get<CacheService>(CacheService);
    metricsService = module.get<MetricsService>(MetricsService);
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe('Claude API integration', () => {
    it('should generate completion with Claude', async () => {
      // Mock Claude API
      nock('https://api.anthropic.com')
        .post('/v1/messages')
        .reply(200, {
          id: 'msg_123',
          type: 'message',
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: 'This is a test response from Claude.',
            },
          ],
          model: 'claude-3-opus-20240229',
          usage: {
            input_tokens: 10,
            output_tokens: 20,
          },
        });

      const response = await orchestrator.generateCompletion(
        'Test prompt',
        { preferredProviders: ['claude'] }
      );

      expect(response).toMatchObject({
        content: 'This is a test response from Claude.',
        provider: 'claude',
        usage: {
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30,
        },
      });

      // Verify metrics were recorded
      const metrics = await metricsService.getMetrics();
      expect(metrics.aiRequests).toBeGreaterThan(0);
    });

    it('should handle rate limiting and fallback', async () => {
      // Mock Claude rate limit
      nock('https://api.anthropic.com')
        .post('/v1/messages')
        .reply(429, {
          error: {
            type: 'rate_limit_error',
            message: 'Rate limit exceeded',
          },
        });

      // Mock OpenAI success
      nock('https://api.openai.com')
        .post('/v1/chat/completions')
        .reply(200, {
          id: 'chatcmpl-123',
          object: 'chat.completion',
          created: Date.now(),
          model: 'gpt-4',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: 'Fallback response from OpenAI',
              },
              finish_reason: 'stop',
            },
          ],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 15,
            total_tokens: 25,
          },
        });

      const response = await orchestrator.generateCompletion(
        'Test prompt',
        { preferredProviders: ['claude', 'openai'] }
      );

      expect(response.provider).toBe('openai');
      expect(response.content).toBe('Fallback response from OpenAI');
    });

    it('should cache responses', async () => {
      const cacheKey = 'test-prompt-hash';
      
      // Mock API response
      nock('https://api.anthropic.com')
        .post('/v1/messages')
        .reply(200, {
          content: [{ type: 'text', text: 'Cached response' }],
          usage: { input_tokens: 5, output_tokens: 10 },
        });

      // First request
      const response1 = await orchestrator.generateCompletion(
        'Test prompt',
        { cacheKey, preferredProviders: ['claude'] }
      );

      // Second request should hit cache
      const response2 = await orchestrator.generateCompletion(
        'Test prompt',
        { cacheKey, preferredProviders: ['claude'] }
      );

      expect(response1.content).toBe(response2.content);
      
      // Verify only one API call was made
      expect(nock.isDone()).toBe(true);
    });
  });

  describe('OpenAI Embeddings integration', () => {
    it('should generate embeddings', async () => {
      const mockEmbedding = Array(1536).fill(0).map(() => Math.random());
      
      nock('https://api.openai.com')
        .post('/v1/embeddings')
        .reply(200, {
          object: 'list',
          data: [
            {
              object: 'embedding',
              embedding: mockEmbedding,
              index: 0,
            },
          ],
          model: 'text-embedding-3-small',
          usage: {
            prompt_tokens: 8,
            total_tokens: 8,
          },
        });

      const embedding = await orchestrator.generateEmbedding(
        'Test text for embedding'
      );

      expect(embedding).toHaveLength(1536);
      expect(embedding[0]).toBeGreaterThanOrEqual(0);
      expect(embedding[0]).toBeLessThanOrEqual(1);
    });
  });

  describe('Perplexity search integration', () => {
    it('should perform search-enhanced completion', async () => {
      nock('https://api.perplexity.ai')
        .post('/chat/completions')
        .reply(200, {
          id: 'pplx-123',
          object: 'chat.completion',
          created: Date.now(),
          model: 'pplx-70b-online',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: 'Based on current search results...',
              },
              finish_reason: 'stop',
            },
          ],
          citations: [
            'https://haste.nyc/source1',
            'https://haste.nyc/source2',
          ],
        });

      const response = await orchestrator.searchWithAI(
        'Latest news about AI',
        { domains: ['techcrunch.com', 'theverge.com'] }
      );

      expect(response.provider).toBe('perplexity');
      expect(response.content).toContain('search results');
    });
  });
});
```

### Email Service Integration Tests

```typescript
// test/integration/external/email-service.integration.spec.ts
import { EmailService } from '@/email/email.service';
import { SendGridService } from '@/email/providers/sendgrid.service';
import nock from 'nock';

describe('Email Service Integration', () => {
  let emailService: EmailService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EmailService, SendGridService],
    }).compile();

    emailService = module.get<EmailService>(EmailService);
  });

  describe('SendGrid integration', () => {
    it('should send transactional email', async () => {
      nock('https://api.sendgrid.com')
        .post('/v3/mail/send')
        .reply(202, {
          message: 'Accepted',
          id: 'sendgrid-message-id',
        });

      const result = await emailService.sendEmail({
        to: 'recipient@haste.nyc',
        from: 'noreply@haste.nyc',
        subject: 'Test Email',
        html: '<p>Test content</p>',
        text: 'Test content',
        trackingSettings: {
          clickTracking: { enable: true },
          openTracking: { enable: true },
        },
      });

      expect(result).toMatchObject({
        success: true,
        messageId: 'sendgrid-message-id',
        provider: 'sendgrid',
      });
    });

    it('should handle bulk email sending', async () => {
      const recipients = Array.from({ length: 100 }, (_, i) => ({
        email: `recipient${i}@haste.nyc`,
        substitutions: {
          firstName: `User${i}`,
          companyName: `Company${i}`,
        },
      }));

      nock('https://api.sendgrid.com')
        .post('/v3/mail/send')
        .times(2) // SendGrid batch size is 50
        .reply(202, { message: 'Accepted' });

      const results = await emailService.sendBulkEmail({
        from: 'campaigns@haste.nyc',
        subject: 'Marketing Campaign',
        templateId: 'template-123',
        recipients,
      });

      expect(results).toHaveLength(100);
      expect(results.filter(r => r.success)).toHaveLength(100);
    });

    it('should handle email bounces webhook', async () => {
      const bounceData = {
        email: 'bounced@haste.nyc',
        event: 'bounce',
        reason: 'Invalid email address',
        timestamp: Date.now(),
      };

      await emailService.handleWebhook('sendgrid', bounceData);

      // Verify contact was marked as bounced
      const contact = await dbHelper.getPrismaClient().contact.findFirst({
        where: { email: 'bounced@haste.nyc' },
      });

      expect(contact.emailStatus).toBe('BOUNCED');
    });
  });
});
```

## WebSocket Integration Tests

```typescript
// test/integration/websocket/websocket.integration.spec.ts
import { io, Socket } from 'socket.io-client';
import { AuthHelper } from '../../helpers/auth.helper';

describe('WebSocket Integration', () => {
  let clientSocket: Socket;
  let authToken: string;
  const wsUrl = 'http://localhost:3001';

  beforeAll(async () => {
    const auth = await authHelper.loginAsUser();
    authToken = auth.token;
  });

  beforeEach((done) => {
    clientSocket = io(wsUrl, {
      auth: { token: authToken },
      transports: ['websocket'],
    });

    clientSocket.on('connect', done);
  });

  afterEach(() => {
    clientSocket.disconnect();
  });

  describe('Real-time contact updates', () => {
    it('should broadcast contact creation', (done) => {
      const roomId = 'workspace:test-workspace';
      
      // Join workspace room
      clientSocket.emit('join:room', {
        roomId: 'test-workspace',
        roomType: 'workspace',
      });

      // Listen for contact created event
      clientSocket.on('contact:created', (data) => {
        expect(data).toMatchObject({
          id: expect.any(String),
          email: 'realtime@haste.nyc',
          _meta: {
            createdBy: expect.any(String),
            timestamp: expect.any(String),
          },
        });
        done();
      });

      // Create contact via API
      request(app.getHttpServer())
        .post('/api/contacts')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Workspace-ID', 'test-workspace')
        .send({
          email: 'realtime@haste.nyc',
          firstName: 'Realtime',
          lastName: 'Test',
        })
        .expect(201);
    });

    it('should handle concurrent updates', async () => {
      const contactId = 'concurrent-test';
      const updates = [];

      // Multiple clients
      const clients = await Promise.all(
        Array.from({ length: 3 }, () => {
          return new Promise<Socket>((resolve) => {
            const client = io(wsUrl, {
              auth: { token: authToken },
            });
            client.on('connect', () => resolve(client));
          });
        })
      );

      // All clients join contact room
      await Promise.all(
        clients.map(
          (client) =>
            new Promise((resolve) => {
              client.emit(
                'join:room',
                { roomId: contactId, roomType: 'contact' },
                resolve
              );
            })
        )
      );

      // Listen for updates on all clients
      clients.forEach((client, index) => {
        client.on('contact:updated', (data) => {
          updates.push({ clientIndex: index, data });
        });
      });

      // Simulate concurrent updates
      await Promise.all([
        updateContact(contactId, { firstName: 'Update1' }),
        updateContact(contactId, { lastName: 'Update2' }),
        updateContact(contactId, { company: 'Update3' }),
      ]);

      // Wait for broadcasts
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Each client should receive all updates
      expect(updates.length).toBeGreaterThanOrEqual(9); // 3 clients × 3 updates

      // Cleanup
      clients.forEach((client) => client.disconnect());
    });
  });

  describe('Presence tracking', () => {
    it('should track user presence', async () => {
      const presenceUpdates = [];

      clientSocket.on('presence:updated', (data) => {
        presenceUpdates.push(data);
      });

      // Update presence
      clientSocket.emit('presence:update', {
        status: 'active',
        metadata: { currentView: 'contacts' },
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(presenceUpdates).toHaveLength(1);
      expect(presenceUpdates[0]).toMatchObject({
        userId: expect.any(String),
        status: 'active',
        metadata: { currentView: 'contacts' },
      });
    });

    it('should handle disconnection gracefully', async () => {
      const secondClient = io(wsUrl, {
        auth: { token: authToken },
      });

      await new Promise((resolve) => {
        secondClient.on('connect', resolve);
      });

      const offlineEvents = [];
      clientSocket.on('user:offline', (data) => {
        offlineEvents.push(data);
      });

      // Disconnect second client
      secondClient.disconnect();

      await new Promise((resolve) => setTimeout(resolve, 500));

      expect(offlineEvents).toHaveLength(1);
      expect(offlineEvents[0]).toMatchObject({
        userId: expect.any(String),
        timestamp: expect.any(String),
      });
    });
  });
});
```

## Queue Integration Tests

```typescript
// test/integration/queue/queue.integration.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { BullModule, getQueueToken } from '@nestjs/bull';
import { Queue } from 'bull';
import { EmailProcessor } from '@/queues/processors/email.processor';
import { AIProcessor } from '@/queues/processors/ai.processor';

describe('Queue Integration', () => {
  let emailQueue: Queue;
  let aiQueue: Queue;
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        BullModule.forRoot({
          redis: {
            host: 'localhost',
            port: 6380,
          },
        }),
        BullModule.registerQueue(
          { name: 'email' },
          { name: 'ai' }
        ),
      ],
      providers: [EmailProcessor, AIProcessor],
    }).compile();

    emailQueue = module.get<Queue>(getQueueToken('email'));
    aiQueue = module.get<Queue>(getQueueToken('ai'));
  });

  afterAll(async () => {
    await emailQueue.close();
    await aiQueue.close();
    await module.close();
  });

  describe('Email queue processing', () => {
    it('should process email jobs', async () => {
      const jobData = {
        to: 'test@haste.nyc',
        subject: 'Queue Test',
        template: 'welcome',
        data: { firstName: 'Test' },
      };

      const job = await emailQueue.add('send-email', jobData);
      
      // Wait for job completion
      const result = await job.finished();
      
      expect(result).toMatchObject({
        success: true,
        messageId: expect.any(String),
      });

      // Verify job was completed
      const completedJob = await emailQueue.getJob(job.id);
      expect(completedJob.finishedOn).toBeTruthy();
    });

    it('should handle job failures with retry', async () => {
      const jobData = {
        to: 'fail@haste.nyc',
        subject: 'Will Fail',
        template: 'non-existent',
      };

      const job = await emailQueue.add('send-email', jobData, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      });

      // Wait for all retry attempts
      await new Promise((resolve) => setTimeout(resolve, 5000));

      const failedJob = await emailQueue.getJob(job.id);
      expect(failedJob.attemptsMade).toBe(3);
      expect(failedJob.failedReason).toBeTruthy();
    });

    it('should process bulk email jobs', async () => {
      const jobs = Array.from({ length: 50 }, (_, i) => ({
        name: 'send-email',
        data: {
          to: `bulk${i}@haste.nyc`,
          subject: 'Bulk Email',
          template: 'marketing',
        },
      }));

      const addedJobs = await emailQueue.addBulk(jobs);
      expect(addedJobs).toHaveLength(50);

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Check completion rate
      const completed = await emailQueue.getCompletedCount();
      expect(completed).toBeGreaterThanOrEqual(45); // Allow some failures
    });
  });

  describe('AI queue processing', () => {
    it('should process AI enhancement jobs', async () => {
      const jobData = {
        contactId: 'test-contact',
        type: 'enrich-contact',
        data: {
          email: 'test@company.com',
          company: 'Test Company',
        },
      };

      const job = await aiQueue.add('ai-enhancement', jobData, {
        priority: 1,
        delay: 0,
      });

      const result = await job.finished();
      
      expect(result).toMatchObject({
        enriched: true,
        data: {
          industry: expect.any(String),
          companySize: expect.any(String),
          aiScore: expect.any(Number),
        },
      });
    });

    it('should respect rate limits', async () => {
      // Add many jobs at once
      const jobs = Array.from({ length: 20 }, (_, i) => ({
        name: 'ai-completion',
        data: {
          prompt: `Test prompt ${i}`,
          maxTokens: 100,
        },
        opts: {
          limiter: {
            max: 5,
            duration: 1000, // 5 per second
          },
        },
      }));

      const startTime = Date.now();
      await aiQueue.addBulk(jobs);

      // Wait for all jobs to complete
      await new Promise((resolve) => setTimeout(resolve, 5000));

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should take at least 4 seconds (20 jobs / 5 per second)
      expect(duration).toBeGreaterThanOrEqual(4000);
    });
  });

  describe('Queue monitoring', () => {
    it('should provide queue metrics', async () => {
      // Add various jobs
      await emailQueue.add('test', { type: 'waiting' });
      await emailQueue.add('test', { type: 'active' });
      await emailQueue.add('test', { type: 'delayed' }, { delay: 60000 });

      const counts = await emailQueue.getJobCounts();
      
      expect(counts).toMatchObject({
        waiting: expect.any(Number),
        active: expect.any(Number),
        completed: expect.any(Number),
        failed: expect.any(Number),
        delayed: expect.any(Number),
      });

      const health = await emailQueue.checkHealth();
      expect(health.isHealthy).toBe(true);
    });
  });
});
```

## End-to-End Workflow Tests

```typescript
// test/integration/workflows/complete-workflow.spec.ts
describe('Complete CRM Workflow', () => {
  it('should complete full sales workflow', async () => {
    // 1. Create contact
    const contactResponse = await request(app.getHttpServer())
      .post('/api/contacts')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        email: 'prospect@bigcompany.com',
        firstName: 'John',
        lastName: 'Prospect',
        company: 'Big Company Inc',
      })
      .expect(201);

    const contactId = contactResponse.body.data.id;

    // 2. AI enrichment should trigger
    await waitForJob('ai', 'enrich-contact');

    // 3. Check enriched data
    const enrichedContact = await request(app.getHttpServer())
      .get(`/api/contacts/${contactId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(enrichedContact.body.data.aiScore).toBeGreaterThan(0);
    expect(enrichedContact.body.data.company).toMatchObject({
      industry: expect.any(String),
      size: expect.any(String),
    });

    // 4. Create deal
    const dealResponse = await request(app.getHttpServer())
      .post('/api/deals')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        contactId,
        title: 'Enterprise Deal',
        value: 100000,
        stageId: 'qualification',
      })
      .expect(201);

    const dealId = dealResponse.body.data.id;

    // 5. Send email
    const emailResponse = await request(app.getHttpServer())
      .post('/api/emails/send')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        to: 'prospect@bigcompany.com',
        subject: 'Follow up on our discussion',
        template: 'follow-up',
        data: {
          dealValue: 100000,
          nextSteps: 'Schedule demo',
        },
        trackingEnabled: true,
      })
      .expect(200);

    // 6. Simulate email open (webhook)
    await request(app.getHttpServer())
      .post('/webhooks/sendgrid')
      .send({
        event: 'open',
        email: 'prospect@bigcompany.com',
        timestamp: Date.now(),
        sg_message_id: emailResponse.body.data.messageId,
      })
      .expect(200);

    // 7. Check activity log
    const activities = await request(app.getHttpServer())
      .get(`/api/contacts/${contactId}/activities`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(activities.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'CONTACT_CREATED' }),
        expect.objectContaining({ type: 'AI_ENRICHMENT' }),
        expect.objectContaining({ type: 'DEAL_CREATED' }),
        expect.objectContaining({ type: 'EMAIL_SENT' }),
        expect.objectContaining({ type: 'EMAIL_OPENED' }),
      ])
    );

    // 8. Move deal through pipeline
    await request(app.getHttpServer())
      .patch(`/api/deals/${dealId}/stage`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ stageId: 'proposal' })
      .expect(200);

    // 9. Add note
    await request(app.getHttpServer())
      .post(`/api/deals/${dealId}/notes`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        content: 'Customer is interested, sending proposal',
      })
      .expect(201);

    // 10. Generate AI insights
    const insightsResponse = await request(app.getHttpServer())
      .post(`/api/deals/${dealId}/ai-insights`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(insightsResponse.body.data).toMatchObject({
      winProbability: expect.any(Number),
      suggestedActions: expect.any(Array),
      riskFactors: expect.any(Array),
    });

    // 11. Check real-time updates via WebSocket
    const wsUpdates = [];
    clientSocket.on('deal:updated', (data) => wsUpdates.push(data));
    
    await request(app.getHttpServer())
      .patch(`/api/deals/${dealId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ value: 150000 })
      .expect(200);

    await new Promise(resolve => setTimeout(resolve, 500));
    
    expect(wsUpdates).toHaveLength(1);
    expect(wsUpdates[0].changes).toMatchObject({
      value: { old: 100000, new: 150000 },
    });

    // 12. Close deal
    await request(app.getHttpServer())
      .patch(`/api/deals/${dealId}/stage`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ stageId: 'closed-won' })
      .expect(200);

    // 13. Verify metrics updated
    const metrics = await request(app.getHttpServer())
      .get('/api/metrics/sales')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(metrics.body.data).toMatchObject({
      totalRevenue: expect.any(Number),
      dealsWon: expect.any(Number),
      averageDealSize: expect.any(Number),
      conversionRate: expect.any(Number),
    });
  });
});
```

This comprehensive integration testing guide provides all the patterns and examples needed to thoroughly test hasteCRM's integrated functionality.