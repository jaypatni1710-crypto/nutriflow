import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { getDb } from './utils/db';
import { AuthService } from './services/auth.service';
import { ClientService } from './services/client.service';
import { AppointmentService } from './services/appointment.service';
import { createAuthRouter } from './routes/auth.routes';
import { createClientRouter } from './routes/client.routes';
import { createAppointmentRouter } from './routes/appointment.routes';

const app = new Hono<{ Bindings: Env }>();

// Security headers (replaces helmet)
app.use('*', secureHeaders());

// CORS — supports localhost, explicit FRONTEND_URL list, and Codespaces
app.use('*', async (c, next) => {
  const allowedOrigins = (c.env.FRONTEND_URL || 'http://localhost:3000,http://localhost:5173')
    .split(',')
    .map((o) => o.trim());

  return cors({
    origin: (origin) => {
      if (!origin) return origin;
      // Always allow localhost for local dev
      if (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
        return origin;
      }
      // Always allow GitHub Codespaces forwarded ports (*.app.github.dev)
      if (origin.endsWith('.app.github.dev')) {
        return origin;
      }
      // Check explicit allow-list
      // Check explicit allow-list
      if (allowedOrigins.some((allowed) => origin === allowed)) {
        return origin;
      }
      return null;
    },
    credentials: true,
  })(c, next);
});

// Health check
app.get('/health', (c) => c.json({ status: 'ok' }));

// Mount routers — services are created per-request so the env bindings are available.
// We can't use app.route() here because the sub-app depends on env (DB pool, JWT
// secret, etc.) which is only available once a request comes in, not at module
// load time. Instead we build the real Hono sub-app per request and delegate to
// it with the mount-point prefix stripped off the URL (this is what app.route()
// does internally for a statically-known sub-app).
function delegate(prefix: string, buildRouter: (env: Env) => Hono<any>) {
  return (c: any) => {
    const router = buildRouter(c.env);
    const url = new URL(c.req.url);
    url.pathname = url.pathname.slice(prefix.length) || '/';
    const subRequest = new Request(url.toString(), c.req.raw);
    return router.fetch(subRequest, c.env as Env, c.executionCtx);
  };
}

app.all('/api/auth/*', delegate('/api/auth', (env) => {
  const db = getDb(env);
  const emailCfg = {
    resendApiKey: env.RESEND_API_KEY,
    from: env.SMTP_FROM || 'noreply@nutriflow.app',
    frontendUrl: env.FRONTEND_URL,
  };
  const authService = new AuthService(db, env.JWT_SECRET, emailCfg);
  return createAuthRouter(authService);
}));

app.all('/api/clients/*', delegate('/api/clients', (env) => {
  const db = getDb(env);
  const clientService = new ClientService(db);
  return createClientRouter(clientService);
}));

app.all('/api/appointments/*', delegate('/api/appointments', (env) => {
  const db = getDb(env);
  const appointmentService = new AppointmentService(db);
  return createAppointmentRouter(appointmentService);
}));

// 404 handler
app.notFound((c) => c.json({ success: false, message: 'Not found' }, 404));

// Error handler
app.onError((err, c) => {
  console.error('Unhandled Worker error:', err);
  return c.json({ success: false, message: 'Internal server error' }, 500);
});

export default app;