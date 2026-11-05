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
    'darwin-arm64': 'agent-desktop-v1.2.0-aarch64-apple-darwin.tar.gz',
    'darwin-x64': 'agent-desktop-v1.2.0-x86_64-apple-darwin.tar.gz',
    'win32-x64': 'agent-desktop-v1.2.0-x86_64-pc-windows-msvc.tar.gz',
    'linux-x64': 'agent-desktop-v1.2.0-x86_64-unknown-linux-gnu.tar.gz',
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
      execFileSync('tar', ['-xzf', tmpFile, '-C', binDir], { stdio: 'pipe' });
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

// Windows requires --headed for physical delivery (type/focus on textfields).
function headedArgs(args) {
  if (platform() === 'win32') {
    args.push('--headed');
  }
  return args;
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
        if (params.windowId) args.push('--window-id', params.windowId);
        if (params.depth) args.push('--depth', String(params.depth));
        return runCli(args);
      },

      // ref must be qualified: @<snapshot_id>:eN (from snapshot output)
      click: async (params) => runCli(['click', params.ref]),

      // ref must be qualified: @<snapshot_id>:eN; text is the string to type.
      // Windows needs --headed for physical delivery into textfields.
      type_text: async (params) => {
        const args = headedArgs(['type', params.ref, params.text]);
        return runCli(args);
      },

      screenshot: async (params = {}) => {
        const args = ['screenshot'];
        if (params.app) args.push('--app', params.app);
        if (params.windowId) args.push('--window-id', params.windowId);
        if (params.region) args.push('--region', params.region);
        return runCli(args);
      },

      // Window focus by app name (uses focus-window, not element focus)
      focus: async (params) => runCli(['focus-window', '--app', params.app]),

      // Element focus by qualified ref. Windows needs --headed.
      focus_element: async (params) => {
        const args = headedArgs(['focus', params.ref]);
        return runCli(args);
      },

      // Search elements by role, name, value, or text content
      find: async (params = {}) => {
        const args = ['find'];
        if (params.role) args.push('--role', params.role);
        if (params.text) args.push('--text', params.text);
        if (params.name) args.push('--name', params.name);
        if (params.value) args.push('--value', params.value);
        return runCli(args);
      },

      // Read element property (text, value, title, bounds, role, states)
      get: async (params) => {
        const args = ['get', params.ref];
        if (params.property) args.push('--property', params.property);
        return runCli(args);
      },

      // Send a key combo: return, escape, cmd+c, shift+tab ...
      press: async (params) => runCli(['press', params.key]),

      // Wait for element presence, text, or window appearance
      wait: async (params = {}) => {
        const args = ['wait'];
        if (params.element) args.push('--element', params.element);
        if (params.text) args.push('--text', params.text);
        if (params.timeout) args.push('--timeout', String(params.timeout));
        return runCli(args);
      },

      // Scroll element (--direction up/down/left/right, --amount N)
      scroll: async (params) => {
        const args = ['scroll', params.ref];
        if (params.direction) args.push('--direction', params.direction);
        if (params.amount) args.push('--amount', String(params.amount));
        return runCli(args);
      },

      // Set element value directly via accessibility attribute
      set_value: async (params) => runCli(['set-value', params.ref, params.value]),

      // Select an option in a list or dropdown
      select: async (params) => {
        const args = ['select', params.ref];
        if (params.value) args.push('--value', params.value);
        return runCli(args);
      },

      // List all visible windows
      list_windows: async (params = {}) => {
        const args = ['list-windows'];
        if (params.app) args.push('--app', params.app);
        return runCli(args);
      },

      // Launch application and return once its process is running
      launch: async (params = {}) => {
        const args = ['launch'];
        if (params.app) args.push('--app', params.app);
        if (params.activate) args.push('--activate');
        return runCli(args);
      },

      // Read plain-text clipboard contents
      clipboard_get: async () => runCli(['clipboard-get']),

      // Write text to the clipboard
      clipboard_set: async (params) => runCli(['clipboard-set', params.text]),
    });
  });

  ctx.effect(() => () => {}, 'agent-desktop: cleanup');
}
