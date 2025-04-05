import { createClient, Operations } from '../generated/client';

import { createHooks } from '@bff-backup/swr';

export const client = createClient();

export const { useQuery, useMutation, useSubscription, useUser, useAuth } = createHooks<Operations>(client);
