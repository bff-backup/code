import { createClient, Operations } from '../generated/client';
import { createHooks } from '@undergraph-dev/swr';

export const client = createClient();

export const { useQuery, useMutation, useSubscription, useUser, useAuth } = createHooks<Operations>(client);
