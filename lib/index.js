// lib/index.js — dsh-agent-desktop plugin entry
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { platform, arch } from 'node:os';
import { existsSync, mkdirSync, unlinkSync, chmodSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const VERSION = '1.2.0';
const GITHUB_REPO = 'vercel-labs/agent-desktop';

function getBinaryPath() {
  const binName = platform() === 'win32' ? 'agent-desktop.exe' : 'agent-desktop';
  return join(ROOT, 'bin', binName);
}

function getPlatformKey() {
  const p = platform();
  const a = arch();
  if (p === 'darwin') return a === 'arm64' ? 'darwin-arm64' : 'darwin-x64';
  if (p === 'win32') return 'win32-x64';
  if (p === 'linux') return 'linux-x64';
  throw new Error('Unsupported platform: ' + p + '-' + a);
}

function tarballName(key) {
  const map = {
    'darwin-arm64': 'agent-desktop-aarch64-apple-darwin.tar.gz',
    'darwin-x64': 'agent-desktop-x86_64-apple-darwin.tar.gz',
    'win32-x64': 'agent-desktop-x86_64-pc-windows-msvc.zip',
    'linux-x64': 'agent-desktop-x86_64-unknown-linux-gnu.tar.gz',
  };
  return map[key];
}

let downloadPromise = null;

async function ensureBinary() {
  const dest = getBinaryPath();
  if (existsSync(dest)) return dest;

  if (downloadPromise) return downloadPromise;

  downloadPromise = (async () => {
    const key = getPlatformKey();
    const tarball = tarballName(key);
    const url = 'https://github.com/' + GITHUB_REPO + '/releases/download/v' + VERSION + '/' + tarball;
    const binDir = join(ROOT, 'bin');
    mkdirSync(binDir, { recursive: true });
    const tmpFile = join(binDir, tarball + '.tmp');

    try {
      execFileSync('curl', ['-fsSL', '--retry', '3', '--retry-delay', '2', '-o', tmpFile, url], {
        stdio: 'pipe',
        timeout: 120000,
      });
    } catch (err) {
      try { unlinkSync(tmpFile); } catch {}
      throw new Error('Download failed: ' + err.message + '. Manual: ' + url);
    }

    try {
      if (tarball.endsWith('.zip')) {
        execFileSync('unzip', ['-o', tmpFile, '-d', binDir], { stdio: 'pipe' });
      } else {
        execFileSync('tar', ['-xzf', tmpFile, '-C', binDir], { stdio: 'pipe' });
      }
    } catch (err) {
      try { unlinkSync(tmpFile); } catch {}
      throw new Error('Extraction failed: ' + err.message);
    }

    try { unlinkSync(tmpFile); } catch {}

    if (platform() !== 'win32') {
      try { chmodSync(dest, 0o755); } catch {}
    }

    if (!existsSync(dest)) {
      throw new Error('Binary not found after extraction. Expected: ' + dest);
    }

    return dest;
  })();

  try {
    const result = await downloadPromise;
    return result;
  } finally {
    downloadPromise = null;
  }
}

async function runCli(args) {
  const binPath = await ensureBinary();
  return new Promise((resolve, reject) => {
    const proc = spawn(binPath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => (stdout += d.toString()));
    proc.stderr.on('data', (d) => (stderr += d.toString()));
    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error('agent-desktop exited ' + code + ': ' + stderr));
      } else {
        try { resolve(JSON.parse(stdout)); }
        catch { resolve({ raw: stdout, stderr }); }
      }
    });
    proc.on('error', reject);
  });
}

export default function (ctx) {
  ctx.on('tools/register', (registry) => {
    registry.register('agent_desktop', {
      status: async () => runCli(['status']),
      snapshot: async (params = {}) => {
        const args = ['snapshot'];
        if (params.app) args.push('--app', params.app);
        if (params.depth) args.push('--depth', String(params.depth));
        return runCli(args);
      },
      click: async (params) => runCli(['click', params.ref]),
      type_text: async (params) => runCli(['type', params.ref, params.text]),
      screenshot: async (params = {}) => {
        const args = ['screenshot'];
        if (params.region) args.push('--region', params.region);
        return runCli(args);
      },
      focus: async (params) => runCli(['focus', params.app]),
    });
  });

  ctx.effect(() => () => {}, 'agent-desktop: cleanup');
}
