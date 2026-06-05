import { InvalidPayloadError } from '@directus/errors';
import type { AbstractServiceOptions, FieldMeta, RawCollection, RawField, RawRelation } from '@directus/types';
import { transaction } from '../utils/transaction.js';
import { CollectionsService } from './collections.js';
import { FieldsService } from './fields.js';
import { ItemsService } from './items.js';
import { RelationsService } from './relations.js';

export interface TranslationGenerationOptions {
	/** The collection to add translations to */
	collection: string;
	/** The name for the translations field (defaults to 'translations') */
	fieldName?: string;
	/** The languages collection to use (defaults to 'languages') */
	languagesCollection?: string;
	/** Fields to include in the translation junction collection */
	translatableFields?: Array<{
		field: string;
		type: string;
		meta?: Partial<FieldMeta>;
	}>;
}

export interface TranslationGenerationResult {
	/** The created translations field */
	translationsField: string;
	/** The created junction collection */
	junctionCollection: string;
	/** The languages collection used */
	languagesCollection: string;
	/** Whether a new languages collection was created */
	languagesCollectionCreated: boolean;
	/** The created translatable fields */
	translatableFields: string[];
}

export class TranslationGeneratorService {
	collectionsService: CollectionsService;
	fieldsService: FieldsService;
	relationsService: RelationsService;

	constructor(options: AbstractServiceOptions) {
		this.collectionsService = new CollectionsService(options);
		this.fieldsService = new FieldsService(options);
		this.relationsService = new RelationsService(options);
	}

	/**
	 * Generate translation structure for a collection
	 */
	async generateTranslations(options: TranslationGenerationOptions): Promise<TranslationGenerationResult> {
		const {
			collection,
			fieldName = 'translations',
			languagesCollection = 'languages',
			translatableFields = [],
		} = options;

		// Validate the collection exists
		const collections = await this.collectionsService.readByQuery();
		const targetCollection = collections.find((c) => c.collection === collection);

		if (!targetCollection) {
			throw new InvalidPayloadError({ reason: `Collection "${collection}" does not exist` });
		}

		// Check if translations field already exists
		const fields = await this.fieldsService.readAll(collection);
		const existingTranslationsField = fields.find((f) => f.field === fieldName);

		if (existingTranslationsField) {
			throw new InvalidPayloadError({ reason: `Field "${fieldName}" already exists on collection "${collection}"` });
		}

		// Get primary key field of the collection
		const primaryKeyField = fields.find((f) => f.schema?.is_primary_key === true);

		if (!primaryKeyField) {
			throw new InvalidPayloadError({ reason: `Collection "${collection}" does not have a primary key field` });
		}

		const junctionCollectionName = `${collection}_translations`;

		// Check if junction collection already exists
		const existingJunctionCollection = collections.find((c) => c.collection === junctionCollectionName);

		if (existingJunctionCollection) {
			throw new InvalidPayloadError({ reason: `Junction collection "${junctionCollectionName}" already exists` });
		}

		let languagesCollectionCreated = false;
		let languagesCollectionPrimaryKeyField = 'code';

		return await transaction(this.collectionsService.knex, async (trx) => {
			const collectionsService = new CollectionsService({
				knex: trx,
				schema: this.collectionsService.schema,
				accountability: this.collectionsService.accountability,
			});

			const fieldsService = new FieldsService({
				knex: trx,
				schema: this.collectionsService.schema,
				accountability: this.collectionsService.accountability,
			});

			const relationsService = new RelationsService({
				knex: trx,
				schema: this.collectionsService.schema,
				accountability: this.collectionsService.accountability,
			});

			// Check if languages collection exists, create if not
			const existingLanguagesCollection = collections.find((c) => c.collection === languagesCollection);

			if (!existingLanguagesCollection) {
				await this.createLanguagesCollection(collectionsService, languagesCollection);
				languagesCollectionCreated = true;
			} else {
				// Get the primary key field of the existing languages collection
				const languagesFields = await fieldsService.readAll(languagesCollection);
				const languagesPrimaryKeyField = languagesFields.find((f) => f.schema?.is_primary_key === true);

				if (languagesPrimaryKeyField) {
					languagesCollectionPrimaryKeyField = languagesPrimaryKeyField.field;
				}
			}

			// Create junction collection
			await this.createJunctionCollection(
				collectionsService,
				fieldsService,
				junctionCollectionName,
				collection,
				primaryKeyField.field,
				primaryKeyField.type,
				languagesCollection,
				languagesCollectionPrimaryKeyField,
				translatableFields,
			);

			// Create relations
			await this.createTranslationRelations(
				relationsService,
				collection,
				primaryKeyField.field,
				junctionCollectionName,
				languagesCollection,
				languagesCollectionPrimaryKeyField,
				fieldName,
			);

			// Create the translations field on the main collection
			await fieldsService.createField(collection, {
				field: fieldName,
				type: 'alias',
				meta: {
					special: ['translations'],
					interface: 'translations',
					display: 'translations',
					options: {
						userLanguage: true,
						defaultLanguage: 'en-US',
						languageField: 'name',
						languageDirectionField: 'direction',
						defaultOpenSplitView: false,
					},
					display_options: {
						template: '{{title}}',
						languageField: 'name',
						defaultLanguage: 'en-US',
						userLanguage: true,
					},
				},
			});

			return {
				translationsField: fieldName,
				junctionCollection: junctionCollectionName,
				languagesCollection,
				languagesCollectionCreated,
				translatableFields: translatableFields.map((f) => f.field),
			};
		});
	}

	/**
	 * Create the languages collection with default languages
	 */
	private async createLanguagesCollection(
		collectionsService: CollectionsService,
		languagesCollection: string,
	): Promise<void> {
		const languagesCollectionData: RawCollection = {
			collection: languagesCollection,
			meta: {
				icon: 'translate',
				note: 'Available languages for content translation',
			},
			schema: {
				name: languagesCollection,
			},
			fields: [
				{
					field: 'code',
					type: 'string',
					schema: {
						is_primary_key: true,
						max_length: 10,
					},
					meta: {
						interface: 'input',
						display: 'raw',
						required: true,
						note: 'Language code (e.g., en-US, fr-FR)',
					},
				},
				{
					field: 'name',
					type: 'string',
					schema: {},
					meta: {
						interface: 'input',
						display: 'raw',
						required: true,
					},
				},
				{
					field: 'direction',
					type: 'string',
					schema: {
						default_value: 'ltr',
					},
					meta: {
						interface: 'select-dropdown',
						display: 'labels',
						options: {
							choices: [
								{
									text: '$t:left_to_right',
									value: 'ltr',
								},
								{
									text: '$t:right_to_left',
									value: 'rtl',
								},
							],
						},
						display_options: {
							choices: [
								{
									text: '$t:left_to_right',
									value: 'ltr',
								},
								{
									text: '$t:right_to_left',
									value: 'rtl',
								},
							],
							format: false,
						},
					},
				},
			],
		};

		await collectionsService.createOne(languagesCollectionData);

		// Add default languages
		const itemsService = new ItemsService(languagesCollection, {
			knex: collectionsService.knex,
			schema: collectionsService.schema,
			accountability: collectionsService.accountability,
		});

		await itemsService.createMany([
			{
				code: 'en-US',
				name: 'English',
				direction: 'ltr',
			},
			{
				code: 'ar-SA',
				name: 'Arabic',
				direction: 'rtl',
			},
			{
				code: 'de-DE',
				name: 'German',
				direction: 'ltr',
			},
			{
				code: 'fr-FR',
				name: 'French',
				direction: 'ltr',
			},
			{
				code: 'ru-RU',
				name: 'Russian',
				direction: 'ltr',
			},
			{
				code: 'es-ES',
				name: 'Spanish',
				direction: 'ltr',
			},
			{
				code: 'it-IT',
				name: 'Italian',
				direction: 'ltr',
			},
			{
				code: 'pt-BR',
				name: 'Portuguese',
				direction: 'ltr',
			},
		]);
	}

	/**
	 * Create the junction collection for translations
	 */
	private async createJunctionCollection(
		collectionsService: CollectionsService,
		fieldsService: FieldsService,
		junctionCollectionName: string,
		parentCollection: string,
		parentPrimaryKey: string,
		parentPrimaryKeyType: string,
		languagesCollection: string,
		languagesPrimaryKey: string,
		translatableFields: Array<{
			field: string;
			type: string;
			meta?: Partial<FieldMeta>;
		}>,
	): Promise<void> {
		// Create the junction collection
		const junctionCollectionData: RawCollection = {
			collection: junctionCollectionName,
			meta: {
				hidden: true,
				icon: 'import_export',
				note: `Translation junction table for ${parentCollection}`,
			},
			schema: {
				name: junctionCollectionName,
			},
			fields: [
				{
					field: 'id',
					type: 'integer',
					schema: {
						is_primary_key: true,
						has_auto_increment: true,
					},
					meta: {
						hidden: true,
					},
				},
				{
					field: `${parentCollection}_${parentPrimaryKey}`,
					type: parentPrimaryKeyType,
					schema: {},
					meta: {
						hidden: true,
					},
				},
				{
					field: `${languagesCollection}_${languagesPrimaryKey}`,
					type: languagesPrimaryKey === 'code' ? 'string' : 'integer',
					schema: {},
					meta: {
						hidden: true,
					},
				},
			],
		};

		await collectionsService.createOne(junctionCollectionData);

		// Add translatable fields to the junction collection
		for (const field of translatableFields) {
			const fieldData: RawField = {
				collection: junctionCollectionName,
				field: field.field,
				type: field.type,
				meta: {
					width: 'full',
					...field.meta,
				},
			};

			await fieldsService.createField(junctionCollectionName, fieldData);
		}
	}

	/**
	 * Create the necessary relations for translations
	 */
	private async createTranslationRelations(
		relationsService: RelationsService,
		parentCollection: string,
		parentPrimaryKey: string,
		junctionCollection: string,
		languagesCollection: string,
		languagesPrimaryKey: string,
		translationsFieldName: string,
	): Promise<void> {
		// O2M relation: parent collection -> junction collection
		const o2mRelation: Partial<RawRelation> = {
			collection: junctionCollection,
			field: `${parentCollection}_${parentPrimaryKey}`,
			related_collection: parentCollection,
			meta: {
				one_field: translationsFieldName,
				sort_field: null,
				one_deselect_action: 'nullify',
				junction_field: `${languagesCollection}_${languagesPrimaryKey}`,
			},
			schema: {
				on_delete: 'SET NULL',
			},
		};

		await relationsService.createOne(o2mRelation);

		// M2O relation: junction collection -> languages collection
		const m2oRelation: Partial<RawRelation> = {
			collection: junctionCollection,
			field: `${languagesCollection}_${languagesPrimaryKey}`,
			related_collection: languagesCollection,
			meta: {
				one_field: null,
				sort_field: null,
				one_deselect_action: 'nullify',
				junction_field: `${parentCollection}_${parentPrimaryKey}`,
			},
			schema: {
				on_delete: 'SET NULL',
			},
		};

		await relationsService.createOne(m2oRelation);
	}
}
