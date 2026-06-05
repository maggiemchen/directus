import { describe, expect, test } from 'vitest';
import { etagMatches, generateAssetETag, parseIfNoneMatch } from './generate-etag.js';

describe('generateAssetETag', () => {
	test('should generate stable ETag for same inputs', () => {
		const etag1 = generateAssetETag('550e8400-e29b-41d4-a716-446655440000', '2023-01-01T00:00:00.000Z', 1024, {});

		const etag2 = generateAssetETag('550e8400-e29b-41d4-a716-446655440000', '2023-01-01T00:00:00.000Z', 1024, {});

		expect(etag1).toBe(etag2);
		expect(etag1).toMatch(/^"[a-f0-9]{16}"$/);
	});

	test('should generate different ETags for different files', () => {
		const etag1 = generateAssetETag('550e8400-e29b-41d4-a716-446655440000', '2023-01-01T00:00:00.000Z', 1024, {});

		const etag2 = generateAssetETag('550e8400-e29b-41d4-a716-446655440001', '2023-01-01T00:00:00.000Z', 1024, {});

		expect(etag1).not.toBe(etag2);
	});

	test('should generate different ETags for different modification times', () => {
		const etag1 = generateAssetETag('550e8400-e29b-41d4-a716-446655440000', '2023-01-01T00:00:00.000Z', 1024, {});

		const etag2 = generateAssetETag('550e8400-e29b-41d4-a716-446655440000', '2023-01-01T00:01:00.000Z', 1024, {});

		expect(etag1).not.toBe(etag2);
	});

	test('should generate different ETags for different file sizes', () => {
		const etag1 = generateAssetETag('550e8400-e29b-41d4-a716-446655440000', '2023-01-01T00:00:00.000Z', 1024, {});

		const etag2 = generateAssetETag('550e8400-e29b-41d4-a716-446655440000', '2023-01-01T00:00:00.000Z', 2048, {});

		expect(etag1).not.toBe(etag2);
	});

	test('should generate different ETags for different transformation parameters', () => {
		const etag1 = generateAssetETag('550e8400-e29b-41d4-a716-446655440000', '2023-01-01T00:00:00.000Z', 1024, {});

		const etag2 = generateAssetETag('550e8400-e29b-41d4-a716-446655440000', '2023-01-01T00:00:00.000Z', 1024, {
			width: 300,
			height: 200,
		});

		expect(etag1).not.toBe(etag2);
	});

	test('should generate different ETags for different transformation parameter orders', () => {
		const etag1 = generateAssetETag('550e8400-e29b-41d4-a716-446655440000', '2023-01-01T00:00:00.000Z', 1024, {
			width: 300,
			height: 200,
		});

		const etag2 = generateAssetETag('550e8400-e29b-41d4-a716-446655440000', '2023-01-01T00:00:00.000Z', 1024, {
			height: 200,
			width: 300,
		});

		// Should be the same because we sort keys
		expect(etag1).toBe(etag2);
	});

	test('should generate different ETags for different accept formats', () => {
		const etag1 = generateAssetETag('550e8400-e29b-41d4-a716-446655440000', '2023-01-01T00:00:00.000Z', 1024, {
			format: 'auto',
		});

		const etag2 = generateAssetETag(
			'550e8400-e29b-41d4-a716-446655440000',
			'2023-01-01T00:00:00.000Z',
			1024,
			{ format: 'auto' },
			'webp',
		);

		expect(etag1).not.toBe(etag2);
	});

	test('should handle null modification date', () => {
		const etag = generateAssetETag('550e8400-e29b-41d4-a716-446655440000', null, 1024, {});

		expect(etag).toMatch(/^"[a-f0-9]{16}"$/);
	});

	test('should handle complex transformation parameters', () => {
		const etag = generateAssetETag('550e8400-e29b-41d4-a716-446655440000', '2023-01-01T00:00:00.000Z', 1024, {
			transforms: [
				['resize', { width: 300, height: 200 }],
				['format', 'webp'],
				['quality', 80],
			],
		});

		expect(etag).toMatch(/^"[a-f0-9]{16}"$/);
	});
});

describe('parseIfNoneMatch', () => {
	test('should handle undefined header', () => {
		const etags = parseIfNoneMatch(undefined);
		expect(etags).toEqual([]);
	});

	test('should handle empty string', () => {
		const etags = parseIfNoneMatch('');
		expect(etags).toEqual([]);
	});

	test('should handle asterisk', () => {
		const etags = parseIfNoneMatch('*');
		expect(etags).toEqual(['*']);
	});

	test('should handle single strong ETag', () => {
		const etags = parseIfNoneMatch('"abc123"');
		expect(etags).toEqual(['"abc123"']);
	});

	test('should handle single weak ETag', () => {
		const etags = parseIfNoneMatch('W/"abc123"');
		expect(etags).toEqual(['"abc123"']);
	});

	test('should handle multiple ETags', () => {
		const etags = parseIfNoneMatch('"abc123", W/"def456", "ghi789"');
		expect(etags).toEqual(['"abc123"', '"def456"', '"ghi789"']);
	});

	test('should handle ETags without quotes', () => {
		const etags = parseIfNoneMatch('abc123');
		expect(etags).toEqual(['"abc123"']);
	});

	test('should handle mixed formats', () => {
		const etags = parseIfNoneMatch('"quoted", unquoted, W/"weak"');
		expect(etags).toEqual(['"quoted"', '"unquoted"', '"weak"']);
	});
});

describe('etagMatches', () => {
	test('should match against asterisk', () => {
		const matches = etagMatches('"abc123"', ['*']);
		expect(matches).toBe(true);
	});

	test('should match exact ETag', () => {
		const matches = etagMatches('"abc123"', ['"abc123"', '"def456"']);
		expect(matches).toBe(true);
	});

	test('should not match different ETag', () => {
		const matches = etagMatches('"abc123"', ['"def456"', '"ghi789"']);
		expect(matches).toBe(false);
	});

	test('should handle empty array', () => {
		const matches = etagMatches('"abc123"', []);
		expect(matches).toBe(false);
	});
});
