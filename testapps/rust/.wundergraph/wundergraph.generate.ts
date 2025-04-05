import { configureWunderGraphGeneration, templates } from '@bff-backup/sdk';
import { rustClient } from '@bff-backup/rust-client';

export default configureWunderGraphGeneration({
	codeGenerators: [
		{
			templates: [
				// use all the typescript react templates to generate a client
				...templates.typescript.all,
			],
		},
		{
			templates: rustClient(),
			path: '../rust/client',
		},
	],
	operationsGenerator: (config) => {
		config.includeNamespaces('weather');
		config.includeNamespaces('oas');
	},
});
