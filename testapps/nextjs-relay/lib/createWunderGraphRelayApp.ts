import { createWunderGraphRelayApp } from '@bff-backup/react-relay';
import { client } from '../components/generated/nextjs';

export const { useLiveQuery, WunderGraphRelayProvider, fetchWunderGraphSSRQuery } = createWunderGraphRelayApp({
	client,
});
