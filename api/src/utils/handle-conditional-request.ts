import type { Request, Response } from 'express';
import { parseIfNoneMatch, etagMatches } from './generate-etag.js';

/**
 * Handle conditional requests for cache revalidation.
 * 
 * Checks If-None-Match and If-Modified-Since headers and returns true if a 304 Not Modified
 * response should be sent instead of the full asset.
 * 
 * Per RFC 7232:
 * - If-None-Match takes precedence over If-Modified-Since
 * - For GET/HEAD requests, return 304 if condition matches
 * - ETags are compared using strong comparison for GET requests
 */
export function shouldReturn304(
	req: Request,
	currentETag: string,
	lastModified?: Date,
): boolean {
	const method = req.method.toLowerCase();
	
	// Only handle conditional requests for GET and HEAD
	if (method !== 'get' && method !== 'head') {
		return false;
	}

	const ifNoneMatch = req.headers['if-none-match'];
	const ifModifiedSince = req.headers['if-modified-since'];

	// If-None-Match takes precedence per RFC 7232 section 3.2
	if (ifNoneMatch) {
		const clientETags = parseIfNoneMatch(ifNoneMatch);
		return etagMatches(currentETag, clientETags);
	}

	// Fall back to If-Modified-Since if no If-None-Match
	if (ifModifiedSince && lastModified) {
		const ifModifiedSinceDate = new Date(ifModifiedSince);
		
		// Return 304 if the resource hasn't been modified since the client's cached version
		// Use <= comparison to handle cases where modification times are equal
		return lastModified <= ifModifiedSinceDate;
	}

	return false;
}

/**
 * Send a 304 Not Modified response with appropriate headers.
 */
export function send304Response(
	res: Response,
	etag: string,
	lastModified?: Date,
	cacheControl?: string,
	vary?: string[],
): void {
	res.status(304);
	
	// Set required headers for 304 response
	res.setHeader('ETag', etag);
	
	if (lastModified) {
		res.setHeader('Last-Modified', lastModified.toUTCString());
	}
	
	if (cacheControl) {
		res.setHeader('Cache-Control', cacheControl);
	}
	
	if (vary && vary.length > 0) {
		res.setHeader('Vary', vary.join(', '));
	}
	
	// End the response without a body
	res.end();
}