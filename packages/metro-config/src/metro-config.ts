import { MetroConfig } from 'metro-config';

/**
 * Add resolvers and required polyfills to the metro config
 */
export const wgMetroConfig = (config: MetroConfig) => {
	return {
		...config,
		transformer: {
			...config.transformer,
			babelTransformerPath: require.resolve('./transformer'),
		},
		resolver: {
			...config.resolver,
			resolveRequest: (context, moduleName, platform) => {
				// React Native doesn't support exports field in package.json, so we resolve it manually.
				if (moduleName.startsWith('@bff-backup/sdk/client')) {
					return context.resolveRequest(context, '@bff-backup/sdk/dist/client', platform);
				}

				if (moduleName.startsWith('@bff-backup/sdk/internal')) {
					return context.resolveRequest(context, '@bff-backup/sdk/dist/internal', platform);
				}

				if (config.resolver?.resolveRequest) {
					return config.resolver.resolveRequest(context, moduleName, platform);
				}

				return context.resolveRequest(context, moduleName, platform);
			},
		},
	} as MetroConfig;
};
