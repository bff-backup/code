import { configureWunderGraphServer } from '@bff-backup/sdk/server';
import config from './wundergraph.config';

export default configureWunderGraphServer(() => ({
	integrations: config.integrations,
	hooks: {},
}));
