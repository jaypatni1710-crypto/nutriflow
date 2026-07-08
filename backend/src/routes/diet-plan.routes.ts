import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { DietPlanService } from '../services/diet-plan.service';
import { authenticate, requireDietitian } from '../middleware/auth.middleware';
import { createDietPlanSchema, updateDietPlanSchema } from '../types/diet-plan.validation';

export function createDietPlanRouter(dietPlanService: DietPlanService): Hono<{ Bindings: Env }> {
  const router = new Hono<{ Bindings: Env }>();
  router.use('*', authenticate, requireDietitian);

  router.get('/', async (c) => {
    try {
      const dietitianId = c.get('user').sub;
      const plans = await dietPlanService.list(dietitianId);
      return c.json({ success: true, data: plans });
    } catch (err) {
      console.error(err);
      return c.json({ success: false, message: 'Failed to fetch diet plans' }, 500);
    }
  });

  router.post('/', zValidator('json', createDietPlanSchema), async (c) => {
    try {
      const dietitianId = c.get('user').sub;
      const plan = await dietPlanService.create(dietitianId, c.req.valid('json') as any);
      return c.json({ success: true, message: 'Diet plan created', data: plan }, 201);
    } catch (err) {
      console.error(err);
      return c.json({ success: false, message: 'Failed to create diet plan' }, 500);
    }
  });

  router.put('/:id', zValidator('json', updateDietPlanSchema), async (c) => {
    try {
      const dietitianId = c.get('user').sub;
      const updated = await dietPlanService.update(dietitianId, c.req.param('id'), c.req.valid('json') as any);
      if (!updated) return c.json({ success: false, message: 'Diet plan not found' }, 404);
      return c.json({ success: true, data: updated });
    } catch (err: any) {
      if (err?.message === 'DIET_PLAN_LOCKED') {
        return c.json({ success: false, message: 'Only the latest diet plan for a client can be edited.' }, 403);
      }
      console.error(err);
      return c.json({ success: false, message: 'Failed to update diet plan' }, 500);
    }
  });

  router.delete('/:id', async (c) => {
    try {
      const dietitianId = c.get('user').sub;
      const ok = await dietPlanService.remove(dietitianId, c.req.param('id'));
      if (!ok) return c.json({ success: false, message: 'Diet plan not found' }, 404);
      return c.json({ success: true });
    } catch (err) {
      console.error(err);
      return c.json({ success: false, message: 'Failed to delete diet plan' }, 500);
    }
  });

  return router;
}