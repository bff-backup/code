//language=handlebars
export const template = `
import type { WebhookConfiguration } from '@undergraph-dev/sdk/server';
import type { InternalOperationsClient } from "./wundergraph.internal.operations.client";
import type { ContextType } from "./wundergraph.factory";

import { createWebhookFactory } from "@undergraph-dev/sdk/server";
import type { ORM as TypedORM } from "./orm";

export type WebhooksConfig = {
{{#each webhooks}}
	'{{name}}'?: WebhookConfiguration;
{{/each}}
}

export const createWebhook = createWebhookFactory<InternalOperationsClient, ContextType, TypedORM>();

`;
