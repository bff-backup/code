import { createHooks } from '@bff-backup/react-query';
import { createClient, Operations } from '../components/generated/client';
const client = createClient(); // Typesafe WunderGraph client

export const { useQuery, useMutation, useSubscription, useUser, useFileUpload, useAuth, queryKey } =
	createHooks<Operations>(client);
