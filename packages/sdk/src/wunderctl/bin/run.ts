#!/usr/bin/env node

import { cli } from '@bff-backup/wunderctl';

cli().catch((err: any) => {
	console.error(err);
	process.exit(1);
});
