// lib/index.js — dsh-agent-desktop plugin entry
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { platform, arch } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

function getBinaryPath() {
  const binName = platform() === 'win32' ? 'agent-desktop.exe' : 'agent-desktop';
  return join(ROOT, 'bin', binName);
}

async function runCli(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(getBinaryPath(), args, {
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
