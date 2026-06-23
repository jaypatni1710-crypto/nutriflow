import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Pool } from 'pg';
import { AuthService } from './services/auth.service';
import { createAuthRouter } from './routes/auth.routes';
import { ClientService } from './services/client.service';
import { createClientRouter } from './routes/client.routes';

const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET', 'FRONTEND_URL'];
const missing = requiredEnvVars.filter((v) => !process.env[v]);
if (missing.length > 0) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

const app = express();
const db = new Pool({ connectionString: process.env.DATABASE_URL });

app.use(helmet());
// Support multiple frontend origins (local + deployed)
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map(o => o.trim());

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || allowedOrigins.some(o => origin.startsWith(o))) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json());

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const resendLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { success: false, message: 'Too many resend requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const authService = new AuthService(db);
const authRouter = createAuthRouter(authService, authLimiter, resendLimiter);

const clientService = new ClientService(db);
const clientRouter = createClientRouter(clientService);

app.use('/api/auth', authRouter);
app.use('/api/clients', clientRouter);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`NutriFlow API running on port ${PORT}`));

export { app };