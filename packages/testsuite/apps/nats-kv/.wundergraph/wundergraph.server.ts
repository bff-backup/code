import { configureWunderGraphServer } from '@undergraph-dev/sdk/server';

export default configureWunderGraphServer(() => ({
	hooks: {
		queries: {},
		mutations: {},
	},
	graphqlServers: [],
}));
