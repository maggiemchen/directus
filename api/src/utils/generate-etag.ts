import crypto from 'crypto';
import type { TransformationParams } from '@directus/types';

/**
 * Generate a strong ETag for an asset based on file metadata and transformation parameters.
 *
 * The ETag includes:
 * - File ID (UUID)
 * - File modification time (from database)
 * - File size
 * - Transformation parameters (sorted for consistency)
 * - Accept format (for format=auto content negotiation)
 *
 * This ensures that any change to the file or its transformation will result in a different ETag.
 */
export function generateAssetETag(
	fileId: string,
	modifiedOn: string | null,
	fileSize: number,
	transformationParams: TransformationParams,
	acceptFormat?: string,
): string {
	const parts = [fileId, modifiedOn || '0', fileSize.toString()];

	// Include transformation parameters in a deterministic way
	if (transformationParams && Object.keys(transformationParams).length > 0) {
		// Sort keys to ensure consistent ordering
		const sortedKeys = Object.keys(transformationParams).sort();
		const transformString = sortedKeys.map((key) => `${key}:${JSON.stringify(transformationParams[key])}`).join(',');
		parts.push(transformString);
	}

	// Include accept format for content negotiation
	if (acceptFormat) {
		parts.push(`accept:${acceptFormat}`);
	}

	// Generate a strong ETag using SHA-256 (first 16 characters for brevity)
	const hash = crypto.createHash('sha256').update(parts.join('|')).digest('hex').substring(0, 16);

	// Return as a strong ETag (quoted)
	return `"${hash}"`;
}

/**
 * Parse and normalize ETags from If-None-Match header.
 * Handles both strong and weak ETags, multiple values, and the special "*" case.
 */
export function parseIfNoneMatch(ifNoneMatchHeader?: string): string[] {
	if (!ifNoneMatchHeader) return [];

	// Handle the special case "*" which matches any entity
	if (ifNoneMatchHeader.trim() === '*') return ['*'];

	// Split by comma and normalize each ETag
	return ifNoneMatchHeader
		.split(',')
		.map((etag) => etag.trim())
		.filter((etag) => etag.length > 0)
		.map((etag) => {
			// Remove W/ prefix for weak ETags and normalize to strong ETag format
			if (etag.startsWith('W/')) {
				etag = etag.substring(2);
			}

			// Ensure it's properly quoted
			if (!etag.startsWith('"') || !etag.endsWith('"')) {
				return `"${etag.replace(/"/g, '')}"`;
			}

			return etag;
		});
}

/**
 * Check if the given ETag matches any of the ETags in the If-None-Match header.
 */
export function etagMatches(currentETag: string, ifNoneMatchETags: string[]): boolean {
	if (ifNoneMatchETags.includes('*')) return true;

	// Compare the current ETag against all provided ETags
	return ifNoneMatchETags.includes(currentETag);
}
