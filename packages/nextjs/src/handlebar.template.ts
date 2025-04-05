//language=handlebars
export const handlebarTemplate = `
import { createWunderGraphNext as createWunderGraphNextInternal, createHooks, WithWunderGraphOptions, SSRCache } from '@bff-backup/nextjs';
import { User } from '@bff-backup/sdk/client';
import { createClient, Operations, UserRole } from './client';

export interface WunderGraphPageProps {
    ssrCache?: SSRCache,
    user?: User<UserRole>
}

export interface CreateWunderGraphNextOptions extends Omit<WithWunderGraphOptions, 'client'> {
	baseURL?: string;
}

export const createWunderGraphNext = (options: CreateWunderGraphNextOptions) => {
    const { baseURL, ...rest } = options
    const client = createClient(baseURL ? {
        baseURL
    } : undefined);
    
    return createWunderGraphNextInternal<Operations, typeof client>({
        client,
        ...rest
    })
}

const { client, withWunderGraph, useQuery, useMutation, useSubscription, useUser, useAuth, useFileUpload } = createWunderGraphNext({
	ssr: true,
});

export { client, withWunderGraph, useQuery, useMutation, useSubscription, useUser, useAuth, useFileUpload };
`;
