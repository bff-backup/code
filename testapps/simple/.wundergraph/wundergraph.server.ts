import { configureWunderGraphServer } from '@undergraph-dev/sdk/server';
import config from './wundergraph.config';

export default configureWunderGraphServer(() => ({
	integrations: config.integrations,
	hooks: {},
}));
