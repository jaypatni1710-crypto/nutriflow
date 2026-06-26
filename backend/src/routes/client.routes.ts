import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { ClientService } from '../services/client.service';
import { authenticate, requireDietitian } from '../middleware/auth.middleware';
import {
  createClientSchema, updateClientSchema, createNoteSchema,
  foodFrequencySchema, statusUpdateSchema, communicationSchema,
  tagSchema, duplicateCheckSchema,
} from '../types/client.validation';
import { generateSecureToken } from '../utils/crypto';

const ALLOWED_REPORT_TYPES = ['CBC', 'HbA1c', 'Thyroid', 'Vitamin D', 'Vitamin B12', 'Lipid Profile', 'Prescription', 'Other'];
const ALLOWED_REPORT_MIME = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
const ALLOWED_PHOTO_VIEWS = ['Front', 'Side', 'Back'];
const ALLOWED_PHOTO_MIME = ['image/jpeg', 'image/jpg', 'image/png'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Helper: upload a file to Cloudflare R2 and return its stored path
// NOTE: Add an R2 binding `FILES_BUCKET` in wrangler.toml when you're ready for file uploads
// For now the upload endpoints return 501 if no R2 bucket is bound.
async function uploadToR2(
  bucket: R2Bucket | undefined,
  folder: string,
  file: File
): Promise<string> {
  if (!bucket) throw new Error('R2_NOT_CONFIGURED');
  const ext = file.name.split('.').pop() || 'bin';
  const key = `${folder}/${generateSecureToken()}.${ext}`;
  await bucket.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  });
  return key; // store the R2 key as the "file path"
}

export function createClientRouter(clientService: ClientService): Hono {
  const router = new Hono<{ Bindings: Env & { FILES_BUCKET?: R2Bucket } }>();

  // All client routes require auth + dietitian role
  router.use('*', authenticate, requireDietitian);

  // GET / — list clients
  router.get('/', async (c) => {
    try {
      const dietitianId = c.get('user').sub;
      const q = c.req.query();
      const result = await clientService.listClients(dietitianId, {
        search: q.search || undefined,
        goal: q.goal || undefined,
        condition: q.condition || undefined,
        status: q.status || undefined,
        tag: q.tag || undefined,
        archived: q.archived === 'true',
        page: parseInt(q.page || '1', 10),
        limit: parseInt(q.limit || '10', 10),
      });
      return c.json({ success: true, ...result });
    } catch (err) {
      console.error(err);
      return c.json({ success: false, message: 'Failed to fetch clients' }, 500);
    }
  });

  // POST / — create client
  router.post('/', zValidator('json', createClientSchema), async (c) => {
    try {
      const dietitianId = c.get('user').sub;
      const client = await clientService.createClient(dietitianId, c.req.valid('json') as any);
      return c.json({ success: true, message: 'Client created successfully', data: client }, 201);
    } catch (err: any) {
      if (err.code === '23505') return c.json({ success: false, message: 'A client with this phone number already exists' }, 409);
      console.error(err);
      return c.json({ success: false, message: 'Failed to create client' }, 500);
    }
  });

  // POST /check-duplicate
  router.post('/check-duplicate', zValidator('json', duplicateCheckSchema), async (c) => {
    try {
      const { phone_number, whatsapp_number, email } = c.req.valid('json') as any;
      const duplicates = await clientService.checkDuplicate(c.get('user').sub, phone_number, whatsapp_number, email);
      return c.json({ success: true, data: { duplicates, has_duplicates: duplicates.length > 0 } });
    } catch (err) {
      return c.json({ success: false, message: 'Failed to check duplicates' }, 500);
    }
  });

  // GET /tags — all tags for this dietitian
  router.get('/tags', async (c) => {
    try {
      const tags = await clientService.listAllTags(c.get('user').sub);
      return c.json({ success: true, data: tags });
    } catch (err) {
      return c.json({ success: false, message: 'Failed to fetch tags' }, 500);
    }
  });

  // GET /:id
  router.get('/:id', async (c) => {
    try {
      const client = await clientService.getClientById(c.get('user').sub, c.req.param('id'));
      if (!client) return c.json({ success: false, message: 'Client not found' }, 404);
      return c.json({ success: true, data: client });
    } catch (err) {
      return c.json({ success: false, message: 'Failed to fetch client' }, 500);
    }
  });

  // GET /:id/profile
  router.get('/:id/profile', async (c) => {
    try {
      const profile = await clientService.getFullProfile(c.get('user').sub, c.req.param('id'));
      if (!profile) return c.json({ success: false, message: 'Client not found' }, 404);
      return c.json({ success: true, data: profile });
    } catch (err) {
      return c.json({ success: false, message: 'Failed to fetch profile' }, 500);
    }
  });

  // PUT /:id
  router.put('/:id', zValidator('json', updateClientSchema), async (c) => {
    try {
      const updated = await clientService.updateClient(c.get('user').sub, c.req.param('id'), c.req.valid('json') as any);
      if (!updated) return c.json({ success: false, message: 'Client not found' }, 404);
      return c.json({ success: true, message: 'Client updated successfully', data: updated });
    } catch (err) {
      console.error(err);
      return c.json({ success: false, message: 'Failed to update client' }, 500);
    }
  });

  // DELETE /:id
  router.delete('/:id', async (c) => {
    try {
      const deleted = await clientService.deleteClient(c.get('user').sub, c.req.param('id'));
      if (!deleted) return c.json({ success: false, message: 'Client not found' }, 404);
      return c.json({ success: true, message: 'Client deleted successfully' });
    } catch (err) {
      return c.json({ success: false, message: 'Failed to delete client' }, 500);
    }
  });

  // PATCH /:id/status
  router.patch('/:id/status', zValidator('json', statusUpdateSchema), async (c) => {
    try {
      const updated = await clientService.updateStatus(c.get('user').sub, c.req.param('id'), (c.req.valid('json') as any).status);
      if (!updated) return c.json({ success: false, message: 'Client not found' }, 404);
      return c.json({ success: true, message: 'Status updated', data: updated });
    } catch (err) {
      return c.json({ success: false, message: 'Failed to update status' }, 500);
    }
  });

  // POST /:id/archive
  router.post('/:id/archive', async (c) => {
    try {
      const updated = await clientService.archiveClient(c.get('user').sub, c.req.param('id'));
      if (!updated) return c.json({ success: false, message: 'Client not found' }, 404);
      return c.json({ success: true, message: 'Client archived', data: updated });
    } catch (err) {
      return c.json({ success: false, message: 'Failed to archive client' }, 500);
    }
  });

  // POST /:id/restore
  router.post('/:id/restore', async (c) => {
    try {
      const updated = await clientService.restoreClient(c.get('user').sub, c.req.param('id'));
      if (!updated) return c.json({ success: false, message: 'Client not found' }, 404);
      return c.json({ success: true, message: 'Client restored', data: updated });
    } catch (err) {
      return c.json({ success: false, message: 'Failed to restore client' }, 500);
    }
  });

  // GET /:id/timeline
  router.get('/:id/timeline', async (c) => {
    try {
      const timeline = await clientService.getTimeline(c.req.param('id'));
      return c.json({ success: true, data: timeline });
    } catch (err) {
      return c.json({ success: false, message: 'Failed to fetch timeline' }, 500);
    }
  });

  // --- Notes ---
  router.post('/:id/notes', zValidator('json', createNoteSchema), async (c) => {
    try {
      const note = await clientService.addNote(c.req.param('id'), c.get('user').sub, (c.req.valid('json') as any).content);
      return c.json({ success: true, message: 'Note added', data: note }, 201);
    } catch (err) {
      return c.json({ success: false, message: 'Failed to add note' }, 500);
    }
  });

  router.put('/:id/notes/:noteId', zValidator('json', createNoteSchema), async (c) => {
    try {
      const note = await clientService.updateNote(c.req.param('id'), c.req.param('noteId'), (c.req.valid('json') as any).content);
      if (!note) return c.json({ success: false, message: 'Note not found' }, 404);
      return c.json({ success: true, message: 'Note updated', data: note });
    } catch (err) {
      return c.json({ success: false, message: 'Failed to update note' }, 500);
    }
  });

  router.delete('/:id/notes/:noteId', async (c) => {
    try {
      const deleted = await clientService.deleteNote(c.req.param('id'), c.req.param('noteId'));
      if (!deleted) return c.json({ success: false, message: 'Note not found' }, 404);
      return c.json({ success: true, message: 'Note deleted' });
    } catch (err) {
      return c.json({ success: false, message: 'Failed to delete note' }, 500);
    }
  });

  // --- Food Frequency ---
  router.post('/:id/food-frequency', zValidator('json', foodFrequencySchema), async (c) => {
    try {
      const data = await clientService.addFoodFrequency(c.req.param('id'), c.req.valid('json') as any);
      return c.json({ success: true, message: 'Food frequency saved', data }, 201);
    } catch (err) {
      return c.json({ success: false, message: 'Failed to save food frequency' }, 500);
    }
  });

  router.get('/:id/food-frequency', async (c) => {
    try {
      const data = await clientService.listFoodFrequency(c.req.param('id'));
      return c.json({ success: true, data });
    } catch (err) {
      return c.json({ success: false, message: 'Failed to fetch food frequency' }, 500);
    }
  });

  // --- Communications ---
  router.post('/:id/communications', zValidator('json', communicationSchema), async (c) => {
    try {
      const { type, description } = c.req.valid('json') as any;
      const comm = await clientService.addCommunication(c.req.param('id'), c.get('user').sub, type, description);
      return c.json({ success: true, message: 'Communication logged', data: comm }, 201);
    } catch (err) {
      return c.json({ success: false, message: 'Failed to log communication' }, 500);
    }
  });

  router.get('/:id/communications', async (c) => {
    try {
      const data = await clientService.listCommunications(c.req.param('id'));
      return c.json({ success: true, data });
    } catch (err) {
      return c.json({ success: false, message: 'Failed to fetch communications' }, 500);
    }
  });

  router.put('/:id/communications/:commId', zValidator('json', communicationSchema), async (c) => {
    try {
      const { type, description } = c.req.valid('json') as any;
      const comm = await clientService.updateCommunication(c.req.param('id'), c.req.param('commId'), type, description);
      if (!comm) return c.json({ success: false, message: 'Communication not found' }, 404);
      return c.json({ success: true, message: 'Communication updated', data: comm });
    } catch (err) {
      return c.json({ success: false, message: 'Failed to update communication' }, 500);
    }
  });

  router.delete('/:id/communications/:commId', async (c) => {
    try {
      const deleted = await clientService.deleteCommunication(c.req.param('id'), c.req.param('commId'));
      if (!deleted) return c.json({ success: false, message: 'Communication not found' }, 404);
      return c.json({ success: true, message: 'Communication deleted' });
    } catch (err) {
      return c.json({ success: false, message: 'Failed to delete communication' }, 500);
    }
  });

  // --- Tags ---
  router.post('/:id/tags', zValidator('json', tagSchema), async (c) => {
    try {
      const tags = await clientService.addTag(c.req.param('id'), (c.req.valid('json') as any).tag);
      return c.json({ success: true, message: 'Tag added', data: tags });
    } catch (err) {
      return c.json({ success: false, message: 'Failed to add tag' }, 500);
    }
  });

  router.delete('/:id/tags/:tag', async (c) => {
    try {
      const tags = await clientService.removeTag(c.req.param('id'), c.req.param('tag'));
      return c.json({ success: true, message: 'Tag removed', data: tags });
    } catch (err) {
      return c.json({ success: false, message: 'Failed to remove tag' }, 500);
    }
  });

  // --- Lab Reports (R2 file upload) ---
  router.post('/:id/lab-reports', async (c) => {
    try {
      const formData = await c.req.formData();
      const file = formData.get('file') as File | null;
      const reportType = formData.get('report_type') as string | null;

      if (!file) return c.json({ success: false, message: 'No file provided' }, 400);
      if (!reportType || !ALLOWED_REPORT_TYPES.includes(reportType)) {
        return c.json({ success: false, message: 'Invalid report type' }, 400);
      }
      if (!ALLOWED_REPORT_MIME.includes(file.type)) {
        return c.json({ success: false, message: 'Only PDF, JPG and PNG files allowed' }, 400);
      }
      if (file.size > MAX_FILE_SIZE) {
        return c.json({ success: false, message: 'File size must be under 10MB' }, 400);
      }

      const bucket = (c.env as any).FILES_BUCKET as R2Bucket | undefined;
      const filePath = await uploadToR2(bucket, 'lab-reports', file);
      const report = await clientService.addLabReport(c.req.param('id'), reportType, filePath, file.name, c.get('user').sub);
      return c.json({ success: true, message: 'Lab report uploaded', data: report }, 201);
    } catch (err: any) {
      if (err.message === 'R2_NOT_CONFIGURED') {
        return c.json({ success: false, message: 'File storage not configured. Add FILES_BUCKET R2 binding in wrangler.toml.' }, 501);
      }
      console.error(err);
      return c.json({ success: false, message: 'Failed to upload lab report' }, 500);
    }
  });

  router.delete('/:id/lab-reports/:reportId', async (c) => {
    try {
      const report = await clientService.deleteLabReport(c.req.param('id'), c.req.param('reportId'));
      if (!report) return c.json({ success: false, message: 'Report not found' }, 404);
      // Optionally delete from R2 too
      const bucket = (c.env as any).FILES_BUCKET as R2Bucket | undefined;
      if (bucket && report.file_path) await bucket.delete(report.file_path).catch(() => {});
      return c.json({ success: true, message: 'Lab report deleted' });
    } catch (err) {
      return c.json({ success: false, message: 'Failed to delete lab report' }, 500);
    }
  });

  // --- Progress Photos (R2 file upload) ---
  router.post('/:id/progress-photos', async (c) => {
    try {
      const formData = await c.req.formData();
      const file = formData.get('photo') as File | null;
      const viewType = formData.get('view_type') as string | null;

      if (!file) return c.json({ success: false, message: 'No photo provided' }, 400);
      if (!viewType || !ALLOWED_PHOTO_VIEWS.includes(viewType)) {
        return c.json({ success: false, message: 'view_type must be Front, Side or Back' }, 400);
      }
      if (!ALLOWED_PHOTO_MIME.includes(file.type)) {
        return c.json({ success: false, message: 'Only JPG and PNG files allowed' }, 400);
      }
      if (file.size > MAX_FILE_SIZE) {
        return c.json({ success: false, message: 'File size must be under 10MB' }, 400);
      }

      const bucket = (c.env as any).FILES_BUCKET as R2Bucket | undefined;
      const filePath = await uploadToR2(bucket, 'progress-photos', file);
      const photo = await clientService.addProgressPhoto(c.req.param('id'), viewType, filePath, file.name);
      return c.json({ success: true, message: 'Progress photo uploaded', data: photo }, 201);
    } catch (err: any) {
      if (err.message === 'R2_NOT_CONFIGURED') {
        return c.json({ success: false, message: 'File storage not configured. Add FILES_BUCKET R2 binding in wrangler.toml.' }, 501);
      }
      console.error(err);
      return c.json({ success: false, message: 'Failed to upload progress photo' }, 500);
    }
  });

  router.get('/:id/progress-photos', async (c) => {
    try {
      const photos = await clientService.listProgressPhotos(c.req.param('id'));
      return c.json({ success: true, data: photos });
    } catch (err) {
      return c.json({ success: false, message: 'Failed to fetch photos' }, 500);
    }
  });

  router.delete('/:id/progress-photos/:photoId', async (c) => {
    try {
      const photo = await clientService.deleteProgressPhoto(c.req.param('id'), c.req.param('photoId'));
      if (!photo) return c.json({ success: false, message: 'Photo not found' }, 404);
      const bucket = (c.env as any).FILES_BUCKET as R2Bucket | undefined;
      if (bucket && photo.file_path) await bucket.delete(photo.file_path).catch(() => {});
      return c.json({ success: true, message: 'Photo deleted' });
    } catch (err) {
      return c.json({ success: false, message: 'Failed to delete photo' }, 500);
    }
  });

  return router;
}
