import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { ClientService } from '../services/client.service';
import { authenticate, requireDietitian } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { createClientSchema, updateClientSchema, createNoteSchema, foodFrequencySchema, statusUpdateSchema, communicationSchema, tagSchema, duplicateCheckSchema } from '../types/client.validation';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'lab-reports');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const PHOTO_DIR = path.join(process.cwd(), 'uploads', 'progress-photos');
fs.mkdirSync(PHOTO_DIR, { recursive: true });

const ALLOWED_REPORT_TYPES = ['CBC', 'HbA1c', 'Thyroid', 'Vitamin D', 'Vitamin B12', 'Lipid Profile', 'Prescription', 'Other'];
const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
const ALLOWED_PHOTO_VIEWS = ['Front', 'Side', 'Back'];
const ALLOWED_PHOTO_MIME = ['image/jpeg', 'image/jpg', 'image/png'];

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const unique = crypto.randomBytes(16).toString('hex');
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      cb(new Error('Only PDF, JPG, and PNG files are allowed'));
      return;
    }
    cb(null, true);
  },
});

const photoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, PHOTO_DIR),
  filename: (_req, file, cb) => {
    const unique = crypto.randomBytes(16).toString('hex');
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const uploadPhoto = multer({
  storage: photoStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_PHOTO_MIME.includes(file.mimetype)) {
      cb(new Error('Only JPG and PNG files are allowed'));
      return;
    }
    cb(null, true);
  },
});

export function createClientRouter(clientService: ClientService) {
  const router = Router();
  router.use(authenticate, requireDietitian);

  router.get('/', async (req, res) => {
    try {
      const dietitianId = req.user!.sub;
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 10;
      const search = (req.query.search as string) || undefined;
      const goal = (req.query.goal as string) || undefined;
      const condition = (req.query.condition as string) || undefined;
      const status = (req.query.status as string) || undefined;
      const tag = (req.query.tag as string) || undefined;
      const archived = req.query.archived === 'true';
      const result = await clientService.listClients(dietitianId, { search, goal, condition, status, tag, archived, page, limit });
      res.json({ success: true, ...result });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Failed to fetch clients' });
    }
  });

  // Feature 3: All distinct tags for this dietitian (must precede /:id)
  router.get('/tags/all', async (req, res) => {
    try {
      const dietitianId = req.user!.sub;
      const tags = await clientService.listAllTags(dietitianId);
      res.json({ success: true, data: tags });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Failed to fetch tags' });
    }
  });

  // Feature 4: Duplicate Client Detection (pre-creation check)
  router.post('/check-duplicate', validate(duplicateCheckSchema), async (req, res) => {
    try {
      const dietitianId = req.user!.sub;
      const { phone_number, whatsapp_number, email } = req.body;
      const matches = await clientService.checkDuplicate(dietitianId, phone_number, whatsapp_number, email || undefined);
      res.json({ success: true, data: matches });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Failed to check for duplicates' });
    }
  });

  router.post('/', validate(createClientSchema), async (req, res) => {
    try {
      const dietitianId = req.user!.sub;
      const client = await clientService.createClient(dietitianId, req.body);
      res.status(201).json({ success: true, data: client });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Failed to create client' });
    }
  });

  router.get('/:id', async (req, res) => {
    try {
      const dietitianId = req.user!.sub;
      const profile = await clientService.getFullProfile(dietitianId, req.params.id);
      if (!profile) {
        res.status(404).json({ success: false, message: 'Client not found' });
        return;
      }
      res.json({ success: true, data: profile });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Failed to fetch client' });
    }
  });

  router.put('/:id', validate(updateClientSchema), async (req, res) => {
    try {
      const dietitianId = req.user!.sub;
      const updated = await clientService.updateClient(dietitianId, req.params.id, req.body);
      if (!updated) {
        res.status(404).json({ success: false, message: 'Client not found' });
        return;
      }
      res.json({ success: true, data: updated });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Failed to update client' });
    }
  });

  router.delete('/:id', async (req, res) => {
    try {
      const dietitianId = req.user!.sub;
      const deleted = await clientService.deleteClient(dietitianId, req.params.id);
      if (!deleted) {
        res.status(404).json({ success: false, message: 'Client not found' });
        return;
      }
      res.json({ success: true, message: 'Client deleted' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Failed to delete client' });
    }
  });

  router.post('/:id/lab-reports', upload.single('file'), async (req, res) => {
    try {
      const dietitianId = req.user!.sub;
      const client = await clientService.getClientById(dietitianId, req.params.id);
      if (!client) {
        res.status(404).json({ success: false, message: 'Client not found' });
        return;
      }
      const reportType = req.body.report_type;
      if (!ALLOWED_REPORT_TYPES.includes(reportType)) {
        res.status(422).json({ success: false, message: 'Invalid report type' });
        return;
      }
      if (!req.file) {
        res.status(422).json({ success: false, message: 'File is required' });
        return;
      }
      const report = await clientService.addLabReport(req.params.id, reportType, req.file.filename, req.file.originalname, dietitianId);
      res.status(201).json({ success: true, data: report });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ success: false, message: err.message || 'Failed to upload report' });
    }
  });

  router.get('/:id/lab-reports/:reportId/download', async (req, res) => {
    try {
      const dietitianId = req.user!.sub;
      const client = await clientService.getClientById(dietitianId, req.params.id);
      if (!client) {
        res.status(404).json({ success: false, message: 'Client not found' });
        return;
      }
      const profile = await clientService.getFullProfile(dietitianId, req.params.id);
      const report = profile?.lab_reports.find((r: any) => r.id === req.params.reportId);
      if (!report) {
        res.status(404).json({ success: false, message: 'Report not found' });
        return;
      }
      res.download(path.join(UPLOAD_DIR, report.file_path), report.original_filename);
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Failed to download report' });
    }
  });

  router.delete('/:id/lab-reports/:reportId', async (req, res) => {
    try {
      const dietitianId = req.user!.sub;
      const client = await clientService.getClientById(dietitianId, req.params.id);
      if (!client) {
        res.status(404).json({ success: false, message: 'Client not found' });
        return;
      }
      const deleted = await clientService.deleteLabReport(req.params.id, req.params.reportId);
      if (!deleted) {
        res.status(404).json({ success: false, message: 'Report not found' });
        return;
      }
      const filePath = path.join(UPLOAD_DIR, deleted.file_path);
      fs.unlink(filePath, () => {});
      res.json({ success: true, message: 'Report deleted' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Failed to delete report' });
    }
  });

  router.post('/:id/notes', validate(createNoteSchema), async (req, res) => {
    try {
      const dietitianId = req.user!.sub;
      const client = await clientService.getClientById(dietitianId, req.params.id);
      if (!client) {
        res.status(404).json({ success: false, message: 'Client not found' });
        return;
      }
      const note = await clientService.addNote(req.params.id, dietitianId, req.body.content);
      res.status(201).json({ success: true, data: note });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Failed to add note' });
    }
  });

  router.put('/:id/notes/:noteId', validate(createNoteSchema), async (req, res) => {
    try {
      const dietitianId = req.user!.sub;
      const client = await clientService.getClientById(dietitianId, req.params.id);
      if (!client) {
        res.status(404).json({ success: false, message: 'Client not found' });
        return;
      }
      const note = await clientService.updateNote(req.params.id, req.params.noteId, req.body.content);
      if (!note) {
        res.status(404).json({ success: false, message: 'Note not found' });
        return;
      }
      res.json({ success: true, data: note });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Failed to update note' });
    }
  });

  router.delete('/:id/notes/:noteId', async (req, res) => {
    try {
      const dietitianId = req.user!.sub;
      const client = await clientService.getClientById(dietitianId, req.params.id);
      if (!client) {
        res.status(404).json({ success: false, message: 'Client not found' });
        return;
      }
      const deleted = await clientService.deleteNote(req.params.id, req.params.noteId);
      if (!deleted) {
        res.status(404).json({ success: false, message: 'Note not found' });
        return;
      }
      res.json({ success: true, message: 'Note deleted' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Failed to delete note' });
    }
  });

  // Feature 1: Food Frequency Questionnaire
  router.post('/:id/food-frequency', validate(foodFrequencySchema), async (req, res) => {
    try {
      const dietitianId = req.user!.sub;
      const client = await clientService.getClientById(dietitianId, req.params.id);
      if (!client) {
        res.status(404).json({ success: false, message: 'Client not found' });
        return;
      }
      const entry = await clientService.addFoodFrequency(req.params.id, req.body);
      res.status(201).json({ success: true, data: entry });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Failed to save food frequency' });
    }
  });

  router.get('/:id/food-frequency', async (req, res) => {
    try {
      const dietitianId = req.user!.sub;
      const client = await clientService.getClientById(dietitianId, req.params.id);
      if (!client) {
        res.status(404).json({ success: false, message: 'Client not found' });
        return;
      }
      const entries = await clientService.listFoodFrequency(req.params.id);
      res.json({ success: true, data: entries });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Failed to fetch food frequency' });
    }
  });

  // Feature 2: Progress Photos
  router.post('/:id/progress-photos', uploadPhoto.single('file'), async (req, res) => {
    try {
      const dietitianId = req.user!.sub;
      const client = await clientService.getClientById(dietitianId, req.params.id);
      if (!client) {
        res.status(404).json({ success: false, message: 'Client not found' });
        return;
      }
      const viewType = req.body.view_type;
      if (!ALLOWED_PHOTO_VIEWS.includes(viewType)) {
        res.status(422).json({ success: false, message: 'Invalid view type' });
        return;
      }
      if (!req.file) {
        res.status(422).json({ success: false, message: 'Photo file is required' });
        return;
      }
      const photo = await clientService.addProgressPhoto(req.params.id, viewType, req.file.filename, req.file.originalname);
      res.status(201).json({ success: true, data: photo });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ success: false, message: err.message || 'Failed to upload photo' });
    }
  });

  router.get('/:id/progress-photos/:photoId/file', async (req, res) => {
    try {
      const dietitianId = req.user!.sub;
      const client = await clientService.getClientById(dietitianId, req.params.id);
      if (!client) {
        res.status(404).json({ success: false, message: 'Client not found' });
        return;
      }
      const photos = await clientService.listProgressPhotos(req.params.id);
      const photo = photos.find((p: any) => p.id === req.params.photoId);
      if (!photo) {
        res.status(404).json({ success: false, message: 'Photo not found' });
        return;
      }
      res.sendFile(path.join(PHOTO_DIR, photo.file_path));
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Failed to load photo' });
    }
  });

  router.delete('/:id/progress-photos/:photoId', async (req, res) => {
    try {
      const dietitianId = req.user!.sub;
      const client = await clientService.getClientById(dietitianId, req.params.id);
      if (!client) {
        res.status(404).json({ success: false, message: 'Client not found' });
        return;
      }
      const deleted = await clientService.deleteProgressPhoto(req.params.id, req.params.photoId);
      if (!deleted) {
        res.status(404).json({ success: false, message: 'Photo not found' });
        return;
      }
      fs.unlink(path.join(PHOTO_DIR, deleted.file_path), () => {});
      res.json({ success: true, message: 'Photo deleted' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Failed to delete photo' });
    }
  });

  // Feature 3: Status Management
  router.patch('/:id/status', validate(statusUpdateSchema), async (req, res) => {
    try {
      const dietitianId = req.user!.sub;
      const updated = await clientService.updateStatus(dietitianId, req.params.id, req.body.status);
      if (!updated) {
        res.status(404).json({ success: false, message: 'Client not found' });
        return;
      }
      res.json({ success: true, data: updated });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Failed to update status' });
    }
  });

  // Feature 7: Client Timeline
  router.get('/:id/timeline', async (req, res) => {
    try {
      const dietitianId = req.user!.sub;
      const client = await clientService.getClientById(dietitianId, req.params.id);
      if (!client) {
        res.status(404).json({ success: false, message: 'Client not found' });
        return;
      }
      const timeline = await clientService.getTimeline(req.params.id);
      res.json({ success: true, data: timeline });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Failed to fetch timeline' });
    }
  });

  // Feature 1: Client Communication Log
  router.post('/:id/communications', validate(communicationSchema), async (req, res) => {
    try {
      const dietitianId = req.user!.sub;
      const client = await clientService.getClientById(dietitianId, req.params.id);
      if (!client) {
        res.status(404).json({ success: false, message: 'Client not found' });
        return;
      }
      const entry = await clientService.addCommunication(req.params.id, dietitianId, req.body.type, req.body.description);
      res.status(201).json({ success: true, data: entry });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Failed to log communication' });
    }
  });

  router.get('/:id/communications', async (req, res) => {
    try {
      const dietitianId = req.user!.sub;
      const client = await clientService.getClientById(dietitianId, req.params.id);
      if (!client) {
        res.status(404).json({ success: false, message: 'Client not found' });
        return;
      }
      const entries = await clientService.listCommunications(req.params.id);
      res.json({ success: true, data: entries });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Failed to fetch communications' });
    }
  });

  router.put('/:id/communications/:commId', validate(communicationSchema), async (req, res) => {
    try {
      const dietitianId = req.user!.sub;
      const client = await clientService.getClientById(dietitianId, req.params.id);
      if (!client) {
        res.status(404).json({ success: false, message: 'Client not found' });
        return;
      }
      const entry = await clientService.updateCommunication(req.params.id, req.params.commId, req.body.type, req.body.description);
      if (!entry) {
        res.status(404).json({ success: false, message: 'Communication entry not found' });
        return;
      }
      res.json({ success: true, data: entry });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Failed to update communication' });
    }
  });

  router.delete('/:id/communications/:commId', async (req, res) => {
    try {
      const dietitianId = req.user!.sub;
      const client = await clientService.getClientById(dietitianId, req.params.id);
      if (!client) {
        res.status(404).json({ success: false, message: 'Client not found' });
        return;
      }
      const deleted = await clientService.deleteCommunication(req.params.id, req.params.commId);
      if (!deleted) {
        res.status(404).json({ success: false, message: 'Communication entry not found' });
        return;
      }
      res.json({ success: true, message: 'Communication entry deleted' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Failed to delete communication' });
    }
  });

  // Feature 3: Client Tags
  router.post('/:id/tags', validate(tagSchema), async (req, res) => {
    try {
      const dietitianId = req.user!.sub;
      const client = await clientService.getClientById(dietitianId, req.params.id);
      if (!client) {
        res.status(404).json({ success: false, message: 'Client not found' });
        return;
      }
      const tags = await clientService.addTag(req.params.id, req.body.tag);
      res.status(201).json({ success: true, data: tags });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Failed to add tag' });
    }
  });

  router.delete('/:id/tags/:tag', async (req, res) => {
    try {
      const dietitianId = req.user!.sub;
      const client = await clientService.getClientById(dietitianId, req.params.id);
      if (!client) {
        res.status(404).json({ success: false, message: 'Client not found' });
        return;
      }
      const tags = await clientService.removeTag(req.params.id, decodeURIComponent(req.params.tag));
      res.json({ success: true, data: tags });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Failed to remove tag' });
    }
  });

  // Feature 5: Archive Client
  router.patch('/:id/archive', async (req, res) => {
    try {
      const dietitianId = req.user!.sub;
      const updated = await clientService.archiveClient(dietitianId, req.params.id);
      if (!updated) {
        res.status(404).json({ success: false, message: 'Client not found' });
        return;
      }
      res.json({ success: true, data: updated });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Failed to archive client' });
    }
  });

  router.patch('/:id/restore', async (req, res) => {
    try {
      const dietitianId = req.user!.sub;
      const updated = await clientService.restoreClient(dietitianId, req.params.id);
      if (!updated) {
        res.status(404).json({ success: false, message: 'Client not found' });
        return;
      }
      res.json({ success: true, data: updated });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Failed to restore client' });
    }
  });

  return router;
}
