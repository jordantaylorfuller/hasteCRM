import { hashPassword, comparePassword, generateRandomToken } from './crypto';
import { formatError, isValidEmail, sanitizeHtml, truncateString } from './helpers';
import { paginateResults, calculateSkip } from './pagination';

// Mock bcrypt
jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed_password'),
  compare: jest.fn().mockResolvedValue(true),
}));

// Mock crypto
jest.mock('crypto', () => ({
  randomBytes: jest.fn().mockReturnValue({
    toString: jest.fn().mockReturnValue('random_token_123'),
  }),
}));

describe('Common Utils', () => {
  describe('Crypto Utils', () => {
    describe('hashPassword', () => {
      it('should hash a password', async () => {
        const password = 'mySecurePassword123';
        const result = await hashPassword(password);

        expect(result).toBe('hashed_password');
        expect(require('bcrypt').hash).toHaveBeenCalledWith(password, 10);
      });

      it('should handle empty password', async () => {
        await expect(hashPassword('')).rejects.toThrow();
      });
    });

    describe('comparePassword', () => {
      it('should compare passwords correctly', async () => {
        const password = 'mySecurePassword123';
        const hash = 'hashed_password';

        const result = await comparePassword(password, hash);

        expect(result).toBe(true);
        expect(require('bcrypt').compare).toHaveBeenCalledWith(password, hash);
      });

      it('should return false for incorrect password', async () => {
        require('bcrypt').compare = jest.fn().mockResolvedValue(false);

        const result = await comparePassword('wrongPassword', 'hash');

        expect(result).toBe(false);
      });
    });

    describe('generateRandomToken', () => {
      it('should generate a random token', () => {
        const result = generateRandomToken();

        expect(result).toBe('random_token_123');
        expect(require('crypto').randomBytes).toHaveBeenCalledWith(32);
      });

      it('should generate token with custom length', () => {
        const result = generateRandomToken(16);

        expect(result).toBe('random_token_123');
        expect(require('crypto').randomBytes).toHaveBeenCalledWith(16);
      });
    });
  });

  describe('Helper Utils', () => {
    describe('formatError', () => {
      it('should format error object', () => {
        const error = new Error('Test error');
        const result = formatError(error);

        expect(result).toMatchObject({
          message: 'Test error',
          stack: expect.any(String),
        });
      });

      it('should handle non-Error objects', () => {
        const error = { code: 'ERR_001', details: 'Something went wrong' };
        const result = formatError(error);

        expect(result).toMatchObject({
          code: 'ERR_001',
          details: 'Something went wrong',
        });
      });

      it('should handle string errors', () => {
        const result = formatError('Simple error message');

        expect(result).toMatchObject({
          message: 'Simple error message',
        });
      });
    });

    describe('isValidEmail', () => {
      it('should validate correct email addresses', () => {
        expect(isValidEmail('user@example.com')).toBe(true);
        expect(isValidEmail('test.user+tag@domain.co.uk')).toBe(true);
        expect(isValidEmail('123@456.789')).toBe(true);
      });

      it('should reject invalid email addresses', () => {
        expect(isValidEmail('notanemail')).toBe(false);
        expect(isValidEmail('@example.com')).toBe(false);
        expect(isValidEmail('user@')).toBe(false);
        expect(isValidEmail('user @example.com')).toBe(false);
        expect(isValidEmail('')).toBe(false);
      });
    });

    describe('sanitizeHtml', () => {
      it('should remove script tags', () => {
        const input = '<p>Hello</p><script>alert("XSS")</script>';
        const result = sanitizeHtml(input);

        expect(result).not.toContain('<script>');
        expect(result).toContain('<p>Hello</p>');
      });

      it('should allow safe HTML tags', () => {
        const input = '<p>Hello <strong>world</strong></p>';
        const result = sanitizeHtml(input);

        expect(result).toBe(input);
      });

      it('should handle empty input', () => {
        expect(sanitizeHtml('')).toBe('');
        expect(sanitizeHtml(null as any)).toBe('');
        expect(sanitizeHtml(undefined as any)).toBe('');
      });
    });

    describe('truncateString', () => {
      it('should truncate long strings', () => {
        const input = 'This is a very long string that needs to be truncated';
        const result = truncateString(input, 20);

        expect(result).toBe('This is a very long...');
        expect(result.length).toBeLessThanOrEqual(23); // 20 + '...'
      });

      it('should not truncate short strings', () => {
        const input = 'Short string';
        const result = truncateString(input, 20);

        expect(result).toBe(input);
      });

      it('should handle edge cases', () => {
        expect(truncateString('', 10)).toBe('');
        expect(truncateString('test', 0)).toBe('...');
      });
    });
  });

  describe('Pagination Utils', () => {
    describe('calculateSkip', () => {
      it('should calculate skip value correctly', () => {
        expect(calculateSkip(1, 10)).toBe(0);
        expect(calculateSkip(2, 10)).toBe(10);
        expect(calculateSkip(3, 25)).toBe(50);
      });

      it('should handle invalid inputs', () => {
        expect(calculateSkip(0, 10)).toBe(0);
        expect(calculateSkip(-1, 10)).toBe(0);
        expect(calculateSkip(1, 0)).toBe(0);
      });
    });

    describe('paginateResults', () => {
      it('should paginate results correctly', () => {
        const items = Array.from({ length: 100 }, (_, i) => ({ id: i }));
        const result = paginateResults(items, 2, 10, 100);

        expect(result).toMatchObject({
          items: expect.arrayContaining([{ id: 10 }, { id: 19 }]),
          total: 100,
          page: 2,
          limit: 10,
          pages: 10,
          hasNext: true,
          hasPrev: true,
        });
      });

      it('should handle first page', () => {
        const items = Array.from({ length: 10 }, (_, i) => ({ id: i }));
        const result = paginateResults(items, 1, 10, 50);

        expect(result.hasPrev).toBe(false);
        expect(result.hasNext).toBe(true);
      });

      it('should handle last page', () => {
        const items = Array.from({ length: 5 }, (_, i) => ({ id: i }));
        const result = paginateResults(items, 5, 10, 45);

        expect(result.hasPrev).toBe(true);
        expect(result.hasNext).toBe(false);
        expect(result.pages).toBe(5);
      });

      it('should handle empty results', () => {
        const result = paginateResults([], 1, 10, 0);

        expect(result).toMatchObject({
          items: [],
          total: 0,
          page: 1,
          limit: 10,
          pages: 0,
          hasNext: false,
          hasPrev: false,
        });
      });
    });
  });
});