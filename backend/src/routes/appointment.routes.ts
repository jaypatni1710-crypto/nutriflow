import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { AppointmentService } from '../services/appointment.service';
import { authenticate, requireDietitian } from '../middleware/auth.middleware';
import { createAppointmentSchema, updateAppointmentSchema, appointmentSettingsSchema } from '../types/appointment.validation';

export function createAppointmentRouter(appointmentService: AppointmentService): Hono<{ Bindings: Env }> {
  const router = new Hono<{ Bindings: Env }>();

  router.use('*', authenticate, requireDietitian);

  // GET / — list all appointments for the logged-in dietitian
  router.get('/', async (c) => {
    try {
      const dietitianId = c.get('user').sub;
      const appointments = await appointmentService.list(dietitianId);
      return c.json({ success: true, data: appointments });
    } catch (err) {
      console.error(err);
      return c.json({ success: false, message: 'Failed to fetch appointments' }, 500);
    }
  });

  // GET /settings — fetch this dietitian's appointment settings
  router.get('/settings', async (c) => {
    try {
      const dietitianId = c.get('user').sub;
      const settings = await appointmentService.getSettings(dietitianId);
      return c.json({ success: true, data: settings });
    } catch (err) {
      console.error(err);
      return c.json({ success: false, message: 'Failed to fetch settings' }, 500);
    }
  });

  // PUT /settings — upsert this dietitian's appointment settings
  router.put('/settings', zValidator('json', appointmentSettingsSchema), async (c) => {
    try {
      const dietitianId = c.get('user').sub;
      const body = c.req.valid('json') as any;
      const settings = await appointmentService.saveSettings(dietitianId, {
        max_per_day: body.max_per_day ?? null,
        duration_minutes: body.duration_minutes ?? null,
        working_start: body.working_start ?? null,
        working_end: body.working_end ?? null,
      });
      return c.json({ success: true, data: settings });
    } catch (err) {
      console.error(err);
      return c.json({ success: false, message: 'Failed to save settings' }, 500);
    }
  });

  // POST / — create appointment
  router.post('/', zValidator('json', createAppointmentSchema), async (c) => {
    try {
      const dietitianId = c.get('user').sub;
      const appt = await appointmentService.create(dietitianId, c.req.valid('json') as any);
      return c.json({ success: true, message: 'Appointment created', data: appt }, 201);
    } catch (err) {
      console.error(err);
      return c.json({ success: false, message: 'Failed to create appointment' }, 500);
    }
  });

  // PUT /:id — update appointment
  router.put('/:id', zValidator('json', updateAppointmentSchema), async (c) => {
    try {
      const dietitianId = c.get('user').sub;
      const updated = await appointmentService.update(dietitianId, c.req.param('id'), c.req.valid('json') as any);
      if (!updated) return c.json({ success: false, message: 'Appointment not found' }, 404);
      return c.json({ success: true, data: updated });
    } catch (err) {
      console.error(err);
      return c.json({ success: false, message: 'Failed to update appointment' }, 500);
    }
  });

  // DELETE /:id — delete appointment
  router.delete('/:id', async (c) => {
    try {
      const dietitianId = c.get('user').sub;
      const ok = await appointmentService.remove(dietitianId, c.req.param('id'));
      if (!ok) return c.json({ success: false, message: 'Appointment not found' }, 404);
      return c.json({ success: true });
    } catch (err) {
      console.error(err);
      return c.json({ success: false, message: 'Failed to delete appointment' }, 500);
    }
  });

  return router;
}