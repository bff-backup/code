#!/usr/bin/env node

import { cli } from '@undergraph-dev/wunderctl';

cli().catch((err: any) => {
	console.error(err);
	process.exit(1);
});
