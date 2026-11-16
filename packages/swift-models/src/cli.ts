import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { generateSwiftModels } from './generate.js';

const generatedDir = new URL('../../../macos/Generated/', import.meta.url);

function targetPath(filename: string): string {
  return fileURLToPath(new URL(filename, generatedDir));
}

const check = process.argv.includes('--check');
const files = generateSwiftModels();
let drift = false;

for (const [filename, content] of Object.entries(files)) {
  const path = targetPath(filename);
  if (check) {
    let current = '';
    try {
      current = readFileSync(path, 'utf8');
    } catch {
      current = '';
    }
    if (current !== content) {
      drift = true;
      process.stderr.write(`drift detected: ${filename} is out of sync with the schema. Run "npm run generate:swift".\n`);
    } else {
      process.stdout.write(`up to date: ${filename}\n`);
    }
  } else {
    mkdirSync(fileURLToPath(generatedDir), { recursive: true });
    writeFileSync(path, content);
    process.stdout.write(`wrote ${filename}\n`);
  }
}

if (check && drift) process.exit(1);
