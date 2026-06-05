import type { Request, Response } from 'express';
import { describe, expect, test, vi } from 'vitest';
import { send304Response, shouldReturn304 } from './handle-conditional-request.js';

// Mock Express request/response objects
const createMockRequest = (method: string = 'GET', headers: Record<string, string> = {}): Partial<Request> => ({
	method: method.toUpperCase(),
	headers,
});

const createMockResponse = (): Partial<Response> => {
	const headers: Record<string, string> = {};
	return {
		status: vi.fn().mockReturnThis(),
		setHeader: vi.fn().mockImplementation((name, value) => {
			headers[name] = value;
			return this;
		}),
		end: vi.fn(),
		_headers: headers,
	};
};

describe('shouldReturn304', () => {
	test('should return false for non-GET/HEAD methods', () => {
		const req = createMockRequest('POST', { 'if-none-match': '"abc123"' });
		const result = shouldReturn304(req as Request, '"abc123"');
		expect(result).toBe(false);
	});

	test('should return true when If-None-Match matches current ETag', () => {
		const req = createMockRequest('GET', { 'if-none-match': '"abc123"' });
		const result = shouldReturn304(req as Request, '"abc123"');
		expect(result).toBe(true);
	});

	test('should return true when If-None-Match contains current ETag in list', () => {
		const req = createMockRequest('GET', { 'if-none-match': '"def456", "abc123", "ghi789"' });
		const result = shouldReturn304(req as Request, '"abc123"');
		expect(result).toBe(true);
	});

	test('should return true when If-None-Match is asterisk', () => {
		const req = createMockRequest('GET', { 'if-none-match': '*' });
		const result = shouldReturn304(req as Request, '"abc123"');
		expect(result).toBe(true);
	});

	test('should return false when If-None-Match does not match', () => {
		const req = createMockRequest('GET', { 'if-none-match': '"def456"' });
		const result = shouldReturn304(req as Request, '"abc123"');
		expect(result).toBe(false);
	});

	test('should handle weak ETags in If-None-Match', () => {
		const req = createMockRequest('GET', { 'if-none-match': 'W/"abc123"' });
		const result = shouldReturn304(req as Request, '"abc123"');
		expect(result).toBe(true);
	});

	test('should fall back to If-Modified-Since when no If-None-Match', () => {
		const lastModified = new Date('2023-01-01T12:00:00.000Z');
		const ifModifiedSince = new Date('2023-01-01T12:00:00.000Z');

		const req = createMockRequest('GET', {
			'if-modified-since': ifModifiedSince.toUTCString(),
		});

		const result = shouldReturn304(req as Request, '"abc123"', lastModified);
		expect(result).toBe(true);
	});

	test('should return false when resource is newer than If-Modified-Since', () => {
		const lastModified = new Date('2023-01-01T12:01:00.000Z');
		const ifModifiedSince = new Date('2023-01-01T12:00:00.000Z');

		const req = createMockRequest('GET', {
			'if-modified-since': ifModifiedSince.toUTCString(),
		});

		const result = shouldReturn304(req as Request, '"abc123"', lastModified);
		expect(result).toBe(false);
	});

	test('should return true when resource is older than If-Modified-Since', () => {
		const lastModified = new Date('2023-01-01T11:59:00.000Z');
		const ifModifiedSince = new Date('2023-01-01T12:00:00.000Z');

		const req = createMockRequest('GET', {
			'if-modified-since': ifModifiedSince.toUTCString(),
		});

		const result = shouldReturn304(req as Request, '"abc123"', lastModified);
		expect(result).toBe(true);
	});

	test('should prioritize If-None-Match over If-Modified-Since', () => {
		const lastModified = new Date('2023-01-01T12:01:00.000Z'); // Newer
		const ifModifiedSince = new Date('2023-01-01T12:00:00.000Z');

		const req = createMockRequest('GET', {
			'if-none-match': '"abc123"',
			'if-modified-since': ifModifiedSince.toUTCString(),
		});

		// Should return true because ETag matches, even though date would indicate false
		const result = shouldReturn304(req as Request, '"abc123"', lastModified);
		expect(result).toBe(true);
	});

	test('should handle invalid If-Modified-Since date', () => {
		const req = createMockRequest('GET', {
			'if-modified-since': 'invalid-date',
		});

		const result = shouldReturn304(req as Request, '"abc123"', new Date());
		expect(result).toBe(false);
	});

	test('should return false when no conditional headers present', () => {
		const req = createMockRequest('GET');
		const result = shouldReturn304(req as Request, '"abc123"', new Date());
		expect(result).toBe(false);
	});

	test('should work with HEAD method', () => {
		const req = createMockRequest('HEAD', { 'if-none-match': '"abc123"' });
		const result = shouldReturn304(req as Request, '"abc123"');
		expect(result).toBe(true);
	});
});

describe('send304Response', () => {
	test('should set status 304', () => {
		const res = createMockResponse() as Response;

		send304Response(res, '"abc123"');

		expect(res.status).toHaveBeenCalledWith(304);
	});

	test('should set ETag header', () => {
		const res = createMockResponse() as Response;

		send304Response(res, '"abc123"');

		expect(res.setHeader).toHaveBeenCalledWith('ETag', '"abc123"');
	});

	test('should set Last-Modified header when provided', () => {
		const res = createMockResponse() as Response;
		const lastModified = new Date('2023-01-01T12:00:00.000Z');

		send304Response(res, '"abc123"', lastModified);

		expect(res.setHeader).toHaveBeenCalledWith('Last-Modified', lastModified.toUTCString());
	});

	test('should set Cache-Control header when provided', () => {
		const res = createMockResponse() as Response;

		send304Response(res, '"abc123"', undefined, 'public, max-age=3600');

		expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'public, max-age=3600');
	});

	test('should set Vary header when provided', () => {
		const res = createMockResponse() as Response;

		send304Response(res, '"abc123"', undefined, undefined, ['Origin', 'Accept']);

		expect(res.setHeader).toHaveBeenCalledWith('Vary', 'Origin, Accept');
	});

	test('should end response', () => {
		const res = createMockResponse() as Response;

		send304Response(res, '"abc123"');

		expect(res.end).toHaveBeenCalled();
	});

	test('should set all headers when all parameters provided', () => {
		const res = createMockResponse() as Response;
		const lastModified = new Date('2023-01-01T12:00:00.000Z');

		send304Response(res, '"abc123"', lastModified, 'public, max-age=3600', ['Origin', 'Accept']);

		expect(res.status).toHaveBeenCalledWith(304);
		expect(res.setHeader).toHaveBeenCalledWith('ETag', '"abc123"');
		expect(res.setHeader).toHaveBeenCalledWith('Last-Modified', lastModified.toUTCString());
		expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'public, max-age=3600');
		expect(res.setHeader).toHaveBeenCalledWith('Vary', 'Origin, Accept');
		expect(res.end).toHaveBeenCalled();
	});
});
