# Service Implementation Templates

## Table of Contents
1. [Overview](#overview)
2. [Base Service Template](#base-service-template)
3. [Repository Pattern Template](#repository-pattern-template)
4. [Controller Template](#controller-template)
5. [GraphQL Resolver Template](#graphql-resolver-template)
6. [Queue Worker Template](#queue-worker-template)
7. [Webhook Handler Template](#webhook-handler-template)
8. [Scheduled Job Template](#scheduled-job-template)
9. [Event Handler Template](#event-handler-template)
10. [External API Client Template](#external-api-client-template)
11. [Cache Service Template](#cache-service-template)
12. [File Storage Service Template](#file-storage-service-template)

## Overview

This guide provides production-ready templates for common service patterns in hasteCRM, ensuring consistency and best practices across all implementations.

## Base Service Template

### Basic Service Structure

```typescript
// packages/api/src/services/[entity].service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MetricsService } from '../metrics/metrics.service';
import {
  NotFoundError,
  ValidationError,
  BusinessLogicError,
  BaseError,
} from '@hastecrm/common';
import { Prisma } from '@prisma/client';

@Injectable()
export class EntityService {
  private readonly logger = new Logger(EntityService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly eventEmitter: EventEmitter2,
    private readonly metrics: MetricsService
  ) {}

  // Create operation
  async create(data: CreateEntityDto, context: RequestContext): Promise<Entity> {
    const timer = this.metrics.startTimer('entity.create.duration');
    
    try {
      // 1. Validate business rules
      await this.validateCreateRules(data, context);
      
      // 2. Transform data
      const entityData = this.transformCreateData(data, context);
      
      // 3. Execute transaction
      const entity = await this.prisma.$transaction(async (tx) => {
        // Create main entity
        const created = await tx.entity.create({
          data: {
            ...entityData,
            createdById: context.userId,
            workspaceId: context.workspaceId,
          },
          include: this.getDefaultIncludes(),
        });

        // Create related entities
        await this.createRelatedEntities(tx, created, data);
        
        // Audit log
        await this.createAuditLog(tx, 'CREATE', created, context);
        
        return created;
      });

      // 4. Post-creation tasks
      await this.afterCreate(entity, context);
      
      // 5. Emit events
      this.eventEmitter.emit('entity.created', {
        entity,
        userId: context.userId,
        workspaceId: context.workspaceId,
      });

      // 6. Update metrics
      this.metrics.incrementCounter('entity.created.total');
      timer.end({ status: 'success' });

      return entity;
    } catch (error) {
      timer.end({ status: 'error' });
      this.metrics.incrementCounter('entity.created.errors');
      throw this.handleServiceError(error, 'create');
    }
  }

  // Read operations
  async findById(id: string, context: RequestContext): Promise<Entity> {
    const cacheKey = this.getCacheKey('entity', id);
    
    // Try cache first
    const cached = await this.cache.get<Entity>(cacheKey);
    if (cached) {
      this.metrics.incrementCounter('entity.cache.hits');
      return cached;
    }

    this.metrics.incrementCounter('entity.cache.misses');

    const entity = await this.prisma.entity.findFirst({
      where: {
        id,
        workspaceId: context.workspaceId,
        deletedAt: null,
      },
      include: this.getDefaultIncludes(),
    });

    if (!entity) {
      throw new NotFoundError('Entity', id);
    }

    // Check permissions
    await this.checkReadPermission(entity, context);

    // Cache the result
    await this.cache.set(cacheKey, entity, this.getCacheTTL());

    return entity;
  }

  async findAll(
    filters: EntityFilters,
    pagination: PaginationOptions,
    context: RequestContext
  ): Promise<PaginatedResult<Entity>> {
    const timer = this.metrics.startTimer('entity.list.duration');

    try {
      // Build query
      const where = this.buildWhereClause(filters, context);
      const orderBy = this.buildOrderByClause(pagination.sortBy, pagination.sortOrder);

      // Execute queries in parallel
      const [items, total] = await Promise.all([
        this.prisma.entity.findMany({
          where,
          orderBy,
          skip: pagination.offset,
          take: pagination.limit,
          include: this.getDefaultIncludes(),
        }),
        this.prisma.entity.count({ where }),
      ]);

      timer.end({ status: 'success' });

      return {
        items,
        total,
        limit: pagination.limit,
        offset: pagination.offset,
        hasNext: pagination.offset + items.length < total,
        hasPrev: pagination.offset > 0,
      };
    } catch (error) {
      timer.end({ status: 'error' });
      throw this.handleServiceError(error, 'findAll');
    }
  }

  // Update operation
  async update(
    id: string,
    data: UpdateEntityDto,
    context: RequestContext
  ): Promise<Entity> {
    const timer = this.metrics.startTimer('entity.update.duration');

    try {
      // Get existing entity
      const existing = await this.findById(id, context);
      
      // Check permissions
      await this.checkUpdatePermission(existing, context);
      
      // Validate update rules
      await this.validateUpdateRules(existing, data, context);
      
      // Transform data
      const updateData = this.transformUpdateData(data, existing);

      // Execute update
      const updated = await this.prisma.$transaction(async (tx) => {
        // Update entity
        const entity = await tx.entity.update({
          where: { id },
          data: {
            ...updateData,
            updatedAt: new Date(),
            version: { increment: 1 },
          },
          include: this.getDefaultIncludes(),
        });

        // Update related entities
        await this.updateRelatedEntities(tx, entity, data);
        
        // Create audit log
        await this.createAuditLog(tx, 'UPDATE', entity, context, existing);
        
        return entity;
      });

      // Post-update tasks
      await this.afterUpdate(updated, existing, context);
      
      // Invalidate cache
      await this.invalidateCache(id);
      
      // Emit events
      this.eventEmitter.emit('entity.updated', {
        entity: updated,
        previous: existing,
        userId: context.userId,
      });

      this.metrics.incrementCounter('entity.updated.total');
      timer.end({ status: 'success' });

      return updated;
    } catch (error) {
      timer.end({ status: 'error' });
      this.metrics.incrementCounter('entity.updated.errors');
      throw this.handleServiceError(error, 'update');
    }
  }

  // Delete operation
  async delete(id: string, context: RequestContext): Promise<void> {
    const timer = this.metrics.startTimer('entity.delete.duration');

    try {
      // Get existing entity
      const existing = await this.findById(id, context);
      
      // Check permissions
      await this.checkDeletePermission(existing, context);
      
      // Validate deletion rules
      await this.validateDeleteRules(existing, context);

      // Execute soft delete
      await this.prisma.$transaction(async (tx) => {
        // Soft delete entity
        await tx.entity.update({
          where: { id },
          data: {
            deletedAt: new Date(),
            deletedById: context.userId,
          },
        });

        // Handle cascading deletes
        await this.cascadeDelete(tx, existing);
        
        // Create audit log
        await this.createAuditLog(tx, 'DELETE', existing, context);
      });

      // Post-delete tasks
      await this.afterDelete(existing, context);
      
      // Invalidate cache
      await this.invalidateCache(id);
      
      // Emit events
      this.eventEmitter.emit('entity.deleted', {
        entity: existing,
        userId: context.userId,
      });

      this.metrics.incrementCounter('entity.deleted.total');
      timer.end({ status: 'success' });
    } catch (error) {
      timer.end({ status: 'error' });
      this.metrics.incrementCounter('entity.deleted.errors');
      throw this.handleServiceError(error, 'delete');
    }
  }

  // Bulk operations
  async bulkCreate(
    items: CreateEntityDto[],
    context: RequestContext
  ): Promise<BulkOperationResult> {
    const results: BulkOperationResult = {
      successful: [],
      failed: [],
      total: items.length,
    };

    // Process in batches
    const batchSize = 100;
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      
      try {
        const created = await this.prisma.$transaction(
          batch.map((item) =>
            this.prisma.entity.create({
              data: {
                ...this.transformCreateData(item, context),
                createdById: context.userId,
                workspaceId: context.workspaceId,
              },
            })
          )
        );
        
        results.successful.push(...created);
      } catch (error) {
        // Log error and track failed items
        this.logger.error(`Bulk create batch failed: ${error.message}`);
        batch.forEach((item, index) => {
          results.failed.push({
            index: i + index,
            data: item,
            error: error.message,
          });
        });
      }
    }

    return results;
  }

  // Search operation
  async search(
    query: string,
    options: SearchOptions,
    context: RequestContext
  ): Promise<SearchResult<Entity>> {
    const timer = this.metrics.startTimer('entity.search.duration');

    try {
      // Use full-text search or Elasticsearch
      const searchResults = await this.executeSearch(query, options, context);
      
      // Enhance with additional data
      const enhanced = await this.enhanceSearchResults(searchResults);
      
      timer.end({ status: 'success' });
      
      return {
        items: enhanced,
        total: searchResults.total,
        took: searchResults.took,
        query,
      };
    } catch (error) {
      timer.end({ status: 'error' });
      throw this.handleServiceError(error, 'search');
    }
  }

  // Helper methods
  private getDefaultIncludes(): Prisma.EntityInclude {
    return {
      createdBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      tags: true,
      attachments: true,
    };
  }

  private buildWhereClause(
    filters: EntityFilters,
    context: RequestContext
  ): Prisma.EntityWhereInput {
    const where: Prisma.EntityWhereInput = {
      workspaceId: context.workspaceId,
      deletedAt: null,
    };

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.createdAfter) {
      where.createdAt = { gte: filters.createdAfter };
    }

    if (filters.tags?.length) {
      where.tags = {
        some: {
          id: { in: filters.tags },
        },
      };
    }

    return where;
  }

  private getCacheKey(type: string, id: string): string {
    return `${type}:${id}`;
  }

  private getCacheTTL(): number {
    return 300; // 5 minutes
  }

  private async invalidateCache(id: string): Promise<void> {
    const keys = [
      this.getCacheKey('entity', id),
      `entity:list:*`,
    ];
    
    await Promise.all(keys.map(key => this.cache.delete(key)));
  }

  private handleServiceError(error: any, operation: string): never {
    if (error instanceof BaseError) {
      throw error;
    }

    this.logger.error(`Error in ${operation}:`, error);
    
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw this.handlePrismaError(error);
    }

    throw new BusinessLogicError(
      'SERVICE_ERROR',
      `Failed to ${operation} entity`,
      { originalError: error.message }
    );
  }

  private handlePrismaError(error: Prisma.PrismaClientKnownRequestError): BaseError {
    switch (error.code) {
      case 'P2002':
        return new ValidationError('Duplicate value', [error.meta]);
      case 'P2025':
        return new NotFoundError('Record');
      default:
        return new BusinessLogicError('DATABASE_ERROR', error.message);
    }
  }
}
```

## Repository Pattern Template

### Repository Interface

```typescript
// packages/api/src/repositories/interfaces/entity.repository.interface.ts
export interface IEntityRepository {
  create(data: CreateEntityData): Promise<Entity>;
  findById(id: string, workspaceId: string): Promise<Entity | null>;
  findAll(params: FindAllParams): Promise<PaginatedResult<Entity>>;
  update(id: string, data: UpdateEntityData): Promise<Entity>;
  delete(id: string): Promise<void>;
  exists(id: string, workspaceId: string): Promise<boolean>;
  count(filters: EntityFilters): Promise<number>;
}

export interface FindAllParams {
  filters: EntityFilters;
  pagination: PaginationOptions;
  includes?: string[];
  select?: string[];
}
```

### Repository Implementation

```typescript
// packages/api/src/repositories/entity.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { IEntityRepository, FindAllParams } from './interfaces/entity.repository.interface';

@Injectable()
export class EntityRepository implements IEntityRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateEntityData): Promise<Entity> {
    return this.prisma.entity.create({
      data,
      include: this.getDefaultInclude(),
    });
  }

  async findById(id: string, workspaceId: string): Promise<Entity | null> {
    return this.prisma.entity.findFirst({
      where: {
        id,
        workspaceId,
        deletedAt: null,
      },
      include: this.getDefaultInclude(),
    });
  }

  async findAll({
    filters,
    pagination,
    includes = [],
    select = [],
  }: FindAllParams): Promise<PaginatedResult<Entity>> {
    const where = this.buildWhereClause(filters);
    const include = this.buildInclude(includes);
    const orderBy = this.buildOrderBy(pagination);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.entity.findMany({
        where,
        include: select.length > 0 ? undefined : include,
        select: select.length > 0 ? this.buildSelect(select) : undefined,
        orderBy,
        skip: pagination.offset,
        take: pagination.limit,
      }),
      this.prisma.entity.count({ where }),
    ]);

    return {
      items,
      total,
      limit: pagination.limit,
      offset: pagination.offset,
      hasNext: pagination.offset + items.length < total,
      hasPrev: pagination.offset > 0,
    };
  }

  async update(id: string, data: UpdateEntityData): Promise<Entity> {
    return this.prisma.entity.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
        version: { increment: 1 },
      },
      include: this.getDefaultInclude(),
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.entity.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  async exists(id: string, workspaceId: string): Promise<boolean> {
    const count = await this.prisma.entity.count({
      where: {
        id,
        workspaceId,
        deletedAt: null,
      },
    });
    return count > 0;
  }

  async count(filters: EntityFilters): Promise<number> {
    const where = this.buildWhereClause(filters);
    return this.prisma.entity.count({ where });
  }

  // Specialized queries
  async findByEmail(email: string, workspaceId: string): Promise<Entity | null> {
    return this.prisma.entity.findFirst({
      where: {
        email,
        workspaceId,
        deletedAt: null,
      },
      include: this.getDefaultInclude(),
    });
  }

  async findWithRelations(
    id: string,
    relations: string[]
  ): Promise<Entity | null> {
    return this.prisma.entity.findUnique({
      where: { id },
      include: this.buildInclude(relations),
    });
  }

  async bulkCreate(items: CreateEntityData[]): Promise<number> {
    const result = await this.prisma.entity.createMany({
      data: items,
      skipDuplicates: true,
    });
    return result.count;
  }

  async bulkUpdate(
    ids: string[],
    data: Partial<UpdateEntityData>
  ): Promise<number> {
    const result = await this.prisma.entity.updateMany({
      where: {
        id: { in: ids },
      },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });
    return result.count;
  }

  // Query builders
  private buildWhereClause(filters: EntityFilters): Prisma.EntityWhereInput {
    const where: Prisma.EntityWhereInput = {
      deletedAt: null,
    };

    if (filters.workspaceId) {
      where.workspaceId = filters.workspaceId;
    }

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.createdAfter || filters.createdBefore) {
      where.createdAt = {};
      if (filters.createdAfter) {
        where.createdAt.gte = filters.createdAfter;
      }
      if (filters.createdBefore) {
        where.createdAt.lte = filters.createdBefore;
      }
    }

    return where;
  }

  private buildInclude(relations: string[]): any {
    const include: any = {};
    
    relations.forEach(relation => {
      const parts = relation.split('.');
      let current = include;
      
      parts.forEach((part, index) => {
        if (index === parts.length - 1) {
          current[part] = true;
        } else {
          current[part] = current[part] || { include: {} };
          current = current[part].include;
        }
      });
    });

    return { ...this.getDefaultInclude(), ...include };
  }

  private buildSelect(fields: string[]): any {
    const select: any = { id: true };
    
    fields.forEach(field => {
      const parts = field.split('.');
      let current = select;
      
      parts.forEach((part, index) => {
        if (index === parts.length - 1) {
          current[part] = true;
        } else {
          current[part] = current[part] || { select: {} };
          current = current[part].select;
        }
      });
    });

    return select;
  }

  private buildOrderBy(pagination: PaginationOptions): any {
    if (!pagination.sortBy) {
      return { createdAt: 'desc' };
    }

    const order = pagination.sortOrder || 'asc';
    const sortPath = pagination.sortBy.split('.');
    
    if (sortPath.length === 1) {
      return { [sortPath[0]]: order };
    }

    // Handle nested sorting
    let orderBy: any = {};
    let current = orderBy;
    
    sortPath.forEach((part, index) => {
      if (index === sortPath.length - 1) {
        current[part] = order;
      } else {
        current[part] = {};
        current = current[part];
      }
    });

    return orderBy;
  }

  private getDefaultInclude(): Prisma.EntityInclude {
    return {
      _count: {
        select: {
          activities: true,
          attachments: true,
        },
      },
    };
  }
}
```

## Controller Template

### REST Controller

```typescript
// packages/api/src/controllers/entity.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  ValidationPipe,
  SerializeOptions,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { EntityService } from '../services/entity.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import { RequestContext } from '../decorators/request-context.decorator';
import { CacheInterceptor } from '../interceptors/cache.interceptor';
import { AuditInterceptor } from '../interceptors/audit.interceptor';
import { RateLimitGuard } from '../guards/rate-limit.guard';
import {
  CreateEntityDto,
  UpdateEntityDto,
  EntityResponseDto,
  EntityListResponseDto,
  EntityFiltersDto,
  PaginationDto,
} from '../dto/entity.dto';

@ApiTags('entities')
@ApiBearerAuth()
@Controller('entities')
@UseGuards(JwtAuthGuard, RolesGuard, RateLimitGuard)
@UseInterceptors(ClassSerializerInterceptor, AuditInterceptor)
@SerializeOptions({ excludeExtraneousValues: true })
export class EntityController {
  constructor(private readonly entityService: EntityService) {}

  @Post()
  @Roles('user', 'admin')
  @ApiOperation({ summary: 'Create a new entity' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Entity created successfully',
    type: EntityResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Entity already exists',
  })
  async create(
    @Body(ValidationPipe) dto: CreateEntityDto,
    @RequestContext() context: IRequestContext
  ): Promise<EntityResponseDto> {
    const entity = await this.entityService.create(dto, context);
    return EntityResponseDto.fromEntity(entity);
  }

  @Get()
  @Roles('user', 'admin')
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({ summary: 'List entities' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of entities',
    type: EntityListResponseDto,
  })
  async findAll(
    @Query(ValidationPipe) filters: EntityFiltersDto,
    @Query(ValidationPipe) pagination: PaginationDto,
    @RequestContext() context: IRequestContext
  ): Promise<EntityListResponseDto> {
    const result = await this.entityService.findAll(
      filters,
      pagination.toOptions(),
      context
    );
    
    return EntityListResponseDto.fromPaginatedResult(result);
  }

  @Get(':id')
  @Roles('user', 'admin')
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({ summary: 'Get entity by ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Entity found',
    type: EntityResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Entity not found',
  })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @RequestContext() context: IRequestContext
  ): Promise<EntityResponseDto> {
    const entity = await this.entityService.findById(id, context);
    return EntityResponseDto.fromEntity(entity);
  }

  @Put(':id')
  @Roles('user', 'admin')
  @ApiOperation({ summary: 'Update entity' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Entity updated successfully',
    type: EntityResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Entity not found',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Update conflict',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(ValidationPipe) dto: UpdateEntityDto,
    @RequestContext() context: IRequestContext
  ): Promise<EntityResponseDto> {
    const entity = await this.entityService.update(id, dto, context);
    return EntityResponseDto.fromEntity(entity);
  }

  @Patch(':id')
  @Roles('user', 'admin')
  @ApiOperation({ summary: 'Partially update entity' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Entity updated successfully',
    type: EntityResponseDto,
  })
  async patch(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(ValidationPipe) dto: Partial<UpdateEntityDto>,
    @RequestContext() context: IRequestContext
  ): Promise<EntityResponseDto> {
    const entity = await this.entityService.update(id, dto, context);
    return EntityResponseDto.fromEntity(entity);
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete entity' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Entity deleted successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Entity not found',
  })
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @RequestContext() context: IRequestContext
  ): Promise<void> {
    await this.entityService.delete(id, context);
  }

  @Post('bulk')
  @Roles('admin')
  @ApiOperation({ summary: 'Bulk create entities' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Entities created successfully',
  })
  async bulkCreate(
    @Body(ValidationPipe) dto: CreateEntityDto[],
    @RequestContext() context: IRequestContext
  ): Promise<BulkOperationResponseDto> {
    const result = await this.entityService.bulkCreate(dto, context);
    return BulkOperationResponseDto.fromResult(result);
  }

  @Post('search')
  @Roles('user', 'admin')
  @ApiOperation({ summary: 'Search entities' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Search results',
  })
  async search(
    @Body(ValidationPipe) dto: SearchEntityDto,
    @RequestContext() context: IRequestContext
  ): Promise<SearchResponseDto> {
    const result = await this.entityService.search(
      dto.query,
      dto.options,
      context
    );
    return SearchResponseDto.fromResult(result);
  }

  // Additional endpoints
  @Post(':id/duplicate')
  @Roles('user', 'admin')
  @ApiOperation({ summary: 'Duplicate entity' })
  async duplicate(
    @Param('id', ParseUUIDPipe) id: string,
    @RequestContext() context: IRequestContext
  ): Promise<EntityResponseDto> {
    const entity = await this.entityService.duplicate(id, context);
    return EntityResponseDto.fromEntity(entity);
  }

  @Post(':id/archive')
  @Roles('user', 'admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Archive entity' })
  async archive(
    @Param('id', ParseUUIDPipe) id: string,
    @RequestContext() context: IRequestContext
  ): Promise<void> {
    await this.entityService.archive(id, context);
  }

  @Post(':id/restore')
  @Roles('admin')
  @ApiOperation({ summary: 'Restore archived entity' })
  async restore(
    @Param('id', ParseUUIDPipe) id: string,
    @RequestContext() context: IRequestContext
  ): Promise<EntityResponseDto> {
    const entity = await this.entityService.restore(id, context);
    return EntityResponseDto.fromEntity(entity);
  }

  @Get(':id/history')
  @Roles('user', 'admin')
  @ApiOperation({ summary: 'Get entity history' })
  async getHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @Query(ValidationPipe) pagination: PaginationDto,
    @RequestContext() context: IRequestContext
  ): Promise<HistoryResponseDto> {
    const history = await this.entityService.getHistory(
      id,
      pagination.toOptions(),
      context
    );
    return HistoryResponseDto.fromHistory(history);
  }

  @Post(':id/tags')
  @Roles('user', 'admin')
  @ApiOperation({ summary: 'Add tags to entity' })
  async addTags(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(ValidationPipe) dto: AddTagsDto,
    @RequestContext() context: IRequestContext
  ): Promise<EntityResponseDto> {
    const entity = await this.entityService.addTags(id, dto.tags, context);
    return EntityResponseDto.fromEntity(entity);
  }

  @Delete(':id/tags/:tagId')
  @Roles('user', 'admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove tag from entity' })
  async removeTag(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('tagId', ParseUUIDPipe) tagId: string,
    @RequestContext() context: IRequestContext
  ): Promise<void> {
    await this.entityService.removeTag(id, tagId, context);
  }
}
```

## GraphQL Resolver Template

```typescript
// packages/api/src/resolvers/entity.resolver.ts
import { Resolver, Query, Mutation, Args, Context, Subscription } from '@nestjs/graphql';
import { UseGuards, UseInterceptors } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { EntityService } from '../services/entity.service';
import { GqlAuthGuard } from '../guards/gql-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import { RequestContext } from '../decorators/request-context.decorator';
import { DataLoaderInterceptor } from '../interceptors/dataloader.interceptor';
import {
  Entity,
  CreateEntityInput,
  UpdateEntityInput,
  EntityConnection,
  EntityFilter,
  EntitySortInput,
} from '../graphql/types/entity.types';

const pubSub = new PubSub();

@Resolver(() => Entity)
@UseGuards(GqlAuthGuard, RolesGuard)
@UseInterceptors(DataLoaderInterceptor)
export class EntityResolver {
  constructor(private readonly entityService: EntityService) {}

  @Query(() => Entity, { nullable: true })
  @Roles('user', 'admin')
  async entity(
    @Args('id') id: string,
    @Context('requestContext') context: IRequestContext
  ): Promise<Entity | null> {
    return this.entityService.findById(id, context);
  }

  @Query(() => EntityConnection)
  @Roles('user', 'admin')
  async entities(
    @Args('filter', { nullable: true }) filter?: EntityFilter,
    @Args('sort', { nullable: true }) sort?: EntitySortInput,
    @Args('first', { nullable: true, defaultValue: 20 }) first?: number,
    @Args('after', { nullable: true }) after?: string,
    @Context('requestContext') context?: IRequestContext
  ): Promise<EntityConnection> {
    const pagination = this.decodeCursor(after);
    
    const result = await this.entityService.findAll(
      filter || {},
      {
        limit: first,
        offset: pagination.offset,
        sortBy: sort?.field,
        sortOrder: sort?.direction,
      },
      context
    );

    return this.toConnection(result, first);
  }

  @Mutation(() => Entity)
  @Roles('user', 'admin')
  async createEntity(
    @Args('input') input: CreateEntityInput,
    @Context('requestContext') context: IRequestContext
  ): Promise<Entity> {
    const entity = await this.entityService.create(input, context);
    
    // Publish event
    await pubSub.publish('entityCreated', { 
      entityCreated: entity,
      workspaceId: context.workspaceId,
    });
    
    return entity;
  }

  @Mutation(() => Entity)
  @Roles('user', 'admin')
  async updateEntity(
    @Args('id') id: string,
    @Args('input') input: UpdateEntityInput,
    @Context('requestContext') context: IRequestContext
  ): Promise<Entity> {
    const entity = await this.entityService.update(id, input, context);
    
    // Publish event
    await pubSub.publish('entityUpdated', { 
      entityUpdated: entity,
      workspaceId: context.workspaceId,
    });
    
    return entity;
  }

  @Mutation(() => Boolean)
  @Roles('admin')
  async deleteEntity(
    @Args('id') id: string,
    @Context('requestContext') context: IRequestContext
  ): Promise<boolean> {
    await this.entityService.delete(id, context);
    
    // Publish event
    await pubSub.publish('entityDeleted', { 
      entityDeleted: id,
      workspaceId: context.workspaceId,
    });
    
    return true;
  }

  @Mutation(() => [Entity])
  @Roles('admin')
  async bulkCreateEntities(
    @Args('inputs', { type: () => [CreateEntityInput] }) inputs: CreateEntityInput[],
    @Context('requestContext') context: IRequestContext
  ): Promise<Entity[]> {
    const result = await this.entityService.bulkCreate(inputs, context);
    return result.successful;
  }

  // Field resolvers for complex fields
  @ResolveField(() => User)
  async createdBy(
    @Parent() entity: Entity,
    @Context('loaders') loaders: IDataLoaders
  ): Promise<User> {
    return loaders.userLoader.load(entity.createdById);
  }

  @ResolveField(() => [Tag])
  async tags(
    @Parent() entity: Entity,
    @Context('loaders') loaders: IDataLoaders
  ): Promise<Tag[]> {
    return loaders.tagsByEntityLoader.load(entity.id);
  }

  @ResolveField(() => Int)
  async activityCount(
    @Parent() entity: Entity,
    @Context('loaders') loaders: IDataLoaders
  ): Promise<number> {
    const counts = await loaders.activityCountLoader.load(entity.id);
    return counts.activities || 0;
  }

  // Subscriptions
  @Subscription(() => Entity, {
    filter: (payload, variables, context) => {
      return payload.workspaceId === context.requestContext.workspaceId;
    },
  })
  @Roles('user', 'admin')
  entityCreated(@Context('requestContext') context: IRequestContext) {
    return pubSub.asyncIterator('entityCreated');
  }

  @Subscription(() => Entity, {
    filter: (payload, variables, context) => {
      return payload.workspaceId === context.requestContext.workspaceId;
    },
  })
  @Roles('user', 'admin')
  entityUpdated(@Context('requestContext') context: IRequestContext) {
    return pubSub.asyncIterator('entityUpdated');
  }

  @Subscription(() => String, {
    filter: (payload, variables, context) => {
      return payload.workspaceId === context.requestContext.workspaceId;
    },
  })
  @Roles('user', 'admin')
  entityDeleted(@Context('requestContext') context: IRequestContext) {
    return pubSub.asyncIterator('entityDeleted');
  }

  // Helper methods
  private decodeCursor(cursor?: string): { offset: number } {
    if (!cursor) {
      return { offset: 0 };
    }
    
    const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
    const offset = parseInt(decoded.split(':')[1], 10);
    
    return { offset };
  }

  private encodeCursor(offset: number): string {
    return Buffer.from(`cursor:${offset}`).toString('base64');
  }

  private toConnection(
    result: PaginatedResult<Entity>,
    limit: number
  ): EntityConnection {
    const edges = result.items.map((item, index) => ({
      cursor: this.encodeCursor(result.offset + index),
      node: item,
    }));

    return {
      edges,
      pageInfo: {
        hasNextPage: result.hasNext,
        hasPreviousPage: result.hasPrev,
        startCursor: edges[0]?.cursor,
        endCursor: edges[edges.length - 1]?.cursor,
      },
      totalCount: result.total,
    };
  }
}
```

## Queue Worker Template

```typescript
// packages/api/src/workers/entity-processing.worker.ts
import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { EntityService } from '../services/entity.service';
import { MetricsService } from '../services/metrics.service';
import { NotificationService } from '../services/notification.service';

interface EntityProcessingJob {
  entityId: string;
  operation: 'enrich' | 'analyze' | 'export' | 'import';
  data?: any;
  userId: string;
  workspaceId: string;
}

@Processor('entity-processing')
export class EntityProcessingWorker {
  private readonly logger = new Logger(EntityProcessingWorker.name);

  constructor(
    private readonly entityService: EntityService,
    private readonly metricsService: MetricsService,
    private readonly notificationService: NotificationService
  ) {}

  @Process('process-entity')
  async processEntity(job: Job<EntityProcessingJob>) {
    const { entityId, operation, data, userId, workspaceId } = job.data;
    const timer = this.metricsService.startTimer('worker.entity.processing.duration');

    try {
      this.logger.log(`Processing entity ${entityId} with operation ${operation}`);
      
      // Update job progress
      await job.progress(10);

      const context = { userId, workspaceId };
      let result: any;

      switch (operation) {
        case 'enrich':
          result = await this.enrichEntity(entityId, context);
          break;
        case 'analyze':
          result = await this.analyzeEntity(entityId, data, context);
          break;
        case 'export':
          result = await this.exportEntity(entityId, data, context);
          break;
        case 'import':
          result = await this.importEntityData(data, context);
          break;
        default:
          throw new Error(`Unknown operation: ${operation}`);
      }

      await job.progress(90);

      // Send notification on completion
      await this.notificationService.send({
        userId,
        type: 'entity.processing.completed',
        data: {
          entityId,
          operation,
          result,
        },
      });

      await job.progress(100);
      timer.end({ status: 'success', operation });
      this.metricsService.incrementCounter('worker.entity.processed.total', { operation });

      return result;
    } catch (error) {
      this.logger.error(`Failed to process entity ${entityId}:`, error);
      timer.end({ status: 'error', operation });
      this.metricsService.incrementCounter('worker.entity.errors.total', { operation });

      // Send error notification
      await this.notificationService.send({
        userId,
        type: 'entity.processing.failed',
        data: {
          entityId,
          operation,
          error: error.message,
        },
      });

      throw error;
    }
  }

  @Process('bulk-process')
  async bulkProcess(job: Job<{ entityIds: string[]; operation: string }>) {
    const { entityIds, operation } = job.data;
    const results = [];
    const errors = [];

    for (let i = 0; i < entityIds.length; i++) {
      const entityId = entityIds[i];
      const progress = Math.floor((i / entityIds.length) * 100);
      await job.progress(progress);

      try {
        const result = await this.processEntity({
          ...job,
          data: { ...job.data, entityId },
        } as any);
        results.push({ entityId, success: true, result });
      } catch (error) {
        errors.push({ entityId, success: false, error: error.message });
      }
    }

    return { results, errors, total: entityIds.length };
  }

  private async enrichEntity(entityId: string, context: IRequestContext) {
    // Implement entity enrichment logic
    const entity = await this.entityService.findById(entityId, context);
    
    // Call external APIs for enrichment
    const enrichmentData = await this.fetchEnrichmentData(entity);
    
    // Update entity with enriched data
    return this.entityService.update(entityId, enrichmentData, context);
  }

  private async analyzeEntity(
    entityId: string,
    analysisOptions: any,
    context: IRequestContext
  ) {
    // Implement entity analysis logic
    const entity = await this.entityService.findById(entityId, context);
    
    // Perform various analyses
    const analyses = await Promise.all([
      this.analyzeSentiment(entity),
      this.analyzeEngagement(entity),
      this.analyzePotential(entity),
    ]);

    return {
      entityId,
      analyses,
      timestamp: new Date(),
    };
  }

  private async exportEntity(
    entityId: string,
    exportOptions: any,
    context: IRequestContext
  ) {
    // Implement entity export logic
    const entity = await this.entityService.findById(entityId, context);
    
    // Generate export file
    const exportFile = await this.generateExportFile(entity, exportOptions);
    
    // Upload to storage
    const fileUrl = await this.uploadExportFile(exportFile);
    
    return { fileUrl, format: exportOptions.format };
  }

  private async importEntityData(
    importData: any,
    context: IRequestContext
  ) {
    // Implement entity import logic
    const validated = await this.validateImportData(importData);
    
    // Process imports in batches
    const batchSize = 100;
    const results = [];
    
    for (let i = 0; i < validated.length; i += batchSize) {
      const batch = validated.slice(i, i + batchSize);
      const batchResults = await this.entityService.bulkCreate(batch, context);
      results.push(...batchResults.successful);
    }
    
    return {
      imported: results.length,
      total: importData.length,
    };
  }

  // Helper methods
  private async fetchEnrichmentData(entity: any) {
    // Implement external API calls
    return {};
  }

  private async analyzeSentiment(entity: any) {
    // Implement sentiment analysis
    return { sentiment: 'positive', score: 0.8 };
  }

  private async analyzeEngagement(entity: any) {
    // Implement engagement analysis
    return { engagement: 'high', score: 0.9 };
  }

  private async analyzePotential(entity: any) {
    // Implement potential analysis
    return { potential: 'high', score: 0.85 };
  }

  private async generateExportFile(entity: any, options: any) {
    // Implement file generation
    return Buffer.from(JSON.stringify(entity));
  }

  private async uploadExportFile(file: Buffer) {
    // Implement file upload
    return 'https://storage.haste.nyc/exports/file.json';
  }

  private async validateImportData(data: any) {
    // Implement validation
    return data;
  }
}
```

## Webhook Handler Template

```typescript
// packages/api/src/webhooks/entity-webhook.handler.ts
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { WebhookService } from '../services/webhook.service';
import { CryptoService } from '../services/crypto.service';
import { RetryStrategy } from '@hastecrm/common';

interface WebhookPayload {
  event: string;
  data: any;
  timestamp: Date;
  workspaceId: string;
}

@Injectable()
export class EntityWebhookHandler {
  private readonly logger = new Logger(EntityWebhookHandler.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly webhookService: WebhookService,
    private readonly cryptoService: CryptoService,
    private readonly eventEmitter: EventEmitter2
  ) {}

  @OnEvent('entity.created')
  async handleEntityCreated(payload: any) {
    await this.sendWebhooks('entity.created', payload);
  }

  @OnEvent('entity.updated')
  async handleEntityUpdated(payload: any) {
    await this.sendWebhooks('entity.updated', payload);
  }

  @OnEvent('entity.deleted')
  async handleEntityDeleted(payload: any) {
    await this.sendWebhooks('entity.deleted', payload);
  }

  private async sendWebhooks(event: string, data: any) {
    const webhooks = await this.webhookService.getActiveWebhooks(
      data.workspaceId,
      event
    );

    for (const webhook of webhooks) {
      // Process webhooks asynchronously
      this.processWebhook(webhook, { event, data, timestamp: new Date(), workspaceId: data.workspaceId })
        .catch(error => {
          this.logger.error(`Failed to process webhook ${webhook.id}:`, error);
        });
    }
  }

  private async processWebhook(webhook: any, payload: WebhookPayload) {
    const attemptId = this.generateAttemptId();
    
    try {
      // Prepare request
      const headers = this.buildHeaders(webhook, payload);
      const body = this.buildBody(webhook, payload);

      // Send webhook with retry
      const response = await RetryStrategy.execute(
        () => this.sendHttpRequest(webhook.url, headers, body),
        {
          maxAttempts: 3,
          delay: 1000,
          factor: 2,
          jitter: true,
          retryCondition: (error) => {
            // Retry on network errors or 5xx responses
            return !error.response || error.response.status >= 500;
          },
        }
      );

      // Log successful delivery
      await this.webhookService.logDelivery({
        webhookId: webhook.id,
        attemptId,
        status: 'success',
        statusCode: response.status,
        responseTime: response.duration,
        response: response.data,
      });

      this.logger.log(`Webhook ${webhook.id} delivered successfully`);
    } catch (error) {
      // Log failed delivery
      await this.webhookService.logDelivery({
        webhookId: webhook.id,
        attemptId,
        status: 'failed',
        statusCode: error.response?.status,
        error: error.message,
        responseTime: error.duration,
      });

      // Check if webhook should be disabled
      const recentFailures = await this.webhookService.getRecentFailures(webhook.id);
      if (recentFailures >= 10) {
        await this.webhookService.disableWebhook(webhook.id, 'Too many failures');
        this.logger.warn(`Webhook ${webhook.id} disabled due to repeated failures`);
      }

      throw error;
    }
  }

  private buildHeaders(webhook: any, payload: WebhookPayload): Record<string, string> {
    const timestamp = Date.now().toString();
    const signature = this.cryptoService.generateWebhookSignature(
      webhook.secret,
      timestamp,
      JSON.stringify(payload)
    );

    return {
      'Content-Type': 'application/json',
      'X-Webhook-Id': webhook.id,
      'X-Webhook-Timestamp': timestamp,
      'X-Webhook-Signature': signature,
      'User-Agent': 'HasteCRM-Webhook/1.0',
      ...webhook.headers,
    };
  }

  private buildBody(webhook: any, payload: WebhookPayload): any {
    // Apply any transformations
    if (webhook.template) {
      return this.applyTemplate(webhook.template, payload);
    }
    
    return payload;
  }

  private async sendHttpRequest(
    url: string,
    headers: Record<string, string>,
    body: any
  ) {
    const startTime = Date.now();
    
    try {
      const response = await firstValueFrom(
        this.httpService.post(url, body, {
          headers,
          timeout: 30000,
          validateStatus: () => true,
        })
      );

      return {
        status: response.status,
        data: response.data,
        headers: response.headers,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      error.duration = Date.now() - startTime;
      throw error;
    }
  }

  private applyTemplate(template: string, data: any): any {
    // Implement template engine logic
    // This is a simple example - use a proper template engine in production
    let result = template;
    
    Object.keys(data).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, JSON.stringify(data[key]));
    });
    
    return JSON.parse(result);
  }

  private generateAttemptId(): string {
    return `attempt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

## Scheduled Job Template

```typescript
// packages/api/src/jobs/entity-cleanup.job.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression, SchedulerRegistry } from '@nestjs/schedule';
import { EntityService } from '../services/entity.service';
import { MetricsService } from '../services/metrics.service';
import { ConfigService } from '@nestjs/config';
import { DistributedLockService } from '../services/distributed-lock.service';

@Injectable()
export class EntityCleanupJob {
  private readonly logger = new Logger(EntityCleanupJob.name);
  private readonly lockKey = 'job:entity-cleanup';
  private readonly lockTTL = 300000; // 5 minutes

  constructor(
    private readonly entityService: EntityService,
    private readonly metricsService: MetricsService,
    private readonly configService: ConfigService,
    private readonly lockService: DistributedLockService,
    private readonly schedulerRegistry: SchedulerRegistry
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_2AM, {
    name: 'entity-cleanup',
    timeZone: 'America/New_York',
  })
  async handleCleanup() {
    const jobId = `cleanup_${Date.now()}`;
    this.logger.log(`Starting entity cleanup job ${jobId}`);

    // Acquire distributed lock to prevent duplicate runs
    const lock = await this.lockService.acquire(this.lockKey, this.lockTTL);
    if (!lock) {
      this.logger.warn('Could not acquire lock for entity cleanup job');
      return;
    }

    const timer = this.metricsService.startTimer('job.entity.cleanup.duration');

    try {
      // Run cleanup tasks
      const results = await Promise.allSettled([
        this.cleanupDeletedEntities(),
        this.cleanupOrphanedRecords(),
        this.cleanupExpiredData(),
        this.archiveOldEntities(),
      ]);

      // Process results
      const summary = this.processResults(results);
      
      // Log summary
      this.logger.log('Entity cleanup completed', summary);
      
      // Update metrics
      this.metricsService.incrementCounter('job.entity.cleanup.completed');
      timer.end({ status: 'success' });

      // Send report
      await this.sendCleanupReport(jobId, summary);
    } catch (error) {
      this.logger.error('Entity cleanup job failed:', error);
      this.metricsService.incrementCounter('job.entity.cleanup.failed');
      timer.end({ status: 'error' });
      throw error;
    } finally {
      // Release lock
      await this.lockService.release(this.lockKey, lock);
    }
  }

  @Cron('0 */15 * * * *', {
    name: 'entity-health-check',
  })
  async handleHealthCheck() {
    const timer = this.metricsService.startTimer('job.entity.health.duration');

    try {
      // Check entity data integrity
      const issues = await this.checkDataIntegrity();
      
      if (issues.length > 0) {
        this.logger.warn(`Found ${issues.length} data integrity issues`);
        await this.notifyDataIntegrityIssues(issues);
      }

      timer.end({ status: 'success' });
    } catch (error) {
      this.logger.error('Health check failed:', error);
      timer.end({ status: 'error' });
    }
  }

  private async cleanupDeletedEntities(): Promise<CleanupResult> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30); // 30 days retention

    const deleted = await this.entityService.permanentlyDelete({
      deletedAt: { lte: cutoffDate },
    });

    return {
      task: 'cleanupDeletedEntities',
      success: true,
      count: deleted,
    };
  }

  private async cleanupOrphanedRecords(): Promise<CleanupResult> {
    // Find and remove orphaned related records
    const orphaned = await this.entityService.findOrphanedRecords();
    const removed = await this.entityService.removeOrphaned(orphaned);

    return {
      task: 'cleanupOrphanedRecords',
      success: true,
      count: removed,
    };
  }

  private async cleanupExpiredData(): Promise<CleanupResult> {
    // Clean up expired temporary data
    const expired = await this.entityService.cleanupExpired();

    return {
      task: 'cleanupExpiredData',
      success: true,
      count: expired,
    };
  }

  private async archiveOldEntities(): Promise<CleanupResult> {
    const archiveDate = new Date();
    archiveDate.setMonth(archiveDate.getMonth() - 6); // Archive after 6 months

    const archived = await this.entityService.archiveOld({
      updatedAt: { lte: archiveDate },
      status: 'inactive',
    });

    return {
      task: 'archiveOldEntities',
      success: true,
      count: archived,
    };
  }

  private async checkDataIntegrity(): Promise<DataIntegrityIssue[]> {
    const issues: DataIntegrityIssue[] = [];

    // Check for missing required fields
    const missingFields = await this.entityService.findMissingRequiredFields();
    if (missingFields.length > 0) {
      issues.push({
        type: 'missing_fields',
        severity: 'high',
        count: missingFields.length,
        examples: missingFields.slice(0, 5),
      });
    }

    // Check for invalid references
    const invalidRefs = await this.entityService.findInvalidReferences();
    if (invalidRefs.length > 0) {
      issues.push({
        type: 'invalid_references',
        severity: 'medium',
        count: invalidRefs.length,
        examples: invalidRefs.slice(0, 5),
      });
    }

    return issues;
  }

  private processResults(results: PromiseSettledResult<CleanupResult>[]): CleanupSummary {
    const summary: CleanupSummary = {
      totalTasks: results.length,
      successful: 0,
      failed: 0,
      totalRecordsProcessed: 0,
      tasks: [],
    };

    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        summary.successful++;
        summary.totalRecordsProcessed += result.value.count;
        summary.tasks.push(result.value);
      } else {
        summary.failed++;
        summary.tasks.push({
          task: 'unknown',
          success: false,
          error: result.reason.message,
        });
      }
    });

    return summary;
  }

  private async sendCleanupReport(jobId: string, summary: CleanupSummary) {
    // Send email report to admins
    await this.emailService.send({
      to: this.configService.get('ADMIN_EMAIL'),
      subject: `Entity Cleanup Report - ${jobId}`,
      template: 'cleanup-report',
      data: summary,
    });
  }

  private async notifyDataIntegrityIssues(issues: DataIntegrityIssue[]) {
    // Send alert about data integrity issues
    await this.alertService.send({
      severity: 'warning',
      title: 'Data Integrity Issues Detected',
      message: `Found ${issues.length} data integrity issues`,
      data: issues,
    });
  }

  // Dynamic job management
  addDynamicJob(name: string, cronTime: string, callback: () => void) {
    const job = new CronJob(cronTime, callback);
    this.schedulerRegistry.addCronJob(name, job);
    job.start();
  }

  deleteJob(name: string) {
    this.schedulerRegistry.deleteCronJob(name);
    this.logger.warn(`Job ${name} deleted!`);
  }

  getJobs() {
    const jobs = this.schedulerRegistry.getCronJobs();
    jobs.forEach((value, key) => {
      let next;
      try {
        next = value.nextDates().toDate();
      } catch (e) {
        next = 'error: next fire date is in the past!';
      }
      this.logger.log(`Job: ${key} -> next: ${next}`);
    });
  }
}

interface CleanupResult {
  task: string;
  success: boolean;
  count?: number;
  error?: string;
}

interface CleanupSummary {
  totalTasks: number;
  successful: number;
  failed: number;
  totalRecordsProcessed: number;
  tasks: CleanupResult[];
}

interface DataIntegrityIssue {
  type: string;
  severity: 'low' | 'medium' | 'high';
  count: number;
  examples: any[];
}
```

## Event Handler Template

```typescript
// packages/api/src/events/entity-event.handler.ts
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EntityService } from '../services/entity.service';
import { NotificationService } from '../services/notification.service';
import { ActivityService } from '../services/activity.service';
import { SearchService } from '../services/search.service';
import { AnalyticsService } from '../services/analytics.service';

interface EntityEvent {
  entity: any;
  userId: string;
  workspaceId: string;
  metadata?: any;
}

@Injectable()
export class EntityEventHandler {
  private readonly logger = new Logger(EntityEventHandler.name);

  constructor(
    private readonly entityService: EntityService,
    private readonly notificationService: NotificationService,
    private readonly activityService: ActivityService,
    private readonly searchService: SearchService,
    private readonly analyticsService: AnalyticsService
  ) {}

  @OnEvent('entity.created', { async: true })
  async handleEntityCreated(event: EntityEvent) {
    this.logger.debug(`Handling entity.created event for ${event.entity.id}`);

    try {
      // Create activity log
      await this.activityService.create({
        type: 'entity.created',
        entityType: 'entity',
        entityId: event.entity.id,
        userId: event.userId,
        workspaceId: event.workspaceId,
        data: {
          entityName: event.entity.name,
        },
      });

      // Index in search engine
      await this.searchService.index('entities', event.entity);

      // Send notifications
      await this.sendCreationNotifications(event);

      // Track analytics
      await this.analyticsService.track({
        event: 'entity_created',
        userId: event.userId,
        properties: {
          entityId: event.entity.id,
          entityType: event.entity.type,
          source: event.metadata?.source,
        },
      });

      // Trigger automation workflows
      await this.triggerAutomations('entity.created', event);
    } catch (error) {
      this.logger.error(`Failed to handle entity.created event:`, error);
      // Don't throw - event handlers should not fail the main operation
    }
  }

  @OnEvent('entity.updated', { async: true })
  async handleEntityUpdated(event: EntityEvent & { previous: any }) {
    this.logger.debug(`Handling entity.updated event for ${event.entity.id}`);

    try {
      // Determine what changed
      const changes = this.detectChanges(event.previous, event.entity);

      // Create activity log with changes
      await this.activityService.create({
        type: 'entity.updated',
        entityType: 'entity',
        entityId: event.entity.id,
        userId: event.userId,
        workspaceId: event.workspaceId,
        data: {
          changes,
        },
      });

      // Update search index
      await this.searchService.update('entities', event.entity.id, event.entity);

      // Send notifications for important changes
      if (this.hasImportantChanges(changes)) {
        await this.sendUpdateNotifications(event, changes);
      }

      // Track analytics
      await this.analyticsService.track({
        event: 'entity_updated',
        userId: event.userId,
        properties: {
          entityId: event.entity.id,
          changes: Object.keys(changes),
        },
      });

      // Trigger automation workflows
      await this.triggerAutomations('entity.updated', event, changes);
    } catch (error) {
      this.logger.error(`Failed to handle entity.updated event:`, error);
    }
  }

  @OnEvent('entity.deleted', { async: true })
  async handleEntityDeleted(event: EntityEvent) {
    this.logger.debug(`Handling entity.deleted event for ${event.entity.id}`);

    try {
      // Create activity log
      await this.activityService.create({
        type: 'entity.deleted',
        entityType: 'entity',
        entityId: event.entity.id,
        userId: event.userId,
        workspaceId: event.workspaceId,
        data: {
          entityName: event.entity.name,
          deletedBy: event.userId,
        },
      });

      // Remove from search index
      await this.searchService.delete('entities', event.entity.id);

      // Send notifications
      await this.sendDeletionNotifications(event);

      // Track analytics
      await this.analyticsService.track({
        event: 'entity_deleted',
        userId: event.userId,
        properties: {
          entityId: event.entity.id,
          entityType: event.entity.type,
        },
      });

      // Clean up related data
      await this.cleanupRelatedData(event.entity);
    } catch (error) {
      this.logger.error(`Failed to handle entity.deleted event:`, error);
    }
  }

  @OnEvent('entity.bulk.imported', { async: true })
  async handleBulkImport(event: { entities: any[]; userId: string; workspaceId: string }) {
    this.logger.debug(`Handling bulk import of ${event.entities.length} entities`);

    try {
      // Batch index in search engine
      await this.searchService.bulkIndex('entities', event.entities);

      // Create summary activity
      await this.activityService.create({
        type: 'entity.bulk.imported',
        entityType: 'workspace',
        entityId: event.workspaceId,
        userId: event.userId,
        workspaceId: event.workspaceId,
        data: {
          count: event.entities.length,
          entityIds: event.entities.map(e => e.id),
        },
      });

      // Send notification
      await this.notificationService.send({
        userId: event.userId,
        type: 'bulk_import_completed',
        data: {
          count: event.entities.length,
          entityType: 'entities',
        },
      });
    } catch (error) {
      this.logger.error(`Failed to handle bulk import event:`, error);
    }
  }

  private detectChanges(previous: any, current: any): Record<string, any> {
    const changes: Record<string, any> = {};
    
    Object.keys(current).forEach(key => {
      if (JSON.stringify(previous[key]) !== JSON.stringify(current[key])) {
        changes[key] = {
          from: previous[key],
          to: current[key],
        };
      }
    });

    return changes;
  }

  private hasImportantChanges(changes: Record<string, any>): boolean {
    const importantFields = ['status', 'assignedTo', 'priority', 'value'];
    return Object.keys(changes).some(key => importantFields.includes(key));
  }

  private async sendCreationNotifications(event: EntityEvent) {
    // Notify assigned user
    if (event.entity.assignedToId && event.entity.assignedToId !== event.userId) {
      await this.notificationService.send({
        userId: event.entity.assignedToId,
        type: 'entity_assigned',
        data: {
          entityId: event.entity.id,
          entityName: event.entity.name,
          assignedBy: event.userId,
        },
      });
    }

    // Notify workspace admins
    const admins = await this.getWorkspaceAdmins(event.workspaceId);
    for (const admin of admins) {
      if (admin.id !== event.userId) {
        await this.notificationService.send({
          userId: admin.id,
          type: 'entity_created',
          data: {
            entityId: event.entity.id,
            entityName: event.entity.name,
            createdBy: event.userId,
          },
        });
      }
    }
  }

  private async sendUpdateNotifications(
    event: EntityEvent & { previous: any },
    changes: Record<string, any>
  ) {
    // Notify about assignment changes
    if (changes.assignedToId) {
      // Notify newly assigned user
      if (changes.assignedToId.to) {
        await this.notificationService.send({
          userId: changes.assignedToId.to,
          type: 'entity_assigned',
          data: {
            entityId: event.entity.id,
            entityName: event.entity.name,
            assignedBy: event.userId,
          },
        });
      }

      // Notify previously assigned user
      if (changes.assignedToId.from) {
        await this.notificationService.send({
          userId: changes.assignedToId.from,
          type: 'entity_unassigned',
          data: {
            entityId: event.entity.id,
            entityName: event.entity.name,
          },
        });
      }
    }

    // Notify about status changes
    if (changes.status) {
      await this.notifyStatusChange(event, changes.status);
    }
  }

  private async sendDeletionNotifications(event: EntityEvent) {
    // Notify assigned user
    if (event.entity.assignedToId && event.entity.assignedToId !== event.userId) {
      await this.notificationService.send({
        userId: event.entity.assignedToId,
        type: 'entity_deleted',
        data: {
          entityName: event.entity.name,
          deletedBy: event.userId,
        },
      });
    }
  }

  private async triggerAutomations(
    eventType: string,
    event: EntityEvent,
    changes?: Record<string, any>
  ) {
    // Get active automations for this event
    const automations = await this.getActiveAutomations(
      event.workspaceId,
      eventType
    );

    for (const automation of automations) {
      if (this.matchesConditions(automation.conditions, event, changes)) {
        await this.executeAutomation(automation, event);
      }
    }
  }

  private async cleanupRelatedData(entity: any) {
    // Clean up related records that should be deleted
    await Promise.all([
      this.activityService.deleteByEntity(entity.id),
      this.notificationService.deleteByEntity(entity.id),
      // Add other cleanup tasks
    ]);
  }

  private async getWorkspaceAdmins(workspaceId: string) {
    // Implementation to get workspace admins
    return [];
  }

  private async notifyStatusChange(event: EntityEvent, statusChange: any) {
    // Implementation for status change notifications
  }

  private async getActiveAutomations(workspaceId: string, eventType: string) {
    // Implementation to get active automations
    return [];
  }

  private matchesConditions(conditions: any, event: EntityEvent, changes?: any): boolean {
    // Implementation to check automation conditions
    return true;
  }

  private async executeAutomation(automation: any, event: EntityEvent) {
    // Implementation to execute automation
  }
}
```

## External API Client Template

```typescript
// packages/api/src/clients/external-api.client.ts
import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { CircuitBreaker, RetryStrategy } from '@hastecrm/common';
import { CacheService } from '../services/cache.service';
import { MetricsService } from '../services/metrics.service';

interface ApiClientConfig {
  baseUrl: string;
  apiKey: string;
  timeout?: number;
  retries?: number;
}

@Injectable()
export class ExternalApiClient {
  private readonly logger = new Logger(ExternalApiClient.name);
  private readonly circuitBreaker: CircuitBreaker;
  private readonly config: ApiClientConfig;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly cacheService: CacheService,
    private readonly metricsService: MetricsService
  ) {
    this.config = {
      baseUrl: this.configService.get('EXTERNAL_API_BASE_URL'),
      apiKey: this.configService.get('EXTERNAL_API_KEY'),
      timeout: this.configService.get('EXTERNAL_API_TIMEOUT', 30000),
      retries: this.configService.get('EXTERNAL_API_RETRIES', 3),
    };

    this.circuitBreaker = new CircuitBreaker({
      name: 'external-api',
      failureThreshold: 5,
      resetTimeout: 60000,
      monitoringPeriod: 60000,
      halfOpenLimit: 3,
    });
  }

  async getEntity(id: string): Promise<any> {
    const cacheKey = `external:entity:${id}`;
    const timer = this.metricsService.startTimer('external.api.get.duration');

    try {
      // Check cache first
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        this.metricsService.incrementCounter('external.api.cache.hits');
        timer.end({ status: 'cache_hit' });
        return cached;
      }

      this.metricsService.incrementCounter('external.api.cache.misses');

      // Make API call through circuit breaker
      const result = await this.circuitBreaker.execute(() =>
        this.makeRequest('GET', `/entities/${id}`)
      );

      // Cache successful response
      await this.cacheService.set(cacheKey, result, 3600); // 1 hour cache

      timer.end({ status: 'success' });
      return result;
    } catch (error) {
      timer.end({ status: 'error' });
      this.handleApiError(error, 'getEntity');
    }
  }

  async createEntity(data: any): Promise<any> {
    const timer = this.metricsService.startTimer('external.api.create.duration');

    try {
      const result = await this.circuitBreaker.execute(() =>
        this.makeRequest('POST', '/entities', data)
      );

      timer.end({ status: 'success' });
      return result;
    } catch (error) {
      timer.end({ status: 'error' });
      this.handleApiError(error, 'createEntity');
    }
  }

  async updateEntity(id: string, data: any): Promise<any> {
    const timer = this.metricsService.startTimer('external.api.update.duration');

    try {
      const result = await this.circuitBreaker.execute(() =>
        this.makeRequest('PUT', `/entities/${id}`, data)
      );

      // Invalidate cache
      await this.cacheService.delete(`external:entity:${id}`);

      timer.end({ status: 'success' });
      return result;
    } catch (error) {
      timer.end({ status: 'error' });
      this.handleApiError(error, 'updateEntity');
    }
  }

  async searchEntities(query: string, options?: any): Promise<any> {
    const timer = this.metricsService.startTimer('external.api.search.duration');
    const cacheKey = `external:search:${JSON.stringify({ query, options })}`;

    try {
      // Check cache for search results
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        timer.end({ status: 'cache_hit' });
        return cached;
      }

      const result = await this.circuitBreaker.execute(() =>
        this.makeRequest('GET', '/entities/search', null, { q: query, ...options })
      );

      // Cache search results for shorter duration
      await this.cacheService.set(cacheKey, result, 300); // 5 minutes

      timer.end({ status: 'success' });
      return result;
    } catch (error) {
      timer.end({ status: 'error' });
      this.handleApiError(error, 'searchEntities');
    }
  }

  async batchOperation(operations: any[]): Promise<any> {
    const timer = this.metricsService.startTimer('external.api.batch.duration');

    try {
      // Process in chunks to avoid overwhelming the API
      const chunkSize = 100;
      const results = [];

      for (let i = 0; i < operations.length; i += chunkSize) {
        const chunk = operations.slice(i, i + chunkSize);
        
        const chunkResult = await this.circuitBreaker.execute(() =>
          this.makeRequest('POST', '/batch', { operations: chunk })
        );

        results.push(...chunkResult.results);

        // Add delay between chunks to respect rate limits
        if (i + chunkSize < operations.length) {
          await this.delay(1000);
        }
      }

      timer.end({ status: 'success', count: operations.length });
      return { results };
    } catch (error) {
      timer.end({ status: 'error' });
      this.handleApiError(error, 'batchOperation');
    }
  }

  private async makeRequest(
    method: string,
    path: string,
    data?: any,
    params?: any
  ): Promise<any> {
    const url = `${this.config.baseUrl}${path}`;
    const headers = {
      'Authorization': `Bearer ${this.config.apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'HasteCRM/1.0',
    };

    return RetryStrategy.execute(
      async () => {
        const response = await firstValueFrom(
          this.httpService.request({
            method,
            url,
            data,
            params,
            headers,
            timeout: this.config.timeout,
          })
        );

        // Log successful API calls
        this.logger.debug(`API call successful: ${method} ${path}`);
        this.metricsService.incrementCounter('external.api.requests.total', {
          method,
          status: response.status,
        });

        return response.data;
      },
      {
        maxAttempts: this.config.retries,
        delay: 1000,
        factor: 2,
        jitter: true,
        retryCondition: (error) => {
          // Retry on network errors or 5xx responses
          if (!error.response) return true;
          return error.response.status >= 500;
        },
      }
    );
  }

  private handleApiError(error: any, operation: string): never {
    this.logger.error(`External API error in ${operation}:`, error);
    this.metricsService.incrementCounter('external.api.errors.total', {
      operation,
      error: error.code || 'unknown',
    });

    // Map external API errors to our error types
    if (error.response) {
      const status = error.response.status;
      const message = error.response.data?.message || error.message;

      switch (status) {
        case 400:
          throw new ValidationError(`External API validation error: ${message}`);
        case 401:
          throw new AuthenticationError('External API authentication failed');
        case 403:
          throw new AuthorizationError('External API access denied');
        case 404:
          throw new NotFoundError('External resource');
        case 429:
          throw new RateLimitError(
            error.response.headers['retry-after'] || 60,
            100,
            0
          );
        default:
          throw new ExternalServiceError('External API', error);
      }
    }

    throw new ExternalServiceError('External API', error);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      await this.makeRequest('GET', '/health');
      return true;
    } catch {
      return false;
    }
  }

  // Get circuit breaker status
  getStatus() {
    return {
      circuitBreaker: this.circuitBreaker.getStats(),
      config: {
        baseUrl: this.config.baseUrl,
        timeout: this.config.timeout,
        retries: this.config.retries,
      },
    };
  }
}
```

## Cache Service Template

```typescript
// packages/api/src/services/cache.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { MetricsService } from './metrics.service';

interface CacheOptions {
  ttl?: number;
  tags?: string[];
  compress?: boolean;
}

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly redis: Redis;
  private readonly defaultTTL = 3600; // 1 hour

  constructor(
    private readonly configService: ConfigService,
    private readonly metricsService: MetricsService
  ) {
    this.redis = new Redis({
      host: this.configService.get('REDIS_HOST'),
      port: this.configService.get('REDIS_PORT'),
      password: this.configService.get('REDIS_PASSWORD'),
      db: this.configService.get('REDIS_DB', 0),
      keyPrefix: 'hastecrm:',
    });

    this.redis.on('error', (error) => {
      this.logger.error('Redis error:', error);
      this.metricsService.incrementCounter('cache.errors.total');
    });
  }

  async get<T>(key: string): Promise<T | null> {
    const timer = this.metricsService.startTimer('cache.get.duration');

    try {
      const value = await this.redis.get(key);
      
      if (!value) {
        timer.end({ status: 'miss' });
        return null;
      }

      timer.end({ status: 'hit' });
      return this.deserialize<T>(value);
    } catch (error) {
      timer.end({ status: 'error' });
      this.logger.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  async set(
    key: string,
    value: any,
    ttlOrOptions?: number | CacheOptions
  ): Promise<void> {
    const timer = this.metricsService.startTimer('cache.set.duration');

    try {
      const options = this.normalizeOptions(ttlOrOptions);
      const serialized = this.serialize(value, options.compress);

      if (options.ttl) {
        await this.redis.setex(key, options.ttl, serialized);
      } else {
        await this.redis.set(key, serialized);
      }

      // Add to tags for bulk invalidation
      if (options.tags?.length) {
        await this.addToTags(key, options.tags);
      }

      timer.end({ status: 'success' });
    } catch (error) {
      timer.end({ status: 'error' });
      this.logger.error(`Cache set error for key ${key}:`, error);
    }
  }

  async delete(pattern: string): Promise<number> {
    const timer = this.metricsService.startTimer('cache.delete.duration');

    try {
      let count = 0;

      // Handle wildcard patterns
      if (pattern.includes('*')) {
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
          count = await this.redis.del(...keys);
        }
      } else {
        count = await this.redis.del(pattern);
      }

      timer.end({ status: 'success', count });
      return count;
    } catch (error) {
      timer.end({ status: 'error' });
      this.logger.error(`Cache delete error for pattern ${pattern}:`, error);
      return 0;
    }
  }

  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    const timer = this.metricsService.startTimer('cache.mget.duration');

    try {
      const values = await this.redis.mget(...keys);
      
      const results = values.map((value) => {
        if (!value) return null;
        try {
          return this.deserialize<T>(value);
        } catch {
          return null;
        }
      });

      const hits = results.filter(r => r !== null).length;
      timer.end({ status: 'success', hits, total: keys.length });
      
      return results;
    } catch (error) {
      timer.end({ status: 'error' });
      this.logger.error('Cache mget error:', error);
      return keys.map(() => null);
    }
  }

  async mset(items: Array<{ key: string; value: any; ttl?: number }>): Promise<void> {
    const timer = this.metricsService.startTimer('cache.mset.duration');

    try {
      const pipeline = this.redis.pipeline();

      items.forEach(({ key, value, ttl }) => {
        const serialized = this.serialize(value);
        if (ttl) {
          pipeline.setex(key, ttl, serialized);
        } else {
          pipeline.set(key, serialized);
        }
      });

      await pipeline.exec();
      timer.end({ status: 'success', count: items.length });
    } catch (error) {
      timer.end({ status: 'error' });
      this.logger.error('Cache mset error:', error);
    }
  }

  async invalidateByTags(tags: string[]): Promise<number> {
    const timer = this.metricsService.startTimer('cache.invalidate.duration');

    try {
      const keys = new Set<string>();

      // Get all keys for each tag
      for (const tag of tags) {
        const tagKeys = await this.redis.smembers(`tag:${tag}`);
        tagKeys.forEach(key => keys.add(key));
      }

      // Delete all keys
      let count = 0;
      if (keys.size > 0) {
        count = await this.redis.del(...Array.from(keys));
      }

      // Clean up tag sets
      await this.redis.del(...tags.map(tag => `tag:${tag}`));

      timer.end({ status: 'success', count });
      return count;
    } catch (error) {
      timer.end({ status: 'error' });
      this.logger.error('Cache invalidate by tags error:', error);
      return 0;
    }
  }

  async remember<T>(
    key: string,
    factory: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    // Try to get from cache
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Generate value
    const value = await factory();

    // Store in cache
    await this.set(key, value, ttl);

    return value;
  }

  async increment(key: string, amount = 1): Promise<number> {
    return this.redis.incrby(key, amount);
  }

  async decrement(key: string, amount = 1): Promise<number> {
    return this.redis.decrby(key, amount);
  }

  async expire(key: string, ttl: number): Promise<boolean> {
    const result = await this.redis.expire(key, ttl);
    return result === 1;
  }

  async ttl(key: string): Promise<number> {
    return this.redis.ttl(key);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.redis.exists(key);
    return result === 1;
  }

  async flush(): Promise<void> {
    await this.redis.flushdb();
  }

  private serialize(value: any, compress = false): string {
    const json = JSON.stringify(value);
    
    if (compress && json.length > 1024) {
      // Implement compression if needed
      return json;
    }
    
    return json;
  }

  private deserialize<T>(value: string): T {
    try {
      return JSON.parse(value);
    } catch {
      // Handle compressed data if implemented
      return JSON.parse(value);
    }
  }

  private normalizeOptions(
    ttlOrOptions?: number | CacheOptions
  ): Required<CacheOptions> {
    if (typeof ttlOrOptions === 'number') {
      return {
        ttl: ttlOrOptions,
        tags: [],
        compress: false,
      };
    }

    return {
      ttl: ttlOrOptions?.ttl || this.defaultTTL,
      tags: ttlOrOptions?.tags || [],
      compress: ttlOrOptions?.compress || false,
    };
  }

  private async addToTags(key: string, tags: string[]): Promise<void> {
    const pipeline = this.redis.pipeline();

    tags.forEach(tag => {
      pipeline.sadd(`tag:${tag}`, key);
    });

    await pipeline.exec();
  }
}
```

## File Storage Service Template

```typescript
// packages/api/src/services/file-storage.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { MetricsService } from './metrics.service';
import { v4 as uuidv4 } from 'uuid';
import * as mime from 'mime-types';
import { Readable } from 'stream';

interface UploadOptions {
  folder?: string;
  filename?: string;
  contentType?: string;
  metadata?: Record<string, string>;
  public?: boolean;
  expiresIn?: number;
}

interface FileInfo {
  key: string;
  url: string;
  size: number;
  contentType: string;
  metadata?: Record<string, string>;
}

@Injectable()
export class FileStorageService {
  private readonly logger = new Logger(FileStorageService.name);
  private readonly s3Client: S3Client;
  private readonly bucket: string;
  private readonly cdnUrl?: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly metricsService: MetricsService
  ) {
    this.s3Client = new S3Client({
      region: this.configService.get('AWS_REGION'),
      credentials: {
        accessKeyId: this.configService.get('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.get('AWS_SECRET_ACCESS_KEY'),
      },
    });

    this.bucket = this.configService.get('AWS_S3_BUCKET');
    this.cdnUrl = this.configService.get('CDN_URL');
  }

  async upload(
    file: Buffer | Readable,
    options: UploadOptions = {}
  ): Promise<FileInfo> {
    const timer = this.metricsService.startTimer('storage.upload.duration');

    try {
      const key = this.generateKey(options.folder, options.filename);
      const contentType = options.contentType || 'application/octet-stream';

      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file,
        ContentType: contentType,
        Metadata: options.metadata,
        ...(options.public && {
          ACL: 'public-read',
        }),
      });

      await this.s3Client.send(command);

      const size = Buffer.isBuffer(file) ? file.length : 0;
      const url = await this.getUrl(key, options.public);

      timer.end({ status: 'success', size });
      this.metricsService.incrementCounter('storage.uploads.total');

      return {
        key,
        url,
        size,
        contentType,
        metadata: options.metadata,
      };
    } catch (error) {
      timer.end({ status: 'error' });
      this.metricsService.incrementCounter('storage.errors.total');
      this.logger.error('Upload failed:', error);
      throw error;
    }
  }

  async download(key: string): Promise<Buffer> {
    const timer = this.metricsService.startTimer('storage.download.duration');

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const response = await this.s3Client.send(command);
      const stream = response.Body as Readable;
      const chunks: Buffer[] = [];

      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      const buffer = Buffer.concat(chunks);
      timer.end({ status: 'success', size: buffer.length });
      
      return buffer;
    } catch (error) {
      timer.end({ status: 'error' });
      this.logger.error(`Download failed for key ${key}:`, error);
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    const timer = this.metricsService.startTimer('storage.delete.duration');

    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.s3Client.send(command);
      timer.end({ status: 'success' });
    } catch (error) {
      timer.end({ status: 'error' });
      this.logger.error(`Delete failed for key ${key}:`, error);
      throw error;
    }
  }

  async getSignedUrl(
    key: string,
    expiresIn = 3600
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return getSignedUrl(this.s3Client, command, { expiresIn });
  }

  async getUploadUrl(
    options: UploadOptions = {}
  ): Promise<{ url: string; key: string; fields: Record<string, string> }> {
    const key = this.generateKey(options.folder, options.filename);
    const expiresIn = options.expiresIn || 3600;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: options.contentType,
      Metadata: options.metadata,
    });

    const url = await getSignedUrl(this.s3Client, command, { expiresIn });

    return {
      url,
      key,
      fields: {
        key,
        'Content-Type': options.contentType || 'application/octet-stream',
      },
    };
  }

  async processImage(
    key: string,
    transformations: ImageTransformations
  ): Promise<FileInfo> {
    // Implement image processing logic
    // This could use AWS Lambda or a service like ImageKit
    throw new Error('Not implemented');
  }

  private generateKey(folder?: string, filename?: string): string {
    const uuid = uuidv4();
    const name = filename || uuid;
    const extension = mime.extension(mime.lookup(name) || 'application/octet-stream');
    
    const parts = [
      folder,
      new Date().toISOString().split('T')[0], // Date-based organization
      `${uuid}.${extension}`,
    ].filter(Boolean);

    return parts.join('/');
  }

  private async getUrl(key: string, isPublic?: boolean): Promise<string> {
    if (isPublic && this.cdnUrl) {
      return `${this.cdnUrl}/${key}`;
    }

    if (isPublic) {
      return `https://${this.bucket}.s3.amazonaws.com/${key}`;
    }

    return this.getSignedUrl(key);
  }
}

interface ImageTransformations {
  width?: number;
  height?: number;
  format?: 'jpeg' | 'png' | 'webp';
  quality?: number;
}
```

This comprehensive service implementation templates guide provides all the patterns needed for building consistent, production-ready services in hasteCRM.