import type { WebhookHttpEvent, WebhookHttpResponse } from '@bff-backup/sdk/server';
import { createWebhook } from '../generated/wundergraph.webhooks';

const webhook = createWebhook<WebhookHttpEvent, WebhookHttpResponse>({
	handler: async (event, context) => {
		console.log(`hello ${context.context.hello()}`);
		return {
			statusCode: 200,
			headers: {
				myResponseHeaderVar: 'test',
			},
			body: {
				myResponseBodyVar: 'world',
			},
		};
	},
});

export default webhook;
