import { describe, it, expect } from "vitest";
import { apiResponse, successResponse, createdResponse, errorApiResponse, API_VERSION } from "./api-utils";

describe('API Versioning', () => {
  describe('apiResponse', () => {
    it('should add X-API-Version header', () => {
      const response = apiResponse({ message: 'test' });
      expect(response.headers.get('X-API-Version')).toBe(API_VERSION);
    });

    it('should add X-Content-Type-Options header', () => {
      const response = apiResponse({ message: 'test' });
      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    });

    it('should preserve custom headers', () => {
      const response = apiResponse(
        { message: 'test' },
        {
          headers: {
            'Cache-Control': 'public, max-age=300'
          }
        }
      );
      expect(response.headers.get('Cache-Control')).toBe('public, max-age=300');
      expect(response.headers.get('X-API-Version')).toBe(API_VERSION);
    });

    it('should preserve custom status codes', () => {
      const response = apiResponse({ message: 'test' }, { status: 404 });
      expect(response.status).toBe(404);
    });
  });

  describe('successResponse', () => {
    it('should return 200 status', () => {
      const response = successResponse({ data: 'test' });
      expect(response.status).toBe(200);
    });

    it('should include versioning headers', () => {
      const response = successResponse({ data: 'test' });
      expect(response.headers.get('X-API-Version')).toBe(API_VERSION);
    });

    it('should preserve custom headers', () => {
      const response = successResponse(
        { data: 'test' },
        {
          headers: {
            'Cache-Control': 'no-cache'
          }
        }
      );
      expect(response.headers.get('Cache-Control')).toBe('no-cache');
    });
  });

  describe('createdResponse', () => {
    it('should return 201 status', () => {
      const response = createdResponse({ id: '123' });
      expect(response.status).toBe(201);
    });

    it('should include versioning headers', () => {
      const response = createdResponse({ id: '123' });
      expect(response.headers.get('X-API-Version')).toBe(API_VERSION);
    });
  });

  describe('errorApiResponse', () => {
    it('should return error object', async () => {
      const response = errorApiResponse('Not found', 404);
      const body = await response.json();
      expect(body).toEqual({ error: 'Not found' });
    });

    it('should use provided status code', () => {
      const response = errorApiResponse('Unauthorized', 401);
      expect(response.status).toBe(401);
    });

    it('should default to 500 status', () => {
      const response = errorApiResponse('Server error');
      expect(response.status).toBe(500);
    });

    it('should include versioning headers', () => {
      const response = errorApiResponse('Error', 400);
      expect(response.headers.get('X-API-Version')).toBe(API_VERSION);
    });
  });

  describe('API_VERSION constant', () => {
    it('should be a valid semantic version string', () => {
      expect(API_VERSION).toMatch(/^\d+\.\d+$/);
    });
  });
});
