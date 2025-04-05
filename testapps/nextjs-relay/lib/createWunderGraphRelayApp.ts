import { createWunderGraphRelayApp } from '@undergraph-dev/react-relay';
import { client } from '../components/generated/nextjs';

export const { useLiveQuery, WunderGraphRelayProvider, fetchWunderGraphSSRQuery } = createWunderGraphRelayApp({
	client,
});
