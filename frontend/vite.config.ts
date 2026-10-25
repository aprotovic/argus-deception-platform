import react from '@vitejs/plugin-react';
import { createLogger, defineConfig } from 'vite';

const customLogger = createLogger();
const originalLoggerError = customLogger.error.bind(customLogger);

customLogger.error = (msg, options) => {
  // Suppress benign WebSocket proxy disconnect/reset errors (e.g. EPIPE, ECONNRESET)
  // which occur naturally when the client refreshes, navigates away, or disconnects.
  if (
    typeof msg === 'string' &&
    (msg.includes('ws proxy socket error') ||
      msg.includes('ws proxy error') ||
      msg.includes('EPIPE') ||
      msg.includes('ECONNRESET'))
  ) {
    return;
  }
  if (
    options?.error &&
    ((options.error as any).code === 'EPIPE' ||
      (options.error as any).code === 'ECONNRESET' ||
      options.error.message?.includes('EPIPE') ||
      options.error.message?.includes('ECONNRESET'))
  ) {
    return;
  }
  originalLoggerError(msg, options);
};

// https://vite.dev/config/
export default defineConfig({
  customLogger,
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        ws: true,
        rewriteWsOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (err: any) => {
            if (err?.code === 'ECONNRESET' || err?.code === 'EPIPE' || err?.code === 'ECONNREFUSED') {
              return;
            }
            console.error('[vite proxy error]:', err);
          });
          proxy.on('proxyReqWs', (proxyReq, _req, socket: any) => {
            const cleanup = () => {
              try {
                proxyReq.destroy();
              } catch (_) {}
            };

            socket.on('close', cleanup);
            socket.on('error', (err: any) => {
              if (err?.code === 'ECONNRESET' || err?.code === 'EPIPE') {
                cleanup();
                return;
              }
            });

            proxyReq.on('upgrade', (_proxyRes, proxySocket: any) => {
              const destroyProxySocket = () => {
                try {
                  proxySocket.destroy();
                } catch (_) {}
              };

              socket.on('close', destroyProxySocket);
              socket.on('error', (err: any) => {
                if (err?.code === 'ECONNRESET' || err?.code === 'EPIPE') {
                  destroyProxySocket();
                }
              });

              proxySocket.on('error', (err: any) => {
                if (err?.code === 'ECONNRESET' || err?.code === 'EPIPE') {
                  try {
                    socket.destroy();
                  } catch (_) {}
                  return;
                }
              });
            });
          });
        },
      },
      '/decoy': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/bank': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/bank-app': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/robots.txt': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/.env': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/.git': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/actuator': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/wp-login.php': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/admin-console': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/internal': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/satcom': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/firmware': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
});
