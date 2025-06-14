import { Test, TestingModule } from '@nestjs/testing';
import { RedisService } from './redis.service';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import Redis from 'ioredis';

jest.mock('ioredis');

describe('RedisService', () => {
  let service: RedisService;
  let configService: ConfigService;
  let mockRedisClient: any;

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    mockRedisClient = {
      on: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
      expire: jest.fn(),
      ttl: jest.fn(),
      keys: jest.fn(),
      mget: jest.fn(),
      mset: jest.fn(),
      hget: jest.fn(),
      hset: jest.fn(),
      hgetall: jest.fn(),
      hdel: jest.fn(),
      sadd: jest.fn(),
      srem: jest.fn(),
      smembers: jest.fn(),
      sismember: jest.fn(),
      zadd: jest.fn(),
      zrem: jest.fn(),
      zrange: jest.fn(),
      zrangebyscore: jest.fn(),
      lpush: jest.fn(),
      rpush: jest.fn(),
      lpop: jest.fn(),
      rpop: jest.fn(),
      lrange: jest.fn(),
      llen: jest.fn(),
      flushdb: jest.fn(),
      ping: jest.fn(),
      quit: jest.fn(),
    };

    (Redis as jest.MockedClass<typeof Redis>).mockImplementation(() => mockRedisClient);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<RedisService>(RedisService);
    configService = module.get<ConfigService>(ConfigService);
  });

  describe('initialization', () => {
    it('should create Redis client with default config', () => {
      mockConfigService.get.mockImplementation((key: string) => {
        const config: Record<string, any> = {
          'REDIS_HOST': 'localhost',
          'REDIS_PORT': 6379,
          'REDIS_PASSWORD': '',
          'REDIS_DB': 0,
        };
        return config[key];
      });

      new RedisService(configService);

      expect(Redis).toHaveBeenCalledWith({
        host: 'localhost',
        port: 6379,
        password: '',
        db: 0,
      });
    });

    it('should handle connection events', () => {
      new RedisService(configService);

      expect(mockRedisClient.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockRedisClient.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockRedisClient.on).toHaveBeenCalledWith('ready', expect.any(Function));
    });
  });

  describe('basic operations', () => {
    describe('get', () => {
      it('should get a value', async () => {
        mockRedisClient.get.mockResolvedValue('test-value');

        const result = await service.get('test-key');

        expect(result).toBe('test-value');
        expect(mockRedisClient.get).toHaveBeenCalledWith('test-key');
      });

      it('should return null for non-existent key', async () => {
        mockRedisClient.get.mockResolvedValue(null);

        const result = await service.get('non-existent');

        expect(result).toBeNull();
      });
    });

    describe('set', () => {
      it('should set a value', async () => {
        mockRedisClient.set.mockResolvedValue('OK');

        await service.set('test-key', 'test-value');

        expect(mockRedisClient.set).toHaveBeenCalledWith('test-key', 'test-value');
      });

      it('should set a value with TTL', async () => {
        mockRedisClient.set.mockResolvedValue('OK');

        await service.set('test-key', 'test-value', 3600);

        expect(mockRedisClient.set).toHaveBeenCalledWith('test-key', 'test-value', 'EX', 3600);
      });
    });

    describe('del', () => {
      it('should delete a key', async () => {
        mockRedisClient.del.mockResolvedValue(1);

        const result = await service.del('test-key');

        expect(result).toBe(1);
        expect(mockRedisClient.del).toHaveBeenCalledWith('test-key');
      });

      it('should delete multiple keys', async () => {
        mockRedisClient.del.mockResolvedValue(3);

        const result = await service.del(['key1', 'key2', 'key3']);

        expect(result).toBe(3);
        expect(mockRedisClient.del).toHaveBeenCalledWith(['key1', 'key2', 'key3']);
      });
    });

    describe('exists', () => {
      it('should check if key exists', async () => {
        mockRedisClient.exists.mockResolvedValue(1);

        const result = await service.exists('test-key');

        expect(result).toBe(true);
        expect(mockRedisClient.exists).toHaveBeenCalledWith('test-key');
      });

      it('should return false for non-existent key', async () => {
        mockRedisClient.exists.mockResolvedValue(0);

        const result = await service.exists('non-existent');

        expect(result).toBe(false);
      });
    });

    describe('expire', () => {
      it('should set expiration', async () => {
        mockRedisClient.expire.mockResolvedValue(1);

        const result = await service.expire('test-key', 3600);

        expect(result).toBe(true);
        expect(mockRedisClient.expire).toHaveBeenCalledWith('test-key', 3600);
      });
    });

    describe('ttl', () => {
      it('should get TTL', async () => {
        mockRedisClient.ttl.mockResolvedValue(3600);

        const result = await service.ttl('test-key');

        expect(result).toBe(3600);
        expect(mockRedisClient.ttl).toHaveBeenCalledWith('test-key');
      });

      it('should return -1 for keys without expiration', async () => {
        mockRedisClient.ttl.mockResolvedValue(-1);

        const result = await service.ttl('permanent-key');

        expect(result).toBe(-1);
      });
    });
  });

  describe('hash operations', () => {
    describe('hget', () => {
      it('should get hash field', async () => {
        mockRedisClient.hget.mockResolvedValue('field-value');

        const result = await service.hget('hash-key', 'field');

        expect(result).toBe('field-value');
        expect(mockRedisClient.hget).toHaveBeenCalledWith('hash-key', 'field');
      });
    });

    describe('hset', () => {
      it('should set hash field', async () => {
        mockRedisClient.hset.mockResolvedValue(1);

        await service.hset('hash-key', 'field', 'value');

        expect(mockRedisClient.hset).toHaveBeenCalledWith('hash-key', 'field', 'value');
      });
    });

    describe('hgetall', () => {
      it('should get all hash fields', async () => {
        const mockHash = { field1: 'value1', field2: 'value2' };
        mockRedisClient.hgetall.mockResolvedValue(mockHash);

        const result = await service.hgetall('hash-key');

        expect(result).toEqual(mockHash);
        expect(mockRedisClient.hgetall).toHaveBeenCalledWith('hash-key');
      });
    });

    describe('hdel', () => {
      it('should delete hash field', async () => {
        mockRedisClient.hdel.mockResolvedValue(1);

        const result = await service.hdel('hash-key', 'field');

        expect(result).toBe(1);
        expect(mockRedisClient.hdel).toHaveBeenCalledWith('hash-key', 'field');
      });
    });
  });

  describe('set operations', () => {
    describe('sadd', () => {
      it('should add to set', async () => {
        mockRedisClient.sadd.mockResolvedValue(1);

        const result = await service.sadd('set-key', 'member');

        expect(result).toBe(1);
        expect(mockRedisClient.sadd).toHaveBeenCalledWith('set-key', 'member');
      });

      it('should add multiple members', async () => {
        mockRedisClient.sadd.mockResolvedValue(3);

        const result = await service.sadd('set-key', ['member1', 'member2', 'member3']);

        expect(result).toBe(3);
        expect(mockRedisClient.sadd).toHaveBeenCalledWith('set-key', ['member1', 'member2', 'member3']);
      });
    });

    describe('srem', () => {
      it('should remove from set', async () => {
        mockRedisClient.srem.mockResolvedValue(1);

        const result = await service.srem('set-key', 'member');

        expect(result).toBe(1);
        expect(mockRedisClient.srem).toHaveBeenCalledWith('set-key', 'member');
      });
    });

    describe('smembers', () => {
      it('should get set members', async () => {
        const mockMembers = ['member1', 'member2', 'member3'];
        mockRedisClient.smembers.mockResolvedValue(mockMembers);

        const result = await service.smembers('set-key');

        expect(result).toEqual(mockMembers);
        expect(mockRedisClient.smembers).toHaveBeenCalledWith('set-key');
      });
    });

    describe('sismember', () => {
      it('should check set membership', async () => {
        mockRedisClient.sismember.mockResolvedValue(1);

        const result = await service.sismember('set-key', 'member');

        expect(result).toBe(true);
        expect(mockRedisClient.sismember).toHaveBeenCalledWith('set-key', 'member');
      });
    });
  });

  describe('sorted set operations', () => {
    describe('zadd', () => {
      it('should add to sorted set', async () => {
        mockRedisClient.zadd.mockResolvedValue(1);

        const result = await service.zadd('zset-key', 100, 'member');

        expect(result).toBe(1);
        expect(mockRedisClient.zadd).toHaveBeenCalledWith('zset-key', 100, 'member');
      });
    });

    describe('zrem', () => {
      it('should remove from sorted set', async () => {
        mockRedisClient.zrem.mockResolvedValue(1);

        const result = await service.zrem('zset-key', 'member');

        expect(result).toBe(1);
        expect(mockRedisClient.zrem).toHaveBeenCalledWith('zset-key', 'member');
      });
    });

    describe('zrange', () => {
      it('should get range from sorted set', async () => {
        const mockMembers = ['member1', 'member2', 'member3'];
        mockRedisClient.zrange.mockResolvedValue(mockMembers);

        const result = await service.zrange('zset-key', 0, -1);

        expect(result).toEqual(mockMembers);
        expect(mockRedisClient.zrange).toHaveBeenCalledWith('zset-key', 0, -1);
      });

      it('should get range with scores', async () => {
        const mockMembersWithScores = ['member1', '100', 'member2', '200'];
        mockRedisClient.zrange.mockResolvedValue(mockMembersWithScores);

        const result = await service.zrange('zset-key', 0, -1, true);

        expect(result).toEqual(mockMembersWithScores);
        expect(mockRedisClient.zrange).toHaveBeenCalledWith('zset-key', 0, -1, 'WITHSCORES');
      });
    });

    describe('zrangebyscore', () => {
      it('should get range by score', async () => {
        const mockMembers = ['member1', 'member2'];
        mockRedisClient.zrangebyscore.mockResolvedValue(mockMembers);

        const result = await service.zrangebyscore('zset-key', 0, 100);

        expect(result).toEqual(mockMembers);
        expect(mockRedisClient.zrangebyscore).toHaveBeenCalledWith('zset-key', 0, 100);
      });
    });
  });

  describe('list operations', () => {
    describe('lpush', () => {
      it('should push to left', async () => {
        mockRedisClient.lpush.mockResolvedValue(1);

        const result = await service.lpush('list-key', 'value');

        expect(result).toBe(1);
        expect(mockRedisClient.lpush).toHaveBeenCalledWith('list-key', 'value');
      });
    });

    describe('rpush', () => {
      it('should push to right', async () => {
        mockRedisClient.rpush.mockResolvedValue(1);

        const result = await service.rpush('list-key', 'value');

        expect(result).toBe(1);
        expect(mockRedisClient.rpush).toHaveBeenCalledWith('list-key', 'value');
      });
    });

    describe('lpop', () => {
      it('should pop from left', async () => {
        mockRedisClient.lpop.mockResolvedValue('value');

        const result = await service.lpop('list-key');

        expect(result).toBe('value');
        expect(mockRedisClient.lpop).toHaveBeenCalledWith('list-key');
      });
    });

    describe('rpop', () => {
      it('should pop from right', async () => {
        mockRedisClient.rpop.mockResolvedValue('value');

        const result = await service.rpop('list-key');

        expect(result).toBe('value');
        expect(mockRedisClient.rpop).toHaveBeenCalledWith('list-key');
      });
    });

    describe('lrange', () => {
      it('should get list range', async () => {
        const mockValues = ['value1', 'value2', 'value3'];
        mockRedisClient.lrange.mockResolvedValue(mockValues);

        const result = await service.lrange('list-key', 0, -1);

        expect(result).toEqual(mockValues);
        expect(mockRedisClient.lrange).toHaveBeenCalledWith('list-key', 0, -1);
      });
    });

    describe('llen', () => {
      it('should get list length', async () => {
        mockRedisClient.llen.mockResolvedValue(5);

        const result = await service.llen('list-key');

        expect(result).toBe(5);
        expect(mockRedisClient.llen).toHaveBeenCalledWith('list-key');
      });
    });
  });

  describe('utility methods', () => {
    describe('keys', () => {
      it('should find keys by pattern', async () => {
        const mockKeys = ['key1', 'key2', 'key3'];
        mockRedisClient.keys.mockResolvedValue(mockKeys);

        const result = await service.keys('key*');

        expect(result).toEqual(mockKeys);
        expect(mockRedisClient.keys).toHaveBeenCalledWith('key*');
      });
    });

    describe('mget', () => {
      it('should get multiple values', async () => {
        const mockValues = ['value1', 'value2', null];
        mockRedisClient.mget.mockResolvedValue(mockValues);

        const result = await service.mget(['key1', 'key2', 'key3']);

        expect(result).toEqual(mockValues);
        expect(mockRedisClient.mget).toHaveBeenCalledWith(['key1', 'key2', 'key3']);
      });
    });

    describe('mset', () => {
      it('should set multiple values', async () => {
        mockRedisClient.mset.mockResolvedValue('OK');

        await service.mset({ key1: 'value1', key2: 'value2' });

        expect(mockRedisClient.mset).toHaveBeenCalledWith({ key1: 'value1', key2: 'value2' });
      });
    });

    describe('flushdb', () => {
      it('should flush database', async () => {
        mockRedisClient.flushdb.mockResolvedValue('OK');

        await service.flushdb();

        expect(mockRedisClient.flushdb).toHaveBeenCalled();
      });
    });

    describe('ping', () => {
      it('should ping Redis', async () => {
        mockRedisClient.ping.mockResolvedValue('PONG');

        const result = await service.ping();

        expect(result).toBe('PONG');
        expect(mockRedisClient.ping).toHaveBeenCalled();
      });
    });
  });

  describe('onModuleDestroy', () => {
    it('should quit Redis connection', async () => {
      mockRedisClient.quit.mockResolvedValue('OK');

      await service.onModuleDestroy();

      expect(mockRedisClient.quit).toHaveBeenCalled();
    });
  });
});