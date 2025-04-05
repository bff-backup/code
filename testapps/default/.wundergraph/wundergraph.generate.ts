import { configureWunderGraphGeneration, templates } from '@undergraph-dev/sdk';
import { golangClient } from '@undergraph-dev/golang-client';

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
