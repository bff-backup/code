import { Template, TemplateOutputFile } from '../../index';
import { CodeGenerationConfig } from '../../../configure';
import { template } from './configure_auth_providers.template';
import Handlebars from 'handlebars';
import { AuthProviderKind } from '@bff-backup/protobuf';

export class AuthenticationProviderConfiguration implements Template {
	generate(generationConfig: CodeGenerationConfig): Promise<TemplateOutputFile[]> {
		const model: AuthenticationProviderModel = {
			providers: generationConfig.config.authentication.cookieBased
				.filter((p) => p.id !== 'demo')
				.map((p) => {
					let providerKind: string = 'not defined';
					switch (p.kind) {
						case AuthProviderKind.AuthProviderGithub:
							providerKind = 'GitHub';
							break;
						case AuthProviderKind.AuthProviderOIDC:
							providerKind = 'OpenID Connect';
							break;
					}
					return {
						protocol: 'http',
						providerID: p.id,
						providerKind,
					};
				}),
		};
		const tmpl = Handlebars.compile(template);
		const content = tmpl(model);
		return Promise.resolve([
			{
				path: 'CONFIGURE_AUTH_PROVIDERS.md',
				content: content,
				doNotEditHeader: false,
			},
		]);
	}
}

interface AuthenticationProviderModel {
	providers: Provider[];
}

interface Provider {
	providerID: string;
	providerKind: string;
	protocol: string;
}
