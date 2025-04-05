import { configureWunderGraphServer } from '@bff-backup/sdk/server';

export default configureWunderGraphServer(() => ({
	hooks: {
		queries: {},
		mutations: {},
	},
	graphqlServers: [],
}));
