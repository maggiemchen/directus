<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import api from '@/api';
import VButton from '@/components/v-button.vue';
import VCardActions from '@/components/v-card-actions.vue';
import VCardText from '@/components/v-card-text.vue';
import VCardTitle from '@/components/v-card-title.vue';
import VCard from '@/components/v-card.vue';
import VDialog from '@/components/v-dialog.vue';
import VIcon from '@/components/v-icon/v-icon.vue';
import VInput from '@/components/v-input.vue';
import VListItemContent from '@/components/v-list-item-content.vue';
import VListItemIcon from '@/components/v-list-item-icon.vue';
import VListItem from '@/components/v-list-item.vue';
import VList from '@/components/v-list.vue';
import VSelect from '@/components/v-select.vue';
import { useCollectionsStore } from '@/stores/collections';
import { useFieldsStore } from '@/stores/fields';
import { notify } from '@/utils/notify';

const props = defineProps<{
	collection: string;
	modelValue: boolean;
}>();

const emit = defineEmits<{
	'update:modelValue': [value: boolean];
	generated: [];
}>();

const { t } = useI18n();
const fieldsStore = useFieldsStore();
const collectionsStore = useCollectionsStore();

const loading = ref(false);

const formData = ref({
	fieldName: 'translations',
	languagesCollection: 'languages',
	translatableFields: [] as Array<{
		field: string;
		type: string;
		meta?: Record<string, any>;
	}>,
});

const newFieldData = ref({
	field: '',
	type: 'string',
	interface: 'input',
});

const fieldTypeOptions = [
	{ text: t('field_types.string'), value: 'string' },
	{ text: t('field_types.text'), value: 'text' },
	{ text: t('field_types.integer'), value: 'integer' },
	{ text: t('field_types.float'), value: 'float' },
	{ text: t('field_types.boolean'), value: 'boolean' },
	{ text: t('field_types.date'), value: 'date' },
	{ text: t('field_types.dateTime'), value: 'dateTime' },
	{ text: t('field_types.json'), value: 'json' },
];

const interfaceOptions = computed(() => {
	const type = newFieldData.value.type;

	const baseOptions = [
		{ text: t('interfaces.input'), value: 'input' },
		{ text: t('interfaces.textarea'), value: 'textarea' },
	];

	if (type === 'text') {
		baseOptions.push(
			{ text: t('interfaces.input_rich_text_html'), value: 'input-rich-text-html' },
			{ text: t('interfaces.input_rich_text_md'), value: 'input-rich-text-md' },
		);
	}

	if (type === 'boolean') {
		return [
			{ text: t('interfaces.boolean'), value: 'boolean' },
			{ text: t('interfaces.toggle'), value: 'toggle' },
		];
	}

	if (type === 'date') {
		return [{ text: t('interfaces.datetime'), value: 'datetime' }];
	}

	if (type === 'dateTime') {
		return [{ text: t('interfaces.datetime'), value: 'datetime' }];
	}

	if (type === 'json') {
		return [{ text: t('interfaces.input_code'), value: 'input-code' }];
	}

	if (type === 'integer' || type === 'float') {
		return [
			{ text: t('interfaces.input'), value: 'input' },
			{ text: t('interfaces.slider'), value: 'slider' },
		];
	}

	return baseOptions;
});

const existingLanguagesCollections = computed(() => {
	return collectionsStore.collections
		.filter((collection) => !collection.collection.startsWith('directus_'))
		.map((collection) => ({
			text: collection.name || collection.collection,
			value: collection.collection,
		}));
});

const canGenerate = computed(() => {
	return (
		formData.value.fieldName.trim() !== '' &&
		formData.value.languagesCollection.trim() !== '' &&
		formData.value.translatableFields.length > 0
	);
});

function addTranslatableField() {
	if (newFieldData.value.field.trim() === '') return;

	const meta: Record<string, any> = {
		interface: newFieldData.value.interface,
	};

	// Add interface-specific options
	if (newFieldData.value.interface === 'input-rich-text-html') {
		meta.options = { toolbar: ['bold', 'italic', 'underline', 'link', 'code', 'removeformat'] };
	} else if (newFieldData.value.interface === 'input-rich-text-md') {
		meta.options = { placeholder: t('wysiwyg_options.placeholder') };
	} else if (newFieldData.value.interface === 'textarea') {
		meta.options = { placeholder: t('enter_a_value') };
	}

	formData.value.translatableFields.push({
		field: newFieldData.value.field,
		type: newFieldData.value.type,
		meta,
	});

	// Reset form
	newFieldData.value = {
		field: '',
		type: 'string',
		interface: 'input',
	};
}

function removeTranslatableField(index: number) {
	formData.value.translatableFields.splice(index, 1);
}

function getInterfaceIcon(interfaceType: string): string {
	const iconMap: Record<string, string> = {
		input: 'text_fields',
		textarea: 'subject',
		'input-rich-text-html': 'format_bold',
		'input-rich-text-md': 'code',
		boolean: 'toggle_on',
		toggle: 'toggle_on',
		datetime: 'schedule',
		'input-code': 'code',
		slider: 'linear_scale',
	};

	return iconMap[interfaceType] || 'text_fields';
}

function getTypeColor(type: string): string {
	const colorMap: Record<string, string> = {
		string: 'blue',
		text: 'blue',
		integer: 'green',
		float: 'green',
		boolean: 'purple',
		date: 'orange',
		dateTime: 'orange',
		json: 'red',
	};

	return colorMap[type] || 'blue';
}

async function generateTranslations() {
	loading.value = true;

	try {
		const response = await api.post(`/collections/${props.collection}/translations/generate`, formData.value);

		notify({
			title: t('translation_structure_generated'),
			text: t('translation_structure_generated_copy', {
				collection: response.data.data.junctionCollection,
				field: response.data.data.translationsField,
			}),
			type: 'success',
		});

		// Refresh stores to show new fields and collections
		await Promise.all([fieldsStore.hydrate(), collectionsStore.hydrate()]);

		emit('generated');
		closeDialog();
	} catch (error: any) {
		notify({
			title: t('something_went_wrong'),
			text: error?.response?.data?.errors?.[0]?.message || error.message,
			type: 'error',
		});
	} finally {
		loading.value = false;
	}
}

function closeDialog() {
	emit('update:modelValue', false);
}

function resetForm() {
	formData.value = {
		fieldName: 'translations',
		languagesCollection: 'languages',
		translatableFields: [],
	};

	newFieldData.value = {
		field: '',
		type: 'string',
		interface: 'input',
	};
}

// Reset form when dialog opens
function onDialogOpen() {
	resetForm();
}
</script>

<template>
	<VDialog
		:model-value="modelValue"
		persistent
		@update:model-value="$emit('update:modelValue', $event)"
		@opened="onDialogOpen"
	>
		<VCard
style="

--v-card-max-width: 50rem">
			<VCardTitle>
				<VIcon name="translate" left />
				{{ t('generate_translation_structure') }}
			</VCardTitle>

			<VCardText>
				<div class="grid">
					<div class="field">
						<label class="type-label">{{ t('translation_field_name') }}</label>
						<VInput v-model="formData.fieldName" :placeholder="t('translation_field_name_placeholder')" db-safe />
					</div>

					<div class="field">
						<label class="type-label">{{ t('languages_collection') }}</label>
						<VSelect
							v-model="formData.languagesCollection"
							:items="[
								{ text: t('create_new_languages_collection'), value: 'languages' },
								...existingLanguagesCollections,
							]"
							:placeholder="t('select_languages_collection')"
						/>
					</div>

					<div class="field full">
						<label class="type-label">{{ t('translatable_fields') }}</label>
						<div class="translatable-fields">
							<VList v-if="formData.translatableFields.length > 0">
								<VListItem
									v-for="(field, index) in formData.translatableFields"
									:key="index"
									clickable
									@click="removeTranslatableField(index)"
								>
									<VListItemIcon>
										<VIcon :name="getInterfaceIcon(field.meta?.interface || 'input')" />
									</VListItemIcon>
									<VListItemContent>
										<span class="field-name">{{ field.field }}</span>
										<span class="field-type" :class="`type-${getTypeColor(field.type)}`">
											{{ field.type }}
										</span>
										<span class="field-interface">{{ field.meta?.interface || 'input' }}</span>
									</VListItemContent>
									<VIcon name="close" class="remove-icon" />
								</VListItem>
							</VList>
							<div v-else class="empty-state">
								<VIcon name="translate" />
								<p>{{ t('no_translatable_fields') }}</p>
							</div>
						</div>

						<div class="add-field-form">
							<h4 class="type-label">{{ t('add_translatable_field') }}</h4>
							<div class="field-inputs">
								<VInput
									v-model="newFieldData.field"
									:placeholder="t('translatable_field_name')"
									db-safe
									class="field-name-input"
								/>
								<VSelect
									v-model="newFieldData.type"
									:items="fieldTypeOptions"
									:placeholder="t('field_type')"
									class="field-type-input"
								/>
								<VSelect
									v-model="newFieldData.interface"
									:items="interfaceOptions"
									:placeholder="t('interface')"
									class="field-interface-input"
								/>
								<VButton icon secondary :disabled="!newFieldData.field.trim()" @click="addTranslatableField">
									<VIcon name="add" />
								</VButton>
							</div>
						</div>
					</div>
				</div>
			</VCardText>

			<VCardActions>
				<VButton secondary @click="closeDialog">
					{{ t('cancel') }}
				</VButton>
				<VButton :loading="loading" :disabled="!canGenerate" @click="generateTranslations">
					{{ t('generate_translations') }}
				</VButton>
			</VCardActions>
		</VCard>
	</VDialog>
</template>

<style lang="scss" scoped>
.grid {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 1.5rem 0.75rem;
	align-items: start;
}

.field {
	display: flex;
	flex-direction: column;
	gap: 0.5rem;

	&.full {
		grid-column: 1 / -1;
	}

	label {
		font-weight: 600;
	}
}

.translatable-fields {
	border: var(--theme--border-width) solid var(--theme--form--field--input--border-color);
	border-radius: var(--theme--border-radius);
	min-block-size: 7.5rem;
	background-color: var(--theme--background-subdued);

	.v-list {
		background-color: transparent;
		padding: 0;

		.v-list-item {
			--v-list-item-background-color-hover: var(--theme--background-accent);
			padding: 0.5rem 0.75rem;
			border-block-end: var(--theme--border-width) solid var(--theme--border-color-subdued);

			&:last-child {
				border-block-end: none;
			}
		}
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		block-size: 7.5rem;
		color: var(--theme--foreground-subdued);

		.v-icon {
			font-size: 3rem;
			margin-block-end: 0.5rem;
			opacity: 0.5;
		}

		p {
			margin: 0;
			font-size: 0.875rem;
		}
	}
}

.field-name {
	font-weight: 600;
	margin-inline-end: 0.75rem;
}

.field-type {
	display: inline-block;
	padding: 0.125rem 0.5rem;
	border-radius: 0.75rem;
	font-size: 0.6875rem;
	font-weight: 600;
	text-transform: uppercase;
	margin-inline-end: 0.5rem;

	&.type-blue {
		background-color: var(--blue-10);
		color: var(--blue);
	}

	&.type-green {
		background-color: var(--green-10);
		color: var(--green);
	}

	&.type-purple {
		background-color: var(--purple-10);
		color: var(--purple);
	}

	&.type-orange {
		background-color: var(--amber-10);
		color: var(--amber);
	}

	&.type-red {
		background-color: var(--red-10);
		color: var(--red);
	}
}

.field-interface {
	font-size: 0.75rem;
	color: var(--theme--foreground-subdued);
	font-style: italic;
}

.remove-icon {
	color: var(--theme--danger);
	font-size: 1.125rem;
}

.add-field-form {
	margin-block-start: 1.5rem;
	padding-block-start: 1.25rem;
	border-block-start: var(--theme--border-width) solid var(--theme--border-color-subdued);

	h4 {
		margin-block-end: 0.75rem;
	}
}

.field-inputs {
	display: grid;
	grid-template-columns: 2fr 1fr 1fr auto;
	gap: 0.5rem;
	align-items: end;
}
</style>
