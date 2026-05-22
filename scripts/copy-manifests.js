const fs = require('fs');
const path = require('path');

async function main() {
  const root = path.join(__dirname, '..', '.next', 'server', 'app');
  const rootManifest = path.join(root, 'page_client-reference-manifest.js');
  if (!fs.existsSync(rootManifest)) {
    console.warn('Root manifest not found, skipping copy.');
    return;
  }

  async function walk(dir) {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        await walk(full);
      } else if (ent.isFile() && ent.name === 'page.js.nft.json') {
        const targetDir = dir;
        const targetManifest = path.join(targetDir, 'page_client-reference-manifest.js');
        if (!fs.existsSync(targetManifest)) {
          await fs.promises.copyFile(rootManifest, targetManifest);
        }
      }
    }
  }

  try {
    await walk(root);
    console.log('Copied missing page_client-reference-manifest.js files.');
  } catch (err) {
    console.error('Error copying manifests:', err);
    process.exitCode = 1;
  }
}

main();
