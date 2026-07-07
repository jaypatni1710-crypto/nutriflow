import { Hono } from 'hono';
import { PushService } from '../services/push.service';
import { authenticate, requireDietitian } from '../middleware/auth.middleware';

export function createPushRouter(pushService: PushService, vapidPublicKey: string): Hono<{ Bindings: Env }> {
  const router = new Hono<{ Bindings: Env }>();

  router.use('*', authenticate, requireDietitian);

  // GET /vapid-public-key — the browser needs this to call pushManager.subscribe()
  router.get('/vapid-public-key', (c) => {
    return c.json({ success: true, data: { publicKey: vapidPublicKey } });
  });

  // POST /subscribe — save (or update) this browser's push subscription
  router.post('/subscribe', async (c) => {
    try {
      const dietitianId = c.get('user').sub;
      const body = await c.req.json();
      if (!body?.endpoint || !body?.keys?.p256dh || !body?.keys?.auth) {
        return c.json({ success: false, message: 'Invalid subscription payload' }, 400);
      }
      await pushService.saveSubscription(dietitianId, body);
      return c.json({ success: true });
    } catch (err) {
      console.error(err);
      return c.json({ success: false, message: 'Failed to save subscription' }, 500);
    }
  });

  // POST /unsubscribe — remove a browser's push subscription (e.g. user toggled it off)
  router.post('/unsubscribe', async (c) => {
    try {
      const body = await c.req.json();
      if (!body?.endpoint) {
        return c.json({ success: false, message: 'endpoint is required' }, 400);
      }
      await pushService.removeSubscription(body.endpoint);
      return c.json({ success: true });
    } catch (err) {
      console.error(err);
      return c.json({ success: false, message: 'Failed to remove subscription' }, 500);
    }
  });

  return router;
}