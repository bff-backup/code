import { configureWunderGraphServer } from '@bff-backup/sdk/server';
import { getHttpResponseError } from '@bff-backup/sdk/client';

export default configureWunderGraphServer(() => ({
	hooks: {
		queries: {
			NoteByID: {
				postResolve: async ({ response }) => {
					if (response.errors) {
						const httpError = getHttpResponseError(response.errors);
						if (httpError) {
							console.log('HTTP status code', httpError.statusCode);
							console.log('HTTP response headers', httpError.headers);
							console.log('HTTP response body', httpError.text);
						}
					}
				},
			},
		},
		mutations: {},
	},
}));
