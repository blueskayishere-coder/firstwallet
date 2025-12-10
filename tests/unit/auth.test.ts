import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

// Mock logger before importing auth middleware
jest.mock('../../src/utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

import { apiKeyAuth, hmacAuth, combinedAuth } from '../../src/middleware/auth';

// Mock config
jest.mock('../../src/config', () => ({
  config: {
    apiKey: 'test-api-key',
    hmacSecret: 'test-hmac-secret',
  },
}));

describe('Auth Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });

    mockRequest = {
      headers: {},
      body: {},
    };

    mockResponse = {
      status: statusMock,
      json: jsonMock,
      headersSent: false,
    };

    nextFunction = jest.fn();
  });

  describe('apiKeyAuth', () => {
    it('should call next() for valid API key', () => {
      mockRequest.headers = { 'x-api-key': 'test-api-key' };

      apiKeyAuth(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(mockRequest.apiKey).toBe('test-api-key');
    });

    it('should return 401 when API key is missing', () => {
      mockRequest.headers = {};

      apiKeyAuth(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'API key is required',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 401 for invalid API key', () => {
      mockRequest.headers = { 'x-api-key': 'wrong-api-key' };

      apiKeyAuth(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid API key',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });
  });

  describe('hmacAuth', () => {
    it('should call next() for valid signature', () => {
      const timestamp = Date.now().toString();
      const body = { test: 'data' };
      const payload = JSON.stringify(body) + timestamp;
      const signature = crypto
        .createHmac('sha256', 'test-hmac-secret')
        .update(payload)
        .digest('hex');

      mockRequest.headers = {
        'x-signature': signature,
        'x-timestamp': timestamp,
      };
      mockRequest.body = body;

      hmacAuth(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });

    it('should return 401 when signature is missing', () => {
      mockRequest.headers = { 'x-timestamp': Date.now().toString() };

      hmacAuth(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Signature and timestamp are required',
      });
    });

    it('should return 401 when timestamp is missing', () => {
      mockRequest.headers = { 'x-signature': 'some-signature' };

      hmacAuth(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Signature and timestamp are required',
      });
    });

    it('should return 401 for expired timestamp', () => {
      const expiredTimestamp = (Date.now() - 6 * 60 * 1000).toString(); // 6 minutes ago

      mockRequest.headers = {
        'x-signature': 'some-signature',
        'x-timestamp': expiredTimestamp,
      };

      hmacAuth(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Timestamp expired or invalid',
      });
    });

    it('should return 401 for invalid signature', () => {
      const timestamp = Date.now().toString();

      mockRequest.headers = {
        'x-signature': 'invalid-signature',
        'x-timestamp': timestamp,
      };
      mockRequest.body = { test: 'data' };

      hmacAuth(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid signature',
      });
    });
  });

  describe('combinedAuth', () => {
    it('should validate both API key and HMAC signature', () => {
      const timestamp = Date.now().toString();
      const body = { test: 'data' };
      const payload = JSON.stringify(body) + timestamp;
      const signature = crypto
        .createHmac('sha256', 'test-hmac-secret')
        .update(payload)
        .digest('hex');

      mockRequest.headers = {
        'x-api-key': 'test-api-key',
        'x-signature': signature,
        'x-timestamp': timestamp,
      };
      mockRequest.body = body;

      combinedAuth(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });

    it('should fail if API key is invalid', () => {
      mockRequest.headers = {
        'x-api-key': 'wrong-api-key',
        'x-signature': 'signature',
        'x-timestamp': Date.now().toString(),
      };

      combinedAuth(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(nextFunction).not.toHaveBeenCalled();
    });
  });
});
