<script setup lang="ts">
import { Field, ValidationError } from '@directus/types';
import { isEqual } from 'lodash';
import { ref, watch } from 'vue';
import type { ComparisonContext } from '@/components/v-form/types';
import VForm from '@/components/v-form/v-form.vue';
import VIcon from '@/components/v-icon/v-icon.vue';
import VTabItem from '@/components/v-tab-item.vue';
import VTab from '@/components/v-tab.vue';
import VTabsItems from '@/components/v-tabs-items.vue';
import VTabs from '@/components/v-tabs.vue';
import { CollabContext } from '@/composables/use-collab';

const props = withDefaults(
	defineProps<{
		field: Field;
		fields: Field[];
		values: Record<string, unknown>;
		initialValues: Record<string, unknown>;
		disabled?: boolean;
		nonEditable?: boolean;
		batchMode?: boolean;
		batchActiveFields?: string[];
		collabContext?: CollabContext;
		comparison?: ComparisonContext;
		primaryKey: string | number;
		loading?: boolean;
		validationErrors?: ValidationError[];
		badge?: string;
		rawEditorEnabled?: boolean;
		tabsPlacement?: 'top' | 'left';
		defaultTab?: 'first' | 'last';
		direction?: string;
	}>(),
	{
		batchActiveFields: () => [],
		validationErrors: () => [],
		tabsPlacement: 'top',
		defaultTab: 'first',
	},
);

defineEmits<{
	(e: 'apply', value: Record<string, unknown>): void;
}>();

const activeTab = ref<string[]>([]);
const { groupFields, groupValues } = useComputedGroup();

// Set default active tab
watch(
	() => [groupFields.value, props.defaultTab],
	([fields, defaultTab]) => {
		if (fields.length === 0) return;

		if (defaultTab === 'first' || activeTab.value.length === 0) {
			activeTab.value = [fields[0].field];
		}
	},
	{ immediate: true },
);

// Handle validation errors by switching to tab with error
watch(
	() => props.validationErrors,
	(newVal, oldVal) => {
		if (!props.validationErrors) return;
		if (isEqual(newVal, oldVal)) return;

		const tabsWithErrors = props.validationErrors.filter((validationError) =>
			groupFields.value.find((field) => field.field === validationError.field),
		);

		if (tabsWithErrors.length > 0) {
			activeTab.value = [tabsWithErrors[0].field];
		}
	},
);

function useComputedGroup() {
	const groupFields = ref<Field[]>(limitFields());
	const groupValues = ref<Record<string, any>>(props.values);

	watch(
		() => props.fields,
		() => {
			const newVal = limitFields();

			if (!isEqual(groupFields.value, newVal)) {
				groupFields.value = newVal;
			}
		},
	);

	watch(
		() => props.values,
		(newVal) => {
			if (!isEqual(groupValues.value, newVal)) {
				groupValues.value = newVal;
			}
		},
	);

	return { groupFields, groupValues };

	function limitFields(): Field[] {
		return props.fields.filter((field) => field.meta?.group === props.field.meta?.field);
	}
}

// Check if a tab has validation errors
function hasValidationErrors(tabField: Field): boolean {
	if (!props.validationErrors) return false;
	return props.validationErrors.some((error) => error.field === tabField.field);
}

// Get tab title from field meta
function getTabTitle(field: Field): string {
	return field.meta?.name || field.field;
}
</script>

<template>
	<div class="group-tabs" :class="{ 'tabs-vertical': tabsPlacement === 'left' }">
		<VTabs v-model="activeTab" :vertical="tabsPlacement === 'left'" class="tabs-header">
			<VTab
				v-for="tabField in groupFields"
				:key="tabField.field"
				:value="tabField.field"
				class="tab"
				:class="{ 'has-errors': hasValidationErrors(tabField) }"
			>
				<div class="tab-content">
					<span class="tab-title">{{ getTabTitle(tabField) }}</span>
					<VIcon v-if="hasValidationErrors(tabField)" name="error" class="error-icon" small />
				</div>
			</VTab>
		</VTabs>

		<VTabsItems v-model="activeTab" class="tabs-content">
			<VTabItem v-for="tabField in groupFields" :key="tabField.field" :value="tabField.field">
				<VForm
					:initial-values="initialValues"
					:fields="fields"
					:model-value="groupValues"
					:primary-key="primaryKey"
					:group="tabField.field"
					:validation-errors="validationErrors"
					:loading="loading"
					:batch-mode="batchMode"
					:batch-active-fields="batchActiveFields"
					:disabled="disabled"
					:non-editable="nonEditable"
					:collab-context="collabContext"
					:comparison="comparison"
					:badge="badge"
					:raw-editor-enabled="rawEditorEnabled"
					:direction="direction"
					@update:model-value="$emit('apply', $event)"
				/>
			</VTabItem>
		</VTabsItems>
	</div>
</template>

<style lang="scss" scoped>
.group-tabs {
	border: var(--theme--border-width) solid var(--theme--form--field--input--border-color);
	border-radius: var(--theme--border-radius);
	overflow: hidden;

	&:not(.tabs-vertical) {
		.tabs-header {
			border-block-end: var(--theme--border-width) solid var(--theme--form--field--input--border-color);
		}
	}

	&.tabs-vertical {
		display: flex;
		min-block-size: 18.75rem;

		.tabs-header {
			border-inline-end: var(--theme--border-width) solid var(--theme--form--field--input--border-color);
			min-inline-size: 12.5rem;
			flex-shrink: 0;
		}

		.tabs-content {
			flex: 1;
		}
	}
}

.tabs-content {
	padding: var(--theme--form--row-gap);
	min-block-size: 12.5rem;
}

.tab {
	position: relative;

	&.has-errors {
		.tab-title {
			color: var(--theme--danger);
		}
	}
}

.tab-content {
	display: flex;
	align-items: center;
	gap: 0.5rem;
}

.tab-title {
	font-weight: 500;
}

.error-icon {
	color: var(--theme--danger);
}

/* Override tab styles for better appearance */
:deep(.v-tabs.horizontal) {
	background-color: var(--theme--background);
	padding: 0;

	.v-tab {
		padding: 0.75rem 1rem;
		border-inline-end: var(--theme--border-width) solid var(--theme--form--field--input--border-color);
		background-color: var(--theme--background-subdued);
		color: var(--theme--foreground-subdued);
		font-weight: 500;

		&:first-child {
			border-start-start-radius: var(--theme--border-radius);
		}

		&:last-child {
			border-inline-end: none;
			border-start-end-radius: var(--theme--border-radius);
		}

		&.active {
			background-color: var(--theme--background-page);
			color: var(--theme--foreground);
			border-block-end: 0.125rem solid var(--theme--primary);
			margin-block-end: -0.0625rem;
		}

		&:hover:not(.active) {
			background-color: var(--theme--background);
			color: var(--theme--foreground);
		}
	}
}

:deep(.v-tabs.vertical) {
	.v-list {
		background-color: var(--theme--background);
		padding: 0.5rem 0;
	}

	.v-list-item {
		padding: 0.75rem 1rem;
		margin: 0 0.5rem;
		border-radius: var(--theme--border-radius);
		color: var(--theme--foreground-subdued);

		&.active {
			background-color: var(--theme--primary);
			color: var(--theme--primary-foreground);
		}

		&:hover:not(.active) {
			background-color: var(--theme--background-subdued);
			color: var(--theme--foreground);
		}
	}
}
</style>
