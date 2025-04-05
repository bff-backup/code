import { cors, type WunderGraphConfig } from '@bff-backup/sdk';

import { graphql } from '@bff-backup/sdk/datasources';
import { demoAuth } from '@bff-backup/sdk/auth';

import { nextjs } from '@bff-backup/nextjs/integration';
import { minio } from '@bff-backup/sdk/integrations';

import { dynamicTransport } from '@bff-backup/sdk/advanced-hooks';

const countries = graphql({
	namespace: 'countries',
	url: 'https://countries.trevorblades.com/graphql',
});

const weather = graphql({
	namespace: 'weather',
	url: 'https://weather-api.wundergraph.com/',
});

const spaceX = graphql({
	namespace: 'spacex',
	url: 'https://spacex-api.fly.dev/graphql/',
});

const router = dynamicTransport({
	match: {
		operationType: 'query',
	},
	handler: async ({ request }) => {
		console.log('REQ', request);

		const response = await fetch(request);

		const { data } = await response.json();

		console.log('TRANSPORT', data);

		return new Response(JSON.stringify({ data }));
	},
});

export default {
	datasources: [countries, weather, spaceX],
	integrations: [
		nextjs(),
		minio({
			name: 'minio',
			endpoint: '127.0.0.1:9000',
			accessKeyID: 'test',
			secretAccessKey: '12345678',
			bucketName: 'uploads',
			useSSL: false,
		}),
		router,
	],
	authentication: {
		providers: [demoAuth()],
		redirectUris: ['http://localhost:3003*'],
	},
	authorization: {
		roles: ['owner', 'user', 'admin'],
	},
	cors: {
		...cors.allowAll,
		allowedOrigins: ['http://localhost:3003'],
	},
	security: {
		enableGraphQLEndpoint: process.env.NODE_ENV !== 'production',
	},
} satisfies WunderGraphConfig;
