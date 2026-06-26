import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { getDb } from './utils/db';
import { AuthService } from './services/auth.service';
import { ClientService } from './services/client.service';
import { createAuthRouter } from './routes/auth.routes';
import { createClientRouter } from './routes/client.routes';

const app = new Hono<{ Bindings: Env }>();

// Security headers (replaces helmet)
app.use('*', secureHeaders());

// CORS (same multi-origin logic as original)
app.use('*', async (c, next) => {
  const allowedOrigins = (c.env.FRONTEND_URL || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim());

  return cors({
    origin: (origin) => {
      if (!origin) return origin;
      if (allowedOrigins.some((allowed) => origin === allowed || origin.startsWith(allowed))) {
        return origin;
      }
      return null;
    },
    credentials: true,
  })(c, next);
});

// Health check
app.get('/health', (c) => c.json({ status: 'ok' }));

// Mount routers — services are created per-request so the env bindings are available
app.route('/api/auth', {
  fetch(req, env, ctx) {
    const db = getDb(env.HYPERDRIVE);
    const emailCfg = {
      resendApiKey: env.RESEND_API_KEY,
      from: env.SMTP_FROM || 'noreply@nutriflow.app',
      frontendUrl: env.FRONTEND_URL,
    };
    const authService = new AuthService(db, env.JWT_SECRET, emailCfg);
    return createAuthRouter(authService).fetch(req, env, ctx);
  },
});

app.route('/api/clients', {
  fetch(req, env, ctx) {
    const db = getDb(env.HYPERDRIVE);
    const clientService = new ClientService(db);
    return createClientRouter(clientService).fetch(req, env, ctx);
  },
});

// 404 handler
app.notFound((c) => c.json({ success: false, message: 'Not found' }, 404));

// Error handler
app.onError((err, c) => {
  console.error('Unhandled Worker error:', err);
  return c.json({ success: false, message: 'Internal server error' }, 500);
});

export default app;
