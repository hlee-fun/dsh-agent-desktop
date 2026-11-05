#!/usr/bin/env node

const { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } = require('fs');
const { join, dirname } = require('path');
const { platform, arch } = require('os');
const { execFileSync } = require('child_process');

const projectRoot = join(__dirname, '..');
const binDir = join(projectRoot, 'bin');
const packageJson = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8'));
const version = packageJson.version;

const GITHUB_REPO = 'vercel-labs/agent-desktop';
const RELEASE_BASE = 'https://github.com/' + GITHUB_REPO + '/releases/download/v' + version;

function log(msg) { process.stderr.write('dsh-agent-desktop: ' + msg + '\n'); }

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

function binaryName() {
  return platform() === 'win32' ? 'agent-desktop.exe' : 'agent-desktop';
}

function main() {
  const key = getPlatformKey();
  const tarball = tarballName(key);
  const url = RELEASE_BASE + '/' + tarball;
  const dest = join(binDir, binaryName());

  if (existsSync(dest)) {
    log('Binary already exists: ' + dest);
    return;
  }

  mkdirSync(binDir, { recursive: true });
  const tmpFile = join(binDir, tarball + '.tmp');

  log('Downloading ' + url);
  try {
    execFileSync('curl', ['-fsSL', '--retry', '3', '--retry-delay', '2', '-o', tmpFile, url], {
      stdio: 'pipe',
      timeout: 120000,
    });
  } catch (err) {
    log('Download failed: ' + err.message);
    log('Manual fallback: download from ' + url);
    log('Then extract to: ' + binDir);
    process.exitCode = 1;
    return;
  }

  log('Extracting...');
  try {
    if (tarball.endsWith('.zip')) {
      execFileSync('unzip', ['-o', tmpFile, '-d', binDir], { stdio: 'pipe' });
    } else {
      execFileSync('tar', ['-xzf', tmpFile, '-C', binDir], { stdio: 'pipe' });
    }
  } catch (err) {
    log('Extraction failed: ' + err.message);
    process.exitCode = 1;
    return;
  }

  // Clean up
  try { require('fs').unlinkSync(tmpFile); } catch {}

  if (platform() !== 'win32') {
    try { chmodSync(dest, 0o755); } catch {}
  }

  if (existsSync(dest)) {
    log('Installed: ' + dest);
  } else {
    log('Binary not found after extraction. Expected: ' + dest);
    process.exitCode = 1;
  }
}

if (require.main === module) main();
