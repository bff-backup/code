import { configureWunderGraphGeneration, templates } from '@bff-backup/sdk';
import { golangClient } from '@bff-backup/golang-client';

export default configureWunderGraphGeneration({
	codeGenerators: [
		{
			templates: [
				...golangClient.all({
					packageName: 'client',
				}),
			],
			path: './generated/golang/client',
		},
	],
	operationsGenerator: (config) => {
		config.includeNamespaces('weather', 'federated');
	},
});
