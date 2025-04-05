import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [react()],
	optimizeDeps: {
		include: ['@bff-backup/swr', '@bff-backup/sdk', '@bff-backup/sdk/client'],
		esbuildOptions: {
			target: 'es2020',
		},
	},
	build: {
		commonjsOptions: {
			include: [/bff-backup/],
		},
	},
});
