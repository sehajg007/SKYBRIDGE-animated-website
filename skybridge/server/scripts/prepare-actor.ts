import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const domain = await readFile(resolve(root, 'shared/domain.ts'), 'utf8');
await writeFile(resolve(root, 'actor/src/domain.ts'), '// GENERATED from shared/domain.ts by npm run prepare:actor. Edit the canonical shared file.\n' + domain);
console.log('Prepared self-contained Terse actor source. No source outside actor/ is needed for deployment.');

// durable-actors 0.14.6 declaration bundling uses directory symlinks.
// Windows junctions resolve the same package without symlink privileges.
if (process.platform === 'win32') {
  const compiler = resolve(root, 'node_modules/durable-actors/dist/compiler/declarations.js');
  const source = await readFile(compiler, 'utf8');
  const original = 'symlinkSync(pkg.directory, link, "dir");';
  const patched = 'symlinkSync(pkg.directory, link, process.platform === "win32" ? "junction" : "dir");';
  if (source.includes(original)) await writeFile(compiler, source.replace(original, patched));
  else if (!source.includes(patched)) throw new Error('Review Windows declaration compiler compatibility patch for this SDK version.');
}
