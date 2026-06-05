import { InvalidPayloadError } from '@directus/errors';
import type { Knex } from 'knex';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { CollectionsService } from './collections.js';
import { FieldsService } from './fields.js';
import { RelationsService } from './relations.js';
import { TranslationGeneratorService } from './translation-generator.js';

vi.mock('./collections.js');
vi.mock('./fields.js');
vi.mock('./relations.js');

vi.mock('../utils/transaction.js', () => ({
	transaction: vi.fn((knex, callback) => callback(knex)),
}));

describe('TranslationGeneratorService', () => {
	let service: TranslationGeneratorService;
	let mockKnex: Partial<Knex>;
	let mockCollectionsService: Partial<CollectionsService>;
	let mockFieldsService: Partial<FieldsService>;
	let mockRelationsService: Partial<RelationsService>;

	beforeEach(() => {
		mockKnex = {};

		mockCollectionsService = {
			readByQuery: vi.fn(),
			createOne: vi.fn(),
			knex: mockKnex as Knex,
			schema: {} as any,
			accountability: null,
		};

		mockFieldsService = {
			readAll: vi.fn(),
			createField: vi.fn(),
		};

		mockRelationsService = {
			createOne: vi.fn(),
		};

		vi.mocked(CollectionsService).mockImplementation(() => mockCollectionsService as CollectionsService);
		vi.mocked(FieldsService).mockImplementation(() => mockFieldsService as FieldsService);
		vi.mocked(RelationsService).mockImplementation(() => mockRelationsService as RelationsService);

		service = new TranslationGeneratorService({
			knex: mockKnex as Knex,
			schema: {} as any,
			accountability: null,
		});
	});

	describe('generateTranslations', () => {
		test('should throw error if collection does not exist', async () => {
			vi.mocked(mockCollectionsService.readByQuery!).mockResolvedValue([{ collection: 'other_collection' }]);

			await expect(
				service.generateTranslations({
					collection: 'test_collection',
				}),
			).rejects.toThrow(InvalidPayloadError);

			expect(mockCollectionsService.readByQuery).toHaveBeenCalled();
		});

		test('should throw error if translations field already exists', async () => {
			vi.mocked(mockCollectionsService.readByQuery!).mockResolvedValue([{ collection: 'test_collection' }]);

			vi.mocked(mockFieldsService.readAll!).mockResolvedValue([
				{
					field: 'translations',
					meta: { special: ['translations'] },
				} as any,
			]);

			await expect(
				service.generateTranslations({
					collection: 'test_collection',
				}),
			).rejects.toThrow(InvalidPayloadError);
		});

		test('should throw error if collection has no primary key', async () => {
			vi.mocked(mockCollectionsService.readByQuery!).mockResolvedValue([{ collection: 'test_collection' }]);

			vi.mocked(mockFieldsService.readAll!).mockResolvedValue([
				{
					field: 'some_field',
					schema: { is_primary_key: false },
				} as any,
			]);

			await expect(
				service.generateTranslations({
					collection: 'test_collection',
				}),
			).rejects.toThrow(InvalidPayloadError);
		});

		test('should throw error if junction collection already exists', async () => {
			vi.mocked(mockCollectionsService.readByQuery!).mockResolvedValue([
				{ collection: 'test_collection' },
				{ collection: 'test_collection_translations' },
			]);

			vi.mocked(mockFieldsService.readAll!).mockResolvedValue([
				{
					field: 'id',
					schema: { is_primary_key: true },
					type: 'integer',
				} as any,
			]);

			await expect(
				service.generateTranslations({
					collection: 'test_collection',
				}),
			).rejects.toThrow(InvalidPayloadError);
		});

		test('should successfully generate translations with new languages collection', async () => {
			vi.mocked(mockCollectionsService.readByQuery!).mockResolvedValue([{ collection: 'test_collection' }]);

			vi.mocked(mockFieldsService.readAll!).mockResolvedValue([
				{
					field: 'id',
					schema: { is_primary_key: true },
					type: 'integer',
				} as any,
			]);

			const result = await service.generateTranslations({
				collection: 'test_collection',
				translatableFields: [
					{
						field: 'title',
						type: 'string',
						meta: { interface: 'input' },
					},
				],
			});

			expect(result).toEqual({
				translationsField: 'translations',
				junctionCollection: 'test_collection_translations',
				languagesCollection: 'languages',
				languagesCollectionCreated: true,
				translatableFields: ['title'],
			});

			// Verify that languages collection was created
			expect(mockCollectionsService.createOne).toHaveBeenCalledWith(
				expect.objectContaining({
					collection: 'languages',
				}),
			);

			// Verify that junction collection was created
			expect(mockCollectionsService.createOne).toHaveBeenCalledWith(
				expect.objectContaining({
					collection: 'test_collection_translations',
				}),
			);

			// Verify that translatable field was created
			expect(mockFieldsService.createField).toHaveBeenCalledWith(
				'test_collection_translations',
				expect.objectContaining({
					field: 'title',
					type: 'string',
				}),
			);

			// Verify that translations field was created on main collection
			expect(mockFieldsService.createField).toHaveBeenCalledWith(
				'test_collection',
				expect.objectContaining({
					field: 'translations',
					type: 'alias',
					meta: expect.objectContaining({
						special: ['translations'],
						interface: 'translations',
					}),
				}),
			);

			// Verify that relations were created
			expect(mockRelationsService.createOne).toHaveBeenCalledTimes(2);
		});

		test('should use existing languages collection', async () => {
			vi.mocked(mockCollectionsService.readByQuery!).mockResolvedValue([
				{ collection: 'test_collection' },
				{ collection: 'languages' },
			]);

			vi.mocked(mockFieldsService.readAll!)
				.mockResolvedValueOnce([
					{
						field: 'id',
						schema: { is_primary_key: true },
						type: 'integer',
					} as any,
				])
				.mockResolvedValueOnce([
					{
						field: 'code',
						schema: { is_primary_key: true },
						type: 'string',
					} as any,
				]);

			const result = await service.generateTranslations({
				collection: 'test_collection',
				translatableFields: [],
			});

			expect(result.languagesCollectionCreated).toBe(false);
			expect(result.languagesCollection).toBe('languages');

			// Should not create languages collection
			expect(mockCollectionsService.createOne).toHaveBeenCalledTimes(1); // Only junction collection
		});

		test('should use custom field name and languages collection', async () => {
			vi.mocked(mockCollectionsService.readByQuery!).mockResolvedValue([
				{ collection: 'articles' },
				{ collection: 'custom_languages' },
			]);

			vi.mocked(mockFieldsService.readAll!)
				.mockResolvedValueOnce([
					{
						field: 'id',
						schema: { is_primary_key: true },
						type: 'integer',
					} as any,
				])
				.mockResolvedValueOnce([
					{
						field: 'lang_id',
						schema: { is_primary_key: true },
						type: 'integer',
					} as any,
				]);

			const result = await service.generateTranslations({
				collection: 'articles',
				fieldName: 'article_translations',
				languagesCollection: 'custom_languages',
				translatableFields: [],
			});

			expect(result.translationsField).toBe('article_translations');
			expect(result.languagesCollection).toBe('custom_languages');
			expect(result.junctionCollection).toBe('articles_translations');

			// Verify translations field uses custom name
			expect(mockFieldsService.createField).toHaveBeenCalledWith(
				'articles',
				expect.objectContaining({
					field: 'article_translations',
				}),
			);

			// Verify relations use custom languages collection
			expect(mockRelationsService.createOne).toHaveBeenCalledWith(
				expect.objectContaining({
					collection: 'articles_translations',
					field: 'custom_languages_lang_id',
					related_collection: 'custom_languages',
				}),
			);
		});
	});
});
