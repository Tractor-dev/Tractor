import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';

const clientRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const serverRoot = path.resolve(clientRoot, '../server');
const clientUrl = 'http://127.0.0.1:3002';
const serverUrl = 'http://127.0.0.1:5002';
const serverHealthUrl = `${serverUrl}/health`;

async function isReachable(url) {
  try {
    const response = await fetch(url);
    return response.ok;
  } catch {
    return false;
  }
}

async function waitUntilReachable(url, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isReachable(url)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

export default async function globalSetup() {
  let serverProcess = null;
  let viteServer = null;

  if (await isReachable(serverHealthUrl)) {
    throw new Error('Playwright 需要独占 5002 端口；请先停止已有测试服务');
  }
  serverProcess = spawn(process.execPath, ['src/index.js'], {
    cwd: serverRoot,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: '5002',
      CLIENT_URL: clientUrl
    },
    stdio: process.env.DEBUG_E2E_SERVER ? 'inherit' : 'ignore'
  });
  await waitUntilReachable(serverHealthUrl);

  if (!await isReachable(clientUrl)) {
    viteServer = await createViteServer({
      root: clientRoot,
      server: {
        host: '127.0.0.1',
        port: 3002,
        strictPort: true
      },
      define: {
        __TRACTOR_SERVER_URL__: JSON.stringify(serverUrl)
      }
    });
    await viteServer.listen();
  }

  return async () => {
    if (viteServer) {
      await viteServer.close();
    }
    if (serverProcess && !serverProcess.killed) {
      serverProcess.kill();
      await Promise.race([
        once(serverProcess, 'exit'),
        new Promise((resolve) => setTimeout(resolve, 5_000))
      ]);
    }
  };
}
