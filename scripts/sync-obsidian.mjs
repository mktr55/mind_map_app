import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_REPO = 'mindflow-data';
const DEFAULT_WORKSPACE_PATH = 'mindflow/workspace.json';
const DEFAULT_OBSIDIAN_DIR =
  '/Users/kz/Library/Mobile Documents/iCloud~md~obsidian/Documents/Obsidian_from_Mac/10_Notes/mindmap';
const DEFAULT_POLL_MS = 60_000;
const MANIFEST_FILE = '.mindflow-manifest.json';

const args = new Set(process.argv.slice(2));
const isWatchMode = args.has('--watch');

const config = {
  token: process.env.MINDFLOW_GITHUB_TOKEN || process.env.GITHUB_TOKEN || process.env.GH_TOKEN,
  owner: process.env.MINDFLOW_GITHUB_OWNER || process.env.GITHUB_OWNER || '',
  repo: process.env.MINDFLOW_GITHUB_REPO || DEFAULT_REPO,
  workspacePath: process.env.MINDFLOW_GITHUB_PATH || DEFAULT_WORKSPACE_PATH,
  outputDir: process.env.MINDFLOW_OBSIDIAN_DIR || DEFAULT_OBSIDIAN_DIR,
  pollMs: Number(process.env.MINDFLOW_OBSIDIAN_POLL_MS || DEFAULT_POLL_MS),
};

function usage() {
  return [
    'MindFlow Obsidian sync',
    '',
    'Required:',
    '  MINDFLOW_GITHUB_TOKEN or GITHUB_TOKEN',
    '',
    'Optional:',
    '  MINDFLOW_GITHUB_OWNER       GitHub owner. If omitted, /user is used.',
    `  MINDFLOW_GITHUB_REPO        Default: ${DEFAULT_REPO}`,
    `  MINDFLOW_GITHUB_PATH        Default: ${DEFAULT_WORKSPACE_PATH}`,
    `  MINDFLOW_OBSIDIAN_DIR       Default: ${DEFAULT_OBSIDIAN_DIR}`,
    `  MINDFLOW_OBSIDIAN_POLL_MS   Default: ${DEFAULT_POLL_MS}`,
    '',
    'Commands:',
    '  npm run sync:obsidian       Run once',
    '  npm run watch:obsidian      Poll and mirror continuously',
  ].join('\n');
}

function requireToken() {
  if (!config.token) {
    throw new Error(`GitHub token is missing.\n\n${usage()}`);
  }
}

async function githubFetch(apiPath) {
  requireToken();
  const res = await fetch(`https://api.github.com${apiPath}`, {
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'mindflow-obsidian-sync',
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`GitHub ${res.status}: ${body.message || res.statusText}`);
  }

  return res.json();
}

async function getOwner() {
  if (config.owner) return config.owner;
  const user = await githubFetch('/user');
  if (!user?.login) throw new Error('Could not infer GitHub owner from /user.');
  return user.login;
}

function decodeGitHubContent(content) {
  return JSON.parse(Buffer.from(content.replace(/\n/g, ''), 'base64').toString('utf8'));
}

function normalizeNode(node, fallbackText = '無題') {
  const data = node?.data && typeof node.data === 'object' ? node.data : {};
  return {
    data: {
      ...data,
      text: data.text || node?.text || fallbackText,
      expand: data.expand !== false,
      uid: data.uid || '',
    },
    children: Array.isArray(node?.children)
      ? node.children.map((child, index) => normalizeNode(child, `トピック ${index + 1}`))
      : [],
  };
}

function normalizeWorkspace(input) {
  const maps = Array.isArray(input?.maps) ? input.maps : [];
  return {
    currentMapId: input?.currentMapId || maps[0]?.id || '',
    updatedAt: input?.updatedAt || new Date().toISOString(),
    maps: maps.map((map, index) => {
      const title = map.title || map.root?.data?.text || `マインドマップ ${index + 1}`;
      return {
        id: map.id || `map-${index + 1}`,
        title,
        updatedAt: map.updatedAt || input?.updatedAt || new Date().toISOString(),
        layout: map.layout || 'logicalStructure',
        root: normalizeNode(map.root, title),
      };
    }),
  };
}

async function fetchWorkspace() {
  const owner = await getOwner();
  const file = await githubFetch(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(config.repo)}/contents/${encodePath(config.workspacePath)}`,
  );
  return normalizeWorkspace(decodeGitHubContent(file.content));
}

function encodePath(filePath) {
  return filePath.split('/').map(encodeURIComponent).join('/');
}

function yamlString(value) {
  return JSON.stringify(String(value ?? ''));
}

function sanitizeFilePart(value) {
  return String(value || 'untitled')
    .normalize('NFKC')
    .replace(/[\\/:*?"<>|#^[\]]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || 'untitled';
}

function nodeText(node, fallback = '無題') {
  return String(node?.data?.text || node?.text || fallback).replace(/\s+/g, ' ').trim() || fallback;
}

function renderNodeMarkdown(node, depth = 0) {
  const indent = '  '.repeat(depth);
  const line = `${indent}- ${nodeText(node)}`;
  const children = Array.isArray(node?.children) ? node.children : [];
  return [line, ...children.flatMap((child) => renderNodeMarkdown(child, depth + 1))];
}

function renderMapMarkdown(map) {
  const frontmatter = [
    '---',
    `id: ${yamlString(map.id)}`,
    `title: ${yamlString(map.title)}`,
    `updatedAt: ${yamlString(map.updatedAt)}`,
    `layout: ${yamlString(map.layout)}`,
    'source: mindflow',
    '---',
  ].join('\n');
  return `${frontmatter}\n\n# ${map.title}\n\n${renderNodeMarkdown(map.root).join('\n')}\n`;
}

function mapFileStem(map, index) {
  const order = String(index + 1).padStart(2, '0');
  return `${order}-${sanitizeFilePart(map.title)}-${sanitizeFilePart(map.id)}`;
}

async function writeJson(filePath, value) {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function readManifest(outputDir) {
  try {
    const raw = await fs.readFile(path.join(outputDir, MANIFEST_FILE), 'utf8');
    const manifest = JSON.parse(raw);
    return Array.isArray(manifest.files) ? manifest.files : [];
  } catch {
    return [];
  }
}

async function removeStaleFiles(outputDir, previousFiles, nextFiles) {
  const next = new Set(nextFiles);
  await Promise.all(
    previousFiles
      .filter((file) => !path.isAbsolute(file) && !file.split('/').includes('..'))
      .filter((file) => !next.has(file))
      .map((file) => fs.unlink(path.join(outputDir, file)).catch((error) => {
        if (error.code !== 'ENOENT') throw error;
      })),
  );
}

async function mirrorWorkspace() {
  const workspace = await fetchWorkspace();
  await fs.mkdir(config.outputDir, { recursive: true });

  const previousFiles = await readManifest(config.outputDir);
  const nextFiles = ['mindflow-workspace.json'];

  await Promise.all(
    workspace.maps.map(async (map, index) => {
      const stem = mapFileStem(map, index);
      nextFiles.push(`${stem}.md`, `${stem}.json`);
      await Promise.all([
        fs.writeFile(path.join(config.outputDir, `${stem}.md`), renderMapMarkdown(map), 'utf8'),
        writeJson(path.join(config.outputDir, `${stem}.json`), map),
      ]);
    }),
  );
  await writeJson(path.join(config.outputDir, 'mindflow-workspace.json'), workspace);
  await removeStaleFiles(config.outputDir, previousFiles, nextFiles);
  await writeJson(path.join(config.outputDir, MANIFEST_FILE), {
    source: 'mindflow',
    updatedAt: new Date().toISOString(),
    files: nextFiles,
  });

  const stamp = new Date().toISOString();
  console.log(`[${stamp}] mirrored ${workspace.maps.length} map(s) to ${config.outputDir}`);
}

async function main() {
  if (args.has('--help') || args.has('-h')) {
    console.log(usage());
    return;
  }

  await mirrorWorkspace();
  if (!isWatchMode) return;

  const pollMs = Number.isFinite(config.pollMs) && config.pollMs >= 10_000
    ? config.pollMs
    : DEFAULT_POLL_MS;
  console.log(`Watching GitHub workspace every ${Math.round(pollMs / 1000)}s. Press Ctrl+C to stop.`);
  setInterval(() => {
    mirrorWorkspace().catch((error) => {
      console.error(`[${new Date().toISOString()}] sync failed: ${error.message}`);
    });
  }, pollMs);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
