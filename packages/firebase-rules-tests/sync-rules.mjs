import { copyFile } from 'node:fs/promises';

await copyFile('../../apps/api-php/firebase/database.rules.json', 'database.rules.json');
