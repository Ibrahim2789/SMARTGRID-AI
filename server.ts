import express, { Request, Response } from 'express';
import { spawn, ChildProcess } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';

const PYTHON_HOST = '127.0.0.1';
const PYTHON_PORT = Number(process.env.PYTHON_BACKEND_PORT) || 8001;

let pythonProcess: ChildProcess | null = null;
let isShuttingDown = false;
let isStarting = false;

function checkHealth(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(
      {
        hostname: PYTHON_HOST,
        port: PYTHON_PORT,
        path: '/api/health',
        timeout: 400
      },
      (res) => {
        res.resume();
        resolve(res.statusCode === 200);
      }
    );
    req.on('error', () => resolve(false));
  });
}

async function startPythonFastApiBackend(): Promise<void> {
  if (await checkHealth()) {
    return;
  }
  if (isStarting) {
    return;
  }
  isStarting = true;

  return new Promise((resolve) => {
    const backendDir = path.resolve(process.cwd(), 'backend');
    const mainScript = path.join(backendDir, 'main.py');

    pythonProcess = spawn('python3', [mainScript], {
      cwd: backendDir,
      env: {
        ...process.env,
        PYTHONUNBUFFERED: '1',
        PYTHON_BACKEND_HOST: PYTHON_HOST,
        PYTHON_BACKEND_PORT: String(PYTHON_PORT)
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let resolved = false;
    const markReady = () => {
      isStarting = false;
      if (!resolved) {
        resolved = true;
        resolve();
      }
    };

    pythonProcess.stdout?.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      process.stdout.write(text);
      if (text.includes('Listening on') || text.includes('Uvicorn running on') || text.includes('already active')) {
        markReady();
      }
    });

    pythonProcess.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      process.stderr.write(text);
      if (text.includes('Uvicorn running on')) {
        markReady();
      }
    });

    pythonProcess.on('exit', (code, signal) => {
      pythonProcess = null;
      isStarting = false;
      if (!isShuttingDown && code !== 0) {
        console.warn(
          `[Python FastAPI Backend] Exited (code=${code}, signal=${signal}). Checking status in 2s...`
        );
        setTimeout(async () => {
          if (!isShuttingDown && !(await checkHealth())) {
            startPythonFastApiBackend().catch(() => {});
          }
        }, 2000);
      }
    });

    // Fallback readiness poll on /api/health
    const pollInterval = setInterval(async () => {
      if (await checkHealth()) {
        clearInterval(pollInterval);
        markReady();
      }
    }, 150);

    setTimeout(() => {
      clearInterval(pollInterval);
      markReady();
    }, 4000);
  });
}

function stopPythonBackend() {
  isShuttingDown = true;
  if (pythonProcess && !pythonProcess.killed) {
    pythonProcess.kill('SIGTERM');
  }
}

process.on('SIGINT', () => {
  stopPythonBackend();
  process.exit(0);
});

process.on('SIGTERM', () => {
  stopPythonBackend();
  process.exit(0);
});

async function startServer() {
  await startPythonFastApiBackend();

  const app = express();

  // Reverse proxy all /api/* requests directly to the Python FastAPI server on port 8000
  app.use('/api', (req: Request, res: Response) => {
    const targetPath = req.originalUrl || req.url;
    const forwardHeaders: Record<string, string | string[] | undefined> = {
      ...req.headers,
      host: `${PYTHON_HOST}:${PYTHON_PORT}`
    };

    const proxyReq = http.request(
      {
        hostname: PYTHON_HOST,
        port: PYTHON_PORT,
        path: targetPath,
        method: req.method,
        headers: forwardHeaders
      },
      (proxyRes) => {
        res.status(proxyRes.statusCode || 500);
        Object.entries(proxyRes.headers).forEach(([key, value]) => {
          if (value !== undefined) {
            res.setHeader(key, value);
          }
        });
        proxyRes.pipe(res, { end: true });
      }
    );

    proxyReq.on('error', (err) => {
      if (!res.headersSent) {
        res.status(502).json({
          error: 'Python FastAPI backend is temporarily unreachable.',
          details: err.message
        });
      }
    });

    req.pipe(proxyReq, { end: true });
  });

  // Vite Dev Middleware or Production Static Assets on Port 3000
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(
      `SmartGrid AI Gateway on http://0.0.0.0:${PORT} -> Proxying /api/* to Python FastAPI Backend on http://${PYTHON_HOST}:${PYTHON_PORT}`
    );
  });
}

startServer();
