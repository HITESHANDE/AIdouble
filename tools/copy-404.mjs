import { copyFileSync } from 'node:fs';
import { join } from 'node:path';

const output = join('dist', 'aidouble', 'browser');
copyFileSync(join(output, 'index.html'), join(output, '404.html'));
