import { defineInterface } from '@directus/extensions';
import InterfaceGroupTabs from './group-tabs.vue';
import PreviewSVG from './preview.svg?raw';

export default defineInterface({
	id: 'group-tabs',
	name: '$t:interfaces.group-tabs.name',
	description: '$t:interfaces.group-tabs.description',
	icon: 'tab',
	component: InterfaceGroupTabs,
	hideLabel: true,
	hideLoader: true,
	autoKey: true,
	types: ['alias'],
	localTypes: ['group'],
	group: 'group',
	options: [
		{
			field: 'tabsPlacement',
			type: 'string',
			name: '$t:interfaces.group-tabs.tabs_placement',
			schema: {
				default_value: 'top',
			},
			meta: {
				width: 'half',
				interface: 'select-dropdown',
				options: {
					choices: [
						{
							text: '$t:interfaces.group-tabs.placement_top',
							value: 'top',
						},
						{
							text: '$t:interfaces.group-tabs.placement_left',
							value: 'left',
						},
					],
				},
			},
		},
		{
			field: 'defaultTab',
			type: 'string',
			name: '$t:interfaces.group-tabs.default_tab',
			schema: {
				default_value: 'first',
			},
			meta: {
				width: 'half',
				interface: 'select-dropdown',
				options: {
					choices: [
						{
							text: '$t:interfaces.group-tabs.first_tab',
							value: 'first',
						},
						{
							text: '$t:interfaces.group-tabs.last_opened_tab',
							value: 'last',
						},
					],
				},
			},
		},
	],
	preview: PreviewSVG,
});
