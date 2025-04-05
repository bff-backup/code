import type { WebhookHttpEvent, WebhookHttpResponse } from '@undergraph-dev/sdk/server';
import { createWebhook } from '../generated/wundergraph.webhooks';

const webhook = createWebhook<WebhookHttpEvent, WebhookHttpResponse>({
	handler: async (event) => {
		return {
			statusCode: 200,
			body: {
				hello: 'world',
			},
		};
	},
});

export default webhook;
