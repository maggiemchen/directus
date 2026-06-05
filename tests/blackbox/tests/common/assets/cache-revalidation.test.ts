import { createReadStream } from 'node:fs';
import { join } from 'path';
import { getUrl, paths } from '@common/config';
import vendors from '@common/get-dbs-to-test';
import { USER } from '@common/variables';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

const assetsDirectory = [paths.cwd, 'assets'];
const storages = ['local'];

const imageFile = {
	name: 'directus.png',
	type: 'image/png',
	filesize: '7136',
};

const imageFilePath = join(...assetsDirectory, imageFile.name);

describe('/assets - Cache Revalidation', () => {
	describe('GET /assets/:id with ETag support', () => {
		describe.each(storages)('Storage: %s', (storage) => {
			it.each(vendors)('%s', async (vendor) => {
				// Setup - Upload a test file
				const insertResponse = await request(getUrl(vendor))
					.post('/files')
					.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`)
					.field('storage', storage)
					.attach('file', createReadStream(imageFilePath));

				const fileId = insertResponse.body.data.id;

				// First request - should get full response with ETag
				const response1 = await request(getUrl(vendor))
					.get(`/assets/${fileId}`)
					.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

				expect(response1.statusCode).toBe(200);
				expect(response1.headers['content-type']).toBe(imageFile.type);
				expect(response1.headers['content-length']).toBe(imageFile.filesize);
				expect(response1.headers['etag']).toMatch(/^"[a-f0-9]{16}"$/);
				expect(response1.headers['last-modified']).toBeTruthy();
				expect(response1.headers['cache-control']).toBeTruthy();

				const etag = response1.headers['etag'];
				const lastModified = response1.headers['last-modified'];

				// Second request with If-None-Match - should get 304 Not Modified
				const response2 = await request(getUrl(vendor))
					.get(`/assets/${fileId}`)
					.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`)
					.set('If-None-Match', etag);

				expect(response2.statusCode).toBe(304);
				expect(response2.headers['etag']).toBe(etag);
				expect(response2.headers['last-modified']).toBe(lastModified);
				expect(response2.headers['cache-control']).toBeTruthy();
				expect(response2.body).toEqual({});

				// Third request with If-Modified-Since - should get 304 Not Modified
				const response3 = await request(getUrl(vendor))
					.get(`/assets/${fileId}`)
					.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`)
					.set('If-Modified-Since', lastModified);

				expect(response3.statusCode).toBe(304);
				expect(response3.headers['etag']).toBe(etag);
				expect(response3.headers['last-modified']).toBe(lastModified);
				expect(response3.body).toEqual({});

				// Fourth request with wrong ETag - should get full response
				const response4 = await request(getUrl(vendor))
					.get(`/assets/${fileId}`)
					.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`)
					.set('If-None-Match', '"wrong-etag"');

				expect(response4.statusCode).toBe(200);
				expect(response4.headers['etag']).toBe(etag);
				expect(response4.headers['content-length']).toBe(imageFile.filesize);

				// Cleanup
				await request(getUrl(vendor)).delete(`/files/${fileId}`).set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);
			});
		});
	});

	describe('GET /assets/:id with transformations', () => {
		describe.each(storages)('Storage: %s', (storage) => {
			it.each(vendors)('%s - different transformations should have different ETags', async (vendor) => {
				// Setup - Upload a test file
				const insertResponse = await request(getUrl(vendor))
					.post('/files')
					.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`)
					.field('storage', storage)
					.attach('file', createReadStream(imageFilePath));

				const fileId = insertResponse.body.data.id;

				// Request original file
				const originalResponse = await request(getUrl(vendor))
					.get(`/assets/${fileId}`)
					.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

				expect(originalResponse.statusCode).toBe(200);
				const originalETag = originalResponse.headers['etag'];

				// Request with width transformation
				const transformedResponse = await request(getUrl(vendor))
					.get(`/assets/${fileId}`)
					.query({ width: 100 })
					.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

				expect(transformedResponse.statusCode).toBe(200);
				const transformedETag = transformedResponse.headers['etag'];

				// ETags should be different due to different transformation parameters
				expect(originalETag).not.toBe(transformedETag);
				expect(originalETag).toMatch(/^"[a-f0-9]{16}"$/);
				expect(transformedETag).toMatch(/^"[a-f0-9]{16}"$/);

				// Conditional request with original ETag on transformed asset should not match
				const conditionalResponse = await request(getUrl(vendor))
					.get(`/assets/${fileId}`)
					.query({ width: 100 })
					.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`)
					.set('If-None-Match', originalETag);

				expect(conditionalResponse.statusCode).toBe(200); // Should not be 304

				// Conditional request with correct transformed ETag should match
				const matchingResponse = await request(getUrl(vendor))
					.get(`/assets/${fileId}`)
					.query({ width: 100 })
					.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`)
					.set('If-None-Match', transformedETag);

				expect(matchingResponse.statusCode).toBe(304);

				// Cleanup
				await request(getUrl(vendor)).delete(`/files/${fileId}`).set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);
			});
		});
	});

	describe('HEAD /assets/:id', () => {
		describe.each(storages)('Storage: %s', (storage) => {
			it.each(vendors)('%s - should include ETag in HEAD response', async (vendor) => {
				// Setup - Upload a test file
				const insertResponse = await request(getUrl(vendor))
					.post('/files')
					.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`)
					.field('storage', storage)
					.attach('file', createReadStream(imageFilePath));

				const fileId = insertResponse.body.data.id;

				// HEAD request - should get headers including ETag
				const headResponse = await request(getUrl(vendor))
					.head(`/assets/${fileId}`)
					.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

				expect(headResponse.statusCode).toBe(200);
				expect(headResponse.headers['etag']).toMatch(/^"[a-f0-9]{16}"$/);
				expect(headResponse.headers['last-modified']).toBeTruthy();
				expect(headResponse.headers['content-type']).toBe(imageFile.type);
				expect(headResponse.headers['content-length']).toBe(imageFile.filesize);
				expect(headResponse.body).toEqual({});

				// Cleanup
				await request(getUrl(vendor)).delete(`/files/${fileId}`).set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);
			});
		});
	});
});
