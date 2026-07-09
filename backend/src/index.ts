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
import { PushService } from './services/push.service';
import { createPushRouter } from './routes/push.routes';
import { runAppointmentReminderCheck, runDailySummaryCheck } from './scheduled/appointment-reminders';
import { DietPlanService } from './services/diet-plan.service';
import { createDietPlanRouter } from './routes/diet-plan.routes';

const app = new Hono<{ Bindings: Env }>();

app.use('*', secureHeaders());

app.use('*', async (c, next) => {
  const allowedOrigins = (c.env.FRONTEND_URL || 'http://localhost:3000,http://localhost:5173')
    .split(',')
    .map((o) => o.trim());

  return cors({
    origin: (origin) => {
      if (!origin) return origin;
      if (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
        return origin;
      }
      if (origin.endsWith('.app.github.dev')) {
        return origin;
      }
      if (allowedOrigins.some((allowed) => origin === allowed)) {
        return origin;
      }
      return null;
    },
    credentials: true,
  })(c, next);
});

app.get('/health', (c) => c.json({ status: 'ok' }));

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
  const primaryFrontendUrl = (env.FRONTEND_URL || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)[0] || 'http://localhost:5173';
  const emailCfg = {
    brevoApiKey: env.BREVO_API_KEY,
    from: env.SMTP_FROM || 'nutriflow2911@gmail.com',
    frontendUrl: primaryFrontendUrl.replace(/\/+$/, ''),
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

app.all('/api/push/*', delegate('/api/push', (env) => {
  const db = getDb(env);
  const pushService = new PushService(
    db,
    env.VAPID_SUBJECT || 'mailto:noreply@nutriflow.app',
    env.VAPID_PUBLIC_KEY,
    env.VAPID_PRIVATE_KEY
  );
  return createPushRouter(pushService, env.VAPID_PUBLIC_KEY);
}));

app.all('/api/diet-plans/*', delegate('/api/diet-plans', (env) => {
  const db = getDb(env);
  const dietPlanService = new DietPlanService(db);
  return createDietPlanRouter(dietPlanService);
}));

app.notFound((c) => c.json({ success: false, message: 'Not found' }, 404));

app.onError((err, c) => {
  console.error('Unhandled Worker error:', err);
  return c.json({ success: false, message: 'Internal server error' }, 500);
});

export default {
  fetch: app.fetch,
  scheduled: async (_event: ScheduledEvent, env: Env, ctx: ExecutionContext) => {
    ctx.waitUntil(runAppointmentReminderCheck(env));
    ctx.waitUntil(runDailySummaryCheck(env));
  },
};