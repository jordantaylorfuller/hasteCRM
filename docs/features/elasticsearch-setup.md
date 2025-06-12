# Elasticsearch Setup and Configuration

## Overview

This document provides complete Elasticsearch setup, mapping files, and implementation details for hasteCRM's search functionality.

## Table of Contents

1. [Elasticsearch Installation](#elasticsearch-installation)
2. [Index Mappings](#index-mappings)
3. [Search Implementation](#search-implementation)
4. [Query Patterns](#query-patterns)
5. [Performance Optimization](#performance-optimization)
6. [Monitoring and Maintenance](#monitoring-and-maintenance)

## Elasticsearch Installation

### Docker Compose Configuration

```yaml
# docker-compose.yml
version: '3.8'

services:
  elasticsearch:
    image: elasticsearch:8.11.1
    container_name: hastecrm-elasticsearch
    environment:
      - discovery.type=single-node
      - cluster.name=hastecrm-cluster
      - node.name=hastecrm-node
      - xpack.security.enabled=true
      - xpack.security.enrollment.enabled=true
      - ELASTIC_PASSWORD=${ELASTIC_PASSWORD:-changeme}
      - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
    ulimits:
      memlock:
        soft: -1
        hard: -1
    volumes:
      - elasticsearch-data:/usr/share/elasticsearch/data
      - ./elasticsearch/config/elasticsearch.yml:/usr/share/elasticsearch/config/elasticsearch.yml
    ports:
      - "9200:9200"
      - "9300:9300"
    networks:
      - hastecrm-network
    healthcheck:
      test: ["CMD-SHELL", "curl -s -u elastic:${ELASTIC_PASSWORD:-changeme} http://localhost:9200/_cluster/health || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 5

  kibana:
    image: kibana:8.11.1
    container_name: hastecrm-kibana
    environment:
      - SERVERNAME=kibana
      - ELASTICSEARCH_HOSTS=http://elasticsearch:9200
      - ELASTICSEARCH_USERNAME=elastic
      - ELASTICSEARCH_PASSWORD=${ELASTIC_PASSWORD:-changeme}
    ports:
      - "5601:5601"
    networks:
      - hastecrm-network
    depends_on:
      elasticsearch:
        condition: service_healthy

volumes:
  elasticsearch-data:

networks:
  hastecrm-network:
    driver: bridge
```

### Elasticsearch Configuration

```yaml
# elasticsearch/config/elasticsearch.yml
cluster.name: hastecrm-cluster
node.name: hastecrm-node

# Network settings
network.host: 0.0.0.0
http.port: 9200

# Discovery settings
discovery.type: single-node

# Memory settings
indices.memory.index_buffer_size: 30%
indices.queries.cache.size: 20%

# Performance settings
thread_pool:
  write:
    size: 4
    queue_size: 1000
  search:
    size: 4
    queue_size: 1000

# Security settings
xpack.security.enabled: true
xpack.security.authc:
  anonymous:
    authz_exception: false
    roles: anonymous
```

## Index Mappings

### Contacts Index Mapping

```json
// elasticsearch/mappings/contacts.json
{
  "settings": {
    "number_of_shards": 1,
    "number_of_replicas": 1,
    "analysis": {
      "analyzer": {
        "name_analyzer": {
          "type": "custom",
          "tokenizer": "standard",
          "filter": ["lowercase", "asciifolding", "name_edge_ngram"]
        },
        "email_analyzer": {
          "type": "custom",
          "tokenizer": "email_tokenizer",
          "filter": ["lowercase", "unique"]
        },
        "phone_analyzer": {
          "type": "custom",
          "tokenizer": "phone_tokenizer",
          "filter": ["phone_filter"]
        }
      },
      "tokenizer": {
        "email_tokenizer": {
          "type": "pattern",
          "pattern": "([a-zA-Z0-9._-]+|@|\\.[a-zA-Z]+)"
        },
        "phone_tokenizer": {
          "type": "pattern",
          "pattern": "[^0-9]+"
        }
      },
      "filter": {
        "name_edge_ngram": {
          "type": "edge_ngram",
          "min_gram": 2,
          "max_gram": 20
        },
        "phone_filter": {
          "type": "pattern_replace",
          "pattern": "[^0-9]",
          "replacement": ""
        }
      }
    }
  },
  "mappings": {
    "properties": {
      "id": {
        "type": "keyword"
      },
      "workspaceId": {
        "type": "keyword"
      },
      "firstName": {
        "type": "text",
        "analyzer": "name_analyzer",
        "fields": {
          "keyword": {
            "type": "keyword",
            "normalizer": "lowercase"
          }
        }
      },
      "lastName": {
        "type": "text",
        "analyzer": "name_analyzer",
        "fields": {
          "keyword": {
            "type": "keyword",
            "normalizer": "lowercase"
          }
        }
      },
      "fullName": {
        "type": "text",
        "analyzer": "name_analyzer",
        "fields": {
          "keyword": {
            "type": "keyword",
            "normalizer": "lowercase"
          }
        }
      },
      "email": {
        "type": "text",
        "analyzer": "email_analyzer",
        "fields": {
          "keyword": {
            "type": "keyword",
            "normalizer": "lowercase"
          }
        }
      },
      "phone": {
        "type": "text",
        "analyzer": "phone_analyzer",
        "fields": {
          "keyword": {
            "type": "keyword"
          }
        }
      },
      "title": {
        "type": "text",
        "fields": {
          "keyword": {
            "type": "keyword"
          }
        }
      },
      "company": {
        "properties": {
          "id": {
            "type": "keyword"
          },
          "name": {
            "type": "text",
            "fields": {
              "keyword": {
                "type": "keyword"
              }
            }
          },
          "domain": {
            "type": "keyword"
          },
          "industry": {
            "type": "keyword"
          }
        }
      },
      "tags": {
        "type": "nested",
        "properties": {
          "id": {
            "type": "keyword"
          },
          "name": {
            "type": "keyword"
          }
        }
      },
      "customFields": {
        "type": "object",
        "dynamic": true
      },
      "source": {
        "type": "keyword"
      },
      "score": {
        "type": "float"
      },
      "lastActivityAt": {
        "type": "date"
      },
      "createdAt": {
        "type": "date"
      },
      "updatedAt": {
        "type": "date"
      },
      "location": {
        "properties": {
          "city": {
            "type": "keyword"
          },
          "state": {
            "type": "keyword"
          },
          "country": {
            "type": "keyword"
          },
          "coordinates": {
            "type": "geo_point"
          }
        }
      }
    }
  }
}
```

### Emails Index Mapping

```json
// elasticsearch/mappings/emails.json
{
  "settings": {
    "number_of_shards": 2,
    "number_of_replicas": 1,
    "analysis": {
      "analyzer": {
        "email_content_analyzer": {
          "type": "custom",
          "tokenizer": "standard",
          "char_filter": ["html_strip"],
          "filter": ["lowercase", "stop", "snowball"]
        }
      }
    }
  },
  "mappings": {
    "properties": {
      "id": {
        "type": "keyword"
      },
      "workspaceId": {
        "type": "keyword"
      },
      "threadId": {
        "type": "keyword"
      },
      "subject": {
        "type": "text",
        "analyzer": "standard",
        "fields": {
          "keyword": {
            "type": "keyword"
          }
        }
      },
      "from": {
        "properties": {
          "email": {
            "type": "keyword",
            "normalizer": "lowercase"
          },
          "name": {
            "type": "text"
          }
        }
      },
      "to": {
        "type": "nested",
        "properties": {
          "email": {
            "type": "keyword",
            "normalizer": "lowercase"
          },
          "name": {
            "type": "text"
          }
        }
      },
      "cc": {
        "type": "nested",
        "properties": {
          "email": {
            "type": "keyword",
            "normalizer": "lowercase"
          },
          "name": {
            "type": "text"
          }
        }
      },
      "body": {
        "type": "text",
        "analyzer": "email_content_analyzer"
      },
      "snippet": {
        "type": "text"
      },
      "attachments": {
        "type": "nested",
        "properties": {
          "id": {
            "type": "keyword"
          },
          "filename": {
            "type": "text",
            "fields": {
              "keyword": {
                "type": "keyword"
              }
            }
          },
          "mimeType": {
            "type": "keyword"
          },
          "size": {
            "type": "long"
          }
        }
      },
      "labels": {
        "type": "keyword"
      },
      "isRead": {
        "type": "boolean"
      },
      "isStarred": {
        "type": "boolean"
      },
      "sentAt": {
        "type": "date"
      },
      "receivedAt": {
        "type": "date"
      }
    }
  }
}
```

### Activities Index Mapping

```json
// elasticsearch/mappings/activities.json
{
  "settings": {
    "number_of_shards": 1,
    "number_of_replicas": 1
  },
  "mappings": {
    "properties": {
      "id": {
        "type": "keyword"
      },
      "workspaceId": {
        "type": "keyword"
      },
      "type": {
        "type": "keyword"
      },
      "contactId": {
        "type": "keyword"
      },
      "userId": {
        "type": "keyword"
      },
      "title": {
        "type": "text"
      },
      "description": {
        "type": "text"
      },
      "metadata": {
        "type": "object",
        "dynamic": true
      },
      "createdAt": {
        "type": "date"
      }
    }
  }
}
```

## Search Implementation

### Elasticsearch Service

```typescript
// packages/api/src/elasticsearch/elasticsearch.service.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Client } from '@elastic/elasticsearch';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class ElasticsearchService implements OnModuleInit {
  private readonly logger = new Logger(ElasticsearchService.name);
  private client: Client;

  constructor(private configService: ConfigService) {
    this.client = new Client({
      node: this.configService.get('ELASTICSEARCH_URL'),
      auth: {
        username: this.configService.get('ELASTICSEARCH_USERNAME'),
        password: this.configService.get('ELASTICSEARCH_PASSWORD'),
      },
    });
  }

  async onModuleInit() {
    await this.checkConnection();
    await this.createIndices();
  }

  private async checkConnection() {
    try {
      const health = await this.client.cluster.health();
      this.logger.log(`Elasticsearch cluster health: ${health.status}`);
    } catch (error) {
      this.logger.error('Failed to connect to Elasticsearch', error);
      throw error;
    }
  }

  private async createIndices() {
    const indices = ['contacts', 'emails', 'activities'];
    
    for (const index of indices) {
      try {
        const exists = await this.client.indices.exists({ index });
        
        if (!exists) {
          const mappingPath = path.join(
            __dirname,
            `../../../elasticsearch/mappings/${index}.json`
          );
          const mapping = JSON.parse(await fs.readFile(mappingPath, 'utf8'));
          
          await this.client.indices.create({
            index,
            body: mapping,
          });
          
          this.logger.log(`Created index: ${index}`);
        }
      } catch (error) {
        this.logger.error(`Failed to create index ${index}`, error);
      }
    }
  }

  async indexContact(contact: any) {
    return this.client.index({
      index: 'contacts',
      id: contact.id,
      body: {
        ...contact,
        fullName: `${contact.firstName} ${contact.lastName}`.trim(),
      },
      refresh: 'wait_for',
    });
  }

  async bulkIndexContacts(contacts: any[]) {
    const operations = contacts.flatMap((contact) => [
      { index: { _index: 'contacts', _id: contact.id } },
      {
        ...contact,
        fullName: `${contact.firstName} ${contact.lastName}`.trim(),
      },
    ]);

    return this.client.bulk({
      operations,
      refresh: 'wait_for',
    });
  }

  async updateContact(id: string, updates: any) {
    return this.client.update({
      index: 'contacts',
      id,
      body: {
        doc: updates,
      },
      refresh: 'wait_for',
    });
  }

  async deleteContact(id: string) {
    return this.client.delete({
      index: 'contacts',
      id,
      refresh: 'wait_for',
    });
  }

  async searchContacts(params: ContactSearchParams) {
    const { workspaceId, query, filters, sort, from = 0, size = 20 } = params;

    const must: any[] = [
      { term: { workspaceId } },
    ];

    if (query) {
      must.push({
        multi_match: {
          query,
          fields: [
            'fullName^3',
            'firstName^2',
            'lastName^2',
            'email^2',
            'phone',
            'company.name',
            'title',
          ],
          type: 'best_fields',
          fuzziness: 'AUTO',
        },
      });
    }

    // Add filters
    if (filters?.companyIds?.length) {
      must.push({ terms: { 'company.id': filters.companyIds } });
    }

    if (filters?.tags?.length) {
      must.push({
        nested: {
          path: 'tags',
          query: {
            terms: { 'tags.name': filters.tags },
          },
        },
      });
    }

    if (filters?.source) {
      must.push({ term: { source: filters.source } });
    }

    if (filters?.dateRange) {
      must.push({
        range: {
          createdAt: {
            gte: filters.dateRange.from,
            lte: filters.dateRange.to,
          },
        },
      });
    }

    // Build sort
    const sortCriteria = this.buildSort(sort);

    const response = await this.client.search({
      index: 'contacts',
      body: {
        query: { bool: { must } },
        sort: sortCriteria,
        from,
        size,
        highlight: {
          fields: {
            fullName: {},
            email: {},
            'company.name': {},
          },
        },
        aggs: {
          companies: {
            terms: { field: 'company.id', size: 50 },
          },
          tags: {
            nested: { path: 'tags' },
            aggs: {
              tag_names: {
                terms: { field: 'tags.name', size: 50 },
              },
            },
          },
          sources: {
            terms: { field: 'source', size: 10 },
          },
        },
      },
    });

    return {
      hits: response.hits.hits.map((hit) => ({
        ...hit._source,
        _score: hit._score,
        _highlight: hit.highlight,
      })),
      total: response.hits.total.value,
      aggregations: response.aggregations,
    };
  }

  async searchEmails(params: EmailSearchParams) {
    const { workspaceId, query, filters, from = 0, size = 20 } = params;

    const must: any[] = [
      { term: { workspaceId } },
    ];

    if (query) {
      must.push({
        multi_match: {
          query,
          fields: ['subject^2', 'body', 'from.email', 'from.name'],
          type: 'best_fields',
        },
      });
    }

    // Email-specific filters
    if (filters?.threadId) {
      must.push({ term: { threadId: filters.threadId } });
    }

    if (filters?.from) {
      must.push({ term: { 'from.email': filters.from.toLowerCase() } });
    }

    if (filters?.to) {
      must.push({
        nested: {
          path: 'to',
          query: {
            term: { 'to.email': filters.to.toLowerCase() },
          },
        },
      });
    }

    if (filters?.hasAttachments) {
      must.push({
        nested: {
          path: 'attachments',
          query: { exists: { field: 'attachments.id' } },
        },
      });
    }

    if (filters?.labels?.length) {
      must.push({ terms: { labels: filters.labels } });
    }

    if (filters?.dateRange) {
      must.push({
        range: {
          sentAt: {
            gte: filters.dateRange.from,
            lte: filters.dateRange.to,
          },
        },
      });
    }

    const response = await this.client.search({
      index: 'emails',
      body: {
        query: { bool: { must } },
        sort: [{ sentAt: { order: 'desc' } }],
        from,
        size,
        highlight: {
          fields: {
            subject: {},
            body: { fragment_size: 150 },
          },
        },
      },
    });

    return {
      hits: response.hits.hits.map((hit) => ({
        ...hit._source,
        _score: hit._score,
        _highlight: hit.highlight,
      })),
      total: response.hits.total.value,
    };
  }

  async getSuggestions(params: SuggestionParams) {
    const { workspaceId, field, prefix, size = 10 } = params;

    const response = await this.client.search({
      index: 'contacts',
      body: {
        query: {
          bool: {
            must: [
              { term: { workspaceId } },
              { prefix: { [`${field}.keyword`]: prefix.toLowerCase() } },
            ],
          },
        },
        size: 0,
        aggs: {
          suggestions: {
            terms: {
              field: `${field}.keyword`,
              size,
              order: { _count: 'desc' },
            },
          },
        },
      },
    });

    return response.aggregations.suggestions.buckets.map((bucket) => ({
      value: bucket.key,
      count: bucket.doc_count,
    }));
  }

  private buildSort(sort?: SortOption): any[] {
    if (!sort) {
      return [{ _score: { order: 'desc' } }];
    }

    const sortMap: Record<string, any> = {
      relevance: [{ _score: { order: 'desc' } }],
      name: [{ 'fullName.keyword': { order: 'asc' } }],
      email: [{ 'email.keyword': { order: 'asc' } }],
      company: [{ 'company.name.keyword': { order: 'asc' } }],
      created: [{ createdAt: { order: 'desc' } }],
      updated: [{ updatedAt: { order: 'desc' } }],
      activity: [{ lastActivityAt: { order: 'desc' } }],
    };

    return sortMap[sort] || [{ _score: { order: 'desc' } }];
  }
}
```

### Search Controller

```typescript
// packages/api/src/search/search.controller.ts
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SearchService } from './search.service';
import { GlobalSearchDto, ContactSearchDto, EmailSearchDto } from './dto';

@ApiTags('search')
@Controller('search')
@UseGuards(JwtAuthGuard)
export class SearchController {
  constructor(private searchService: SearchService) {}

  @Get()
  @ApiOperation({ summary: 'Global search across all entities' })
  async globalSearch(
    @Query() dto: GlobalSearchDto,
    @CurrentUser() user: User
  ) {
    return this.searchService.globalSearch(dto, user.workspaceId);
  }

  @Get('contacts')
  @ApiOperation({ summary: 'Search contacts' })
  async searchContacts(
    @Query() dto: ContactSearchDto,
    @CurrentUser() user: User
  ) {
    return this.searchService.searchContacts(dto, user.workspaceId);
  }

  @Get('emails')
  @ApiOperation({ summary: 'Search emails' })
  async searchEmails(
    @Query() dto: EmailSearchDto,
    @CurrentUser() user: User
  ) {
    return this.searchService.searchEmails(dto, user.workspaceId);
  }

  @Get('suggestions')
  @ApiOperation({ summary: 'Get search suggestions' })
  async getSuggestions(
    @Query('field') field: string,
    @Query('prefix') prefix: string,
    @CurrentUser() user: User
  ) {
    return this.searchService.getSuggestions({
      workspaceId: user.workspaceId,
      field,
      prefix,
    });
  }
}
```

## Query Patterns

### Advanced Search Queries

```typescript
// packages/api/src/elasticsearch/queries/advanced-search.ts
export class AdvancedSearchQueries {
  // Fuzzy search for typo tolerance
  static fuzzyNameSearch(name: string) {
    return {
      match: {
        fullName: {
          query: name,
          fuzziness: 'AUTO',
          prefix_length: 2,
          max_expansions: 50,
        },
      },
    };
  }

  // Phonetic search for name variations
  static phoneticSearch(name: string) {
    return {
      match: {
        'fullName.phonetic': {
          query: name,
          fuzziness: 'AUTO',
        },
      },
    };
  }

  // Email domain search
  static domainSearch(domain: string) {
    return {
      wildcard: {
        'email.keyword': {
          value: `*@${domain}`,
        },
      },
    };
  }

  // Geographic search
  static geoSearch(lat: number, lon: number, distance: string) {
    return {
      geo_distance: {
        distance,
        'location.coordinates': {
          lat,
          lon,
        },
      },
    };
  }

  // Complex boolean search
  static complexSearch(params: ComplexSearchParams) {
    const must: any[] = [];
    const should: any[] = [];
    const must_not: any[] = [];
    const filter: any[] = [];

    // Name search with boosting
    if (params.name) {
      should.push(
        {
          match: {
            fullName: {
              query: params.name,
              boost: 3,
            },
          },
        },
        {
          match: {
            'fullName.phonetic': {
              query: params.name,
              boost: 1,
            },
          },
        }
      );
    }

    // Company filter
    if (params.companies?.length) {
      filter.push({
        terms: {
          'company.id': params.companies,
        },
      });
    }

    // Tag filter with AND logic
    if (params.allTags?.length) {
      params.allTags.forEach((tag) => {
        filter.push({
          nested: {
            path: 'tags',
            query: {
              term: { 'tags.name': tag },
            },
          },
        });
      });
    }

    // Tag filter with OR logic
    if (params.anyTags?.length) {
      filter.push({
        nested: {
          path: 'tags',
          query: {
            terms: { 'tags.name': params.anyTags },
          },
        },
      });
    }

    // Exclude tags
    if (params.excludeTags?.length) {
      must_not.push({
        nested: {
          path: 'tags',
          query: {
            terms: { 'tags.name': params.excludeTags },
          },
        },
      });
    }

    // Score range
    if (params.scoreRange) {
      filter.push({
        range: {
          score: {
            gte: params.scoreRange.min,
            lte: params.scoreRange.max,
          },
        },
      });
    }

    // Activity date range
    if (params.lastActivityRange) {
      filter.push({
        range: {
          lastActivityAt: {
            gte: params.lastActivityRange.from,
            lte: params.lastActivityRange.to,
          },
        },
      });
    }

    return {
      bool: {
        must,
        should,
        must_not,
        filter,
        minimum_should_match: should.length > 0 ? 1 : 0,
      },
    };
  }
}
```

### Aggregation Queries

```typescript
// packages/api/src/elasticsearch/queries/aggregations.ts
export class AggregationQueries {
  static contactStats(workspaceId: string) {
    return {
      query: { term: { workspaceId } },
      size: 0,
      aggs: {
        total_contacts: { value_count: { field: 'id' } },
        by_source: {
          terms: { field: 'source', size: 10 },
        },
        by_company: {
          terms: { field: 'company.id', size: 20 },
          aggs: {
            company_name: {
              top_hits: {
                size: 1,
                _source: ['company.name'],
              },
            },
          },
        },
        score_distribution: {
          histogram: {
            field: 'score',
            interval: 10,
            min_doc_count: 0,
          },
        },
        activity_timeline: {
          date_histogram: {
            field: 'lastActivityAt',
            calendar_interval: 'week',
            min_doc_count: 0,
          },
        },
        top_tags: {
          nested: { path: 'tags' },
          aggs: {
            tag_counts: {
              terms: { field: 'tags.name', size: 20 },
            },
          },
        },
        location_clusters: {
          geohash_grid: {
            field: 'location.coordinates',
            precision: 4,
          },
          aggs: {
            center: {
              geo_centroid: {
                field: 'location.coordinates',
              },
            },
          },
        },
      },
    };
  }

  static emailStats(workspaceId: string, timeRange: string = '30d') {
    return {
      query: {
        bool: {
          must: [
            { term: { workspaceId } },
            {
              range: {
                sentAt: {
                  gte: `now-${timeRange}`,
                },
              },
            },
          ],
        },
      },
      size: 0,
      aggs: {
        emails_over_time: {
          date_histogram: {
            field: 'sentAt',
            calendar_interval: 'day',
          },
          aggs: {
            sent: {
              filter: { term: { 'labels': 'SENT' } },
            },
            received: {
              filter: { term: { 'labels': 'INBOX' } },
            },
          },
        },
        top_senders: {
          terms: {
            field: 'from.email',
            size: 20,
          },
        },
        response_time: {
          avg: {
            script: {
              source: "doc['receivedAt'].value.millis - doc['sentAt'].value.millis",
            },
          },
        },
        attachment_stats: {
          nested: { path: 'attachments' },
          aggs: {
            total_size: {
              sum: { field: 'attachments.size' },
            },
            file_types: {
              terms: { field: 'attachments.mimeType', size: 10 },
            },
          },
        },
      },
    };
  }
}
```

## Performance Optimization

### Bulk Operations

```typescript
// packages/api/src/elasticsearch/bulk-operations.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ElasticsearchService } from './elasticsearch.service';
import { chunk } from 'lodash';

@Injectable()
export class BulkOperationsService {
  private readonly logger = new Logger(BulkOperationsService.name);
  private readonly BATCH_SIZE = 1000;

  constructor(private elasticsearch: ElasticsearchService) {}

  async bulkIndex(index: string, documents: any[]) {
    const batches = chunk(documents, this.BATCH_SIZE);
    let totalIndexed = 0;
    let totalErrors = 0;

    for (const batch of batches) {
      try {
        const operations = batch.flatMap((doc) => [
          { index: { _index: index, _id: doc.id } },
          doc,
        ]);

        const response = await this.elasticsearch.client.bulk({
          operations,
          refresh: false, // Don't refresh immediately for performance
        });

        totalIndexed += response.items.filter((item) => !item.index?.error).length;
        totalErrors += response.items.filter((item) => item.index?.error).length;

        if (response.errors) {
          this.logger.warn(`Bulk index had ${totalErrors} errors`);
          response.items
            .filter((item) => item.index?.error)
            .forEach((item) => {
              this.logger.error(
                `Failed to index document ${item.index?._id}: ${item.index?.error?.reason}`
              );
            });
        }
      } catch (error) {
        this.logger.error(`Bulk index batch failed: ${error.message}`);
        throw error;
      }
    }

    // Refresh index after all batches
    await this.elasticsearch.client.indices.refresh({ index });

    return { indexed: totalIndexed, errors: totalErrors };
  }

  async reindexWithMapping(
    sourceIndex: string,
    targetIndex: string,
    newMapping: any
  ) {
    // Create new index with updated mapping
    await this.elasticsearch.client.indices.create({
      index: targetIndex,
      body: newMapping,
    });

    // Reindex data
    const response = await this.elasticsearch.client.reindex({
      source: { index: sourceIndex },
      dest: { index: targetIndex },
      script: {
        source: `
          // Add any transformation logic here
          ctx._source.reindexedAt = new Date().getTime();
        `,
      },
    });

    this.logger.log(
      `Reindexed ${response.total} documents from ${sourceIndex} to ${targetIndex}`
    );

    return response;
  }

  async updateByQuery(index: string, query: any, script: string) {
    const response = await this.elasticsearch.client.updateByQuery({
      index,
      body: {
        query,
        script: {
          source: script,
          lang: 'painless',
        },
      },
      conflicts: 'proceed',
      wait_for_completion: true,
      refresh: true,
    });

    return {
      updated: response.updated,
      total: response.total,
      failures: response.failures,
    };
  }
}
```

### Search Performance Tips

```typescript
// packages/api/src/elasticsearch/performance/search-optimizer.ts
export class SearchOptimizer {
  // Use filter context for non-scoring queries
  static optimizeFilters(filters: any[]) {
    return {
      bool: {
        filter: filters, // Filter context doesn't calculate scores
      },
    };
  }

  // Use constant_score for better caching
  static constantScoreQuery(query: any) {
    return {
      constant_score: {
        filter: query,
        boost: 1.0,
      },
    };
  }

  // Optimize multi-field searches
  static optimizeMultiMatch(query: string, fields: string[]) {
    return {
      multi_match: {
        query,
        fields,
        type: 'cross_fields', // Better for name searches
        operator: 'and',
        tie_breaker: 0.3,
      },
    };
  }

  // Use source filtering to reduce payload
  static sourceFiltering(fields: string[]) {
    return {
      _source: {
        includes: fields,
      },
    };
  }

  // Optimize sorting
  static optimizeSort(sortField: string) {
    return [
      {
        [sortField]: {
          order: 'desc',
          missing: '_last',
          unmapped_type: 'long', // Prevent errors on unmapped fields
        },
      },
    ];
  }

  // Use search_after for deep pagination
  static searchAfterPagination(lastSort: any[]) {
    return {
      search_after: lastSort,
      track_total_hits: false, // Improve performance for large result sets
    };
  }
}
```

## Monitoring and Maintenance

### Index Health Monitoring

```typescript
// packages/api/src/elasticsearch/monitoring/health-check.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ElasticsearchService } from '../elasticsearch.service';

@Injectable()
export class ElasticsearchHealthCheckService {
  private readonly logger = new Logger(ElasticsearchHealthCheckService.name);

  constructor(private elasticsearch: ElasticsearchService) {}

  @Cron('0 */5 * * * *') // Every 5 minutes
  async checkHealth() {
    try {
      const health = await this.elasticsearch.client.cluster.health();
      
      if (health.status === 'red') {
        this.logger.error('Elasticsearch cluster is in RED status!');
        // Send alert
      } else if (health.status === 'yellow') {
        this.logger.warn('Elasticsearch cluster is in YELLOW status');
      }

      // Check index stats
      const stats = await this.elasticsearch.client.indices.stats({
        index: 'contacts,emails,activities',
      });

      Object.entries(stats.indices).forEach(([index, indexStats]) => {
        const sizeInMB = indexStats.primaries.store.size_in_bytes / (1024 * 1024);
        const docCount = indexStats.primaries.docs.count;
        
        this.logger.log(
          `Index ${index}: ${docCount} docs, ${sizeInMB.toFixed(2)} MB`
        );

        // Alert if index is too large
        if (sizeInMB > 10000) { // 10GB
          this.logger.warn(`Index ${index} is getting large: ${sizeInMB} MB`);
        }
      });
    } catch (error) {
      this.logger.error('Failed to check Elasticsearch health', error);
    }
  }

  @Cron('0 0 2 * * *') // Daily at 2 AM
  async performMaintenance() {
    try {
      // Force merge to optimize indices
      await this.elasticsearch.client.indices.forcemerge({
        index: 'contacts,emails,activities',
        max_num_segments: 1,
      });

      // Clear cache
      await this.elasticsearch.client.indices.clearCache({
        index: 'contacts,emails,activities',
      });

      this.logger.log('Elasticsearch maintenance completed');
    } catch (error) {
      this.logger.error('Failed to perform maintenance', error);
    }
  }

  async getIndexMetrics() {
    const [clusterStats, nodeStats, indexStats] = await Promise.all([
      this.elasticsearch.client.cluster.stats(),
      this.elasticsearch.client.nodes.stats(),
      this.elasticsearch.client.indices.stats(),
    ]);

    return {
      cluster: {
        status: clusterStats.status,
        nodeCount: clusterStats.nodes.count.total,
        indexCount: clusterStats.indices.count,
        totalDocs: clusterStats.indices.docs.count,
        totalSize: clusterStats.indices.store.size_in_bytes,
      },
      nodes: Object.values(nodeStats.nodes).map((node: any) => ({
        name: node.name,
        heap_used_percent: node.jvm.mem.heap_used_percent,
        cpu_percent: node.os.cpu.percent,
        load_average: node.os.load_average,
      })),
      indices: Object.entries(indexStats.indices).map(([name, stats]: [string, any]) => ({
        name,
        docs: stats.primaries.docs.count,
        size: stats.primaries.store.size_in_bytes,
        searchRate: stats.primaries.search.query_current,
        indexRate: stats.primaries.indexing.index_current,
      })),
    };
  }
}
```

### Index Lifecycle Management

```bash
# scripts/elasticsearch-lifecycle.sh
#!/bin/bash

# Create ILM policy for logs
curl -X PUT "localhost:9200/_ilm/policy/hastecrm-logs-policy" \
  -H 'Content-Type: application/json' \
  -d '{
    "policy": {
      "phases": {
        "hot": {
          "actions": {
            "rollover": {
              "max_primary_shard_size": "50GB",
              "max_age": "7d"
            }
          }
        },
        "warm": {
          "min_age": "7d",
          "actions": {
            "shrink": {
              "number_of_shards": 1
            },
            "forcemerge": {
              "max_num_segments": 1
            }
          }
        },
        "delete": {
          "min_age": "90d",
          "actions": {
            "delete": {}
          }
        }
      }
    }
  }'

# Create index template
curl -X PUT "localhost:9200/_index_template/hastecrm-logs" \
  -H 'Content-Type: application/json' \
  -d '{
    "index_patterns": ["hastecrm-logs-*"],
    "template": {
      "settings": {
        "number_of_shards": 2,
        "number_of_replicas": 1,
        "index.lifecycle.name": "hastecrm-logs-policy",
        "index.lifecycle.rollover_alias": "hastecrm-logs"
      }
    }
  }'
```

This completes the comprehensive Elasticsearch setup and configuration guide for hasteCRM.