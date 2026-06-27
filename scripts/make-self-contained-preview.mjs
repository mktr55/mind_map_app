import fs from 'node:fs/promises';
import path from 'node:path';

function parseArgs(argv) {
  const args = { inputDir: 'dist', outputFile: 'preview-inline.html' };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--input' && argv[i + 1]) {
      args.inputDir = argv[++i];
    } else if (arg === '--output' && argv[i + 1]) {
      args.outputFile = argv[++i];
    }
  }
  return args;
}

async function findAsset(rootDir, suffix) {
  const assetsDir = path.join(rootDir, 'assets');
  const entries = await fs.readdir(assetsDir);
  const match = entries.find(name => name.endsWith(suffix));
  if (!match) {
    throw new Error(`Missing asset ending with ${suffix} in ${assetsDir}`);
  }
  return path.join(assetsDir, match);
}

async function main() {
  const { inputDir, outputFile } = parseArgs(process.argv);
  const template = await fs.readFile(path.resolve('index.html'), 'utf8');

  const jsPath = await findAsset(inputDir, '.js');
  const cssPath = await findAsset(inputDir, '.css');
  const jsBase64 = (await fs.readFile(jsPath)).toString('base64');
  const cssText = (await fs.readFile(cssPath, 'utf8')).replaceAll('</style', '<\\/style');

  const loader = `
  <script type="module">
    const base64 = document.getElementById('bundle').textContent.trim();
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: 'text/javascript' });
    import(URL.createObjectURL(blob));
  </script>
  <script id="bundle" type="text/plain">${jsBase64}</script>
  `;

  const preview = template
    .replace('</head>', `  <style>${cssText}</style>\n</head>`)
    .replace('<script type="module" src="/src/main.js"></script>', loader.trimEnd());

  await fs.writeFile(outputFile, preview, 'utf8');
  console.log(`Wrote ${outputFile}`);
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
