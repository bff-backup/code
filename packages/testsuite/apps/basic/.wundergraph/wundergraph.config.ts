import { authProviders, configureWunderGraphApplication, cors, introspect } from '@bff-backup/sdk';
import server from './wundergraph.server';
import operations from './wundergraph.operations';
import generate from './wundergraph.generate';

const countries = introspect.graphql({
	apiNamespace: 'countries',
	url: 'https://countries.trevorblades.com/',
});

const weather = introspect.graphql({
	apiNamespace: 'weather',
	url: 'https://weather-api.wundergraph.com/',
	introspection: {
		pollingIntervalSeconds: 5,
	},
});

const geojson = introspect.openApi({
	apiNamespace: 'geojson',
	source: {
		kind: 'file',
		filePath: './geojson.yaml',
	},
});

const chinook = introspect.sqlite({
	apiNamespace: 'chinook',
	databaseURL: 'file:./Chinook.sqlite',
	// Ensure the data sources without fetch configuration don't make wunderctl
	// crash when specifying a custom request timeout. See https://github.com/wundergraph/wundergraph/pull/904
	requestTimeoutSeconds: 5,
});

const usersPost = introspect.prisma({
	apiNamespace: 'users_post',
	prismaFilePath: './schema.prisma',
	introspection: {
		disableCache: true,
	},
});

const spacex = introspect.graphql({
	apiNamespace: 'spacex',
	url: 'https://spacex-api.fly.dev/graphql/',
	schemaExtension: `
	extend type Capsule {
		myCustomField: String
	}
	`,
	introspection: {
		disableCache: true,
	},
});

// configureWunderGraph emits the configuration
configureWunderGraphApplication({
	apis: [weather, countries, chinook, usersPost, geojson, spacex],
	server,
	operations,
	generate,
	authorization: {
		roles: ['admin', 'user'],
	},
	cors: {
		...cors.allowAll,
		allowedOrigins:
			process.env.NODE_ENV === 'production'
				? [
						// change this before deploying to production to the actual domain where you're deploying your app
						'http://localhost:3000',
				  ]
				: ['http://localhost:3000'],
	},
	authentication: {
		cookieBased: {
			providers: [authProviders.demo()],
			authorizedRedirectUris: ['http://localhost:3000'],
		},
	},
	security: {
		enableGraphQLEndpoint: true,
	},
});
