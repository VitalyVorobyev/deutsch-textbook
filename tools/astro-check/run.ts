// Type-checks the repo's .astro files (and everything else the root tsconfig includes) with
// @astrojs/check on TypeScript 6. Why this is not `astro check`: see package.json.
import path from 'node:path';
import { check, parseArgsAsCheckConfig } from '@astrojs/check';

const root = path.resolve(import.meta.dir, '../..');
const flags = parseArgsAsCheckConfig(process.argv);
const failed = await check({ ...flags, root });
process.exit(failed ? 1 : 0);
