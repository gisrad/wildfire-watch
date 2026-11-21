// Pre-release & CI security scanner: fails on secrets, Cloudflare IDs, emails, or local machine paths.
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const IGNORE_DIRS = new Set(['node_modules', 'dist', '.astro', '.git', '.wrangler']);
const BINARY_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.woff2', '.woff', '.ico']);

const checks = [
  {
    name: 'Cloudflare Account ID assignment',
    regex: /account_id\s*=\s*['"][0-9a-f]{32}['"]/gi
  },
  {
    name: 'Non-zero UUID (potential database_id or internal ID)',
    regex: /\b(?!00000000-0000-0000-0000-000000000000)[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi
  },
  {
    name: 'Hardcoded API key or secret literal',
    regex: /(?:FIRMS_MAP_KEY|API_KEY|SECRET|TOKEN)\s*[:=]\s*['"`][A-Za-z0-9_-]{16,}['"`]/gi
  },
  {
    name: 'Provider token prefix',
    regex: /\b(?:ghp_[A-Za-z0-9_]{20,}|gho_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16})\b/g
  },
  {
    name: 'Email address in tracked source',
    regex: /\b(?!\d+[\w.-]*@users\.noreply\.github\.com)[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g
  },
  {
    name: 'Local workstation path',
    regex: /(?:[A-Z]:\\Users\\|\/Users\/|\/home\/)/gi
  }
];

const findings = [];

for (const forbidden of ['wrangler.toml', '.env', '.dev.vars']) {
  try {
    await stat(path.join(ROOT, forbidden));
    findings.push(`FORBIDDEN FILE in repository root: ${forbidden}`);
  } catch {
    // Expected: local secrets and wrangler.toml must remain untracked
  }
}

async function scanDir(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(ROOT, full).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      if (!IGNORE_DIRS.has(entry.name)) await scanDir(full);
      continue;
    }
    if (entry.name === 'package-lock.json') continue;
    if (BINARY_EXTS.has(path.extname(entry.name).toLowerCase())) continue;

    const text = await readFile(full, 'utf8');
    for (const rule of checks) {
      rule.regex.lastIndex = 0;
      const match = rule.regex.exec(text);
      if (match) {
        findings.push(`[${rule.name}] ${rel}: matched "${match[0]}"`);
      }
    }
  }
}

await scanDir(ROOT);

if (findings.length > 0) {
  console.error('Security audit FAILED:\n' + findings.map((f) => `  - ${f}`).join('\n'));
  process.exit(1);
}

console.log('Security audit PASSED: 0 exposed IDs, credentials, emails, or local paths found.');
