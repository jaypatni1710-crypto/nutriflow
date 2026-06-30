import { Pool } from 'pg';
import { CreateClientInput } from '../types/client.types';

function calcAge(dob: string | null | undefined): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

function calcBmi(weightKg?: number, heightCm?: number): number | null {
  if (!weightKg || !heightCm) return null;
  const h = heightCm / 100;
  return Math.round((weightKg / (h * h)) * 10) / 10;
}

function bmiCategory(bmi: number | null): string | null {
  if (bmi === null) return null;
  if (bmi < 18.5) return 'Underweight';
  if (bmi < 25) return 'Normal';
  if (bmi < 30) return 'Overweight';
  return 'Obese';
}

function calcBmr(weightKg?: number, heightCm?: number, age?: number | null, gender?: string): number | null {
  if (!weightKg || !heightCm || !age) return null;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  const bmr = gender === 'Female' ? base - 161 : base + 5;
  return Math.round(bmr);
}

function calcDailyCalories(bmr: number | null, activityLevel?: string): number | null {
  if (bmr === null) return null;
  const factors: Record<string, number> = {
    Sedentary: 1.2,
    'Lightly Active': 1.375,
    'Moderately Active': 1.55,
    'Very Active': 1.725,
    Athlete: 1.9,
  };
  const factor = (activityLevel && factors[activityLevel]) || 1.2;
  return Math.round(bmr * factor);
}

function calcDailyProtein(weightKg?: number): number | null {
  if (!weightKg) return null;
  return Math.round(weightKg * 1.6 * 10) / 10;
}

function calcIdealWeightRange(heightCm?: number): { min: number | null; max: number | null } {
  if (!heightCm) return { min: null, max: null };
  const h = heightCm / 100;
  return {
    min: Math.round(18.5 * h * h * 10) / 10,
    max: Math.round(24.9 * h * h * 10) / 10,
  };
}

export class ClientService {
  constructor(private db: Pool) {}

  async listClients(
    dietitianId: string,
    opts: { search?: string; goal?: string; condition?: string; status?: string; tag?: string; archived?: boolean; page: number; limit: number }
  ) {
    const { search, goal, condition, status, tag, archived, page, limit } = opts;
    const conditions: string[] = ['c.dietitian_id = $1', `c.is_archived = ${archived ? 'true' : 'false'}`];
    const params: any[] = [dietitianId];

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(c.first_name || ' ' || c.last_name ILIKE $${params.length} OR c.phone_number ILIKE $${params.length})`);
    }
    if (goal) { params.push(goal); conditions.push(`c.primary_goal = $${params.length}`); }
    if (condition) {
      params.push(condition);
      conditions.push(`EXISTS (SELECT 1 FROM client_medical_history mh WHERE mh.client_id = c.id AND $${params.length} = ANY(mh.conditions))`);
    }
    if (status) { params.push(status); conditions.push(`c.status = $${params.length}`); }
    if (tag) {
      params.push(tag);
      conditions.push(`EXISTS (SELECT 1 FROM client_tags t WHERE t.client_id = c.id AND t.tag = $${params.length})`);
    }

    const where = conditions.join(' AND ');
    const offset = (page - 1) * limit;
    const countRes = await this.db.query(`SELECT COUNT(*) FROM clients c WHERE ${where}`, params);
    const total = parseInt(countRes.rows[0].count, 10);

    params.push(limit, offset);
    const dataRes = await this.db.query(
      `SELECT c.id, c.first_name, c.last_name, c.phone_number, c.date_of_birth, c.primary_goal, c.status, c.is_archived, c.archived_at, c.updated_at,
              a.current_weight_kg, a.bmi, a.bmi_category, a.diet_type,
              COALESCE((SELECT array_agg(t.tag ORDER BY t.tag) FROM client_tags t WHERE t.client_id = c.id), '{}') AS tags
       FROM clients c
       LEFT JOIN client_assessments a ON a.client_id = c.id
       WHERE ${where}
       ORDER BY c.updated_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    return { data: dataRes.rows, total, page, limit, total_pages: Math.ceil(total / limit) };
  }

  async createClient(dietitianId: string, input: CreateClientInput) {
    const conn = await this.db.connect();
    try {
      await conn.query('BEGIN');
      const clientRes = await conn.query(
        `INSERT INTO clients (
          dietitian_id, first_name, last_name, phone_number, whatsapp_number, email, gender,
          date_of_birth, occupation, city, address, primary_goal, specify_goal, secondary_goals,
          target_weight, target_date
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
        [
          dietitianId, input.first_name, input.last_name, input.phone_number,
          input.whatsapp_number || null, input.email || null, input.gender || null,
          input.date_of_birth || null, input.occupation || null, input.city || null,
          input.address || null, input.primary_goal || null, input.specify_goal || null,
          input.secondary_goals || [], input.target_weight ?? null, input.target_date || null,
        ]
      );
      const newClient = clientRes.rows[0];

      const age = calcAge(input.date_of_birth);
      const bmi = calcBmi(input.current_weight_kg, input.height_cm);
      const bmr = calcBmr(input.current_weight_kg, input.height_cm, age, input.gender);
      const dailyCalories = calcDailyCalories(bmr, input.activity_level);
      const dailyProtein = calcDailyProtein(input.current_weight_kg);
      const idealWeight = calcIdealWeightRange(input.height_cm);

      await conn.query(
        `INSERT INTO client_assessments (
          client_id, height_cm, current_weight_kg, goal_weight_kg, waist_cm, hip_cm, chest_cm, neck_cm,
          bmi, bmi_category, bmr, daily_calories, daily_protein, ideal_weight_min, ideal_weight_max,
          diet_type, specify_diet_type, food_preferences, disliked_foods, food_allergies, food_intolerances,
          wake_up_time, sleep_time, water_intake_per_day, working_hours, stress_level, activity_level,
          exercise_routine, lifestyle_notes, recall_breakfast, recall_lunch, recall_dinner, recall_snacks,
          recall_tea_coffee, recall_water
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35)`,
        [
          newClient.id, input.height_cm ?? null, input.current_weight_kg ?? null, input.goal_weight_kg ?? null,
          input.waist_cm ?? null, input.hip_cm ?? null, input.chest_cm ?? null, input.neck_cm ?? null,
          bmi, bmiCategory(bmi), bmr, dailyCalories, dailyProtein, idealWeight.min, idealWeight.max,
          input.diet_type || null, input.specify_diet_type || null, input.food_preferences || null,
          input.disliked_foods || null, input.food_allergies || null, input.food_intolerances || null,
          input.wake_up_time || null, input.sleep_time || null, input.water_intake_per_day || null,
          input.working_hours || null, input.stress_level || null, input.activity_level || null,
          input.exercise_routine || null, input.lifestyle_notes || null, input.recall_breakfast || null,
          input.recall_lunch || null, input.recall_dinner || null, input.recall_snacks || null,
          input.recall_tea_coffee || null, input.recall_water || null,
        ]
      );
      await conn.query(
        `INSERT INTO client_medical_history (client_id, conditions, specify_condition, current_medications, family_medical_history, medical_notes)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [newClient.id, input.conditions || [], input.specify_condition || null, input.current_medications || null, input.family_medical_history || null, input.medical_notes || null]
      );
      if (input.current_weight_kg) {
        await conn.query(
          `INSERT INTO client_progress_logs (client_id, weight_kg, bmi, waist_cm) VALUES ($1,$2,$3,$4)`,
          [newClient.id, input.current_weight_kg, bmi, input.waist_cm ?? null]
        );
      }
      await conn.query('COMMIT');
      await this.addTimelineEvent(newClient.id, 'client_created', 'Client record created');
      return newClient;
    } catch (err) {
      await conn.query('ROLLBACK');
      throw err;
    } finally {
      conn.release();
    }
  }

  async getClientById(dietitianId: string, clientId: string) {
    const res = await this.db.query(`SELECT * FROM clients WHERE id = $1 AND dietitian_id = $2`, [clientId, dietitianId]);
    return res.rows[0] || null;
  }

  async getFullProfile(dietitianId: string, clientId: string) {
    const c = await this.getClientById(dietitianId, clientId);
    if (!c) return null;
    const [assessment, medical, progress, labReports, notes, foodFrequency, progressPhotos, timeline, communications, tags] = await Promise.all([
      this.db.query(`SELECT * FROM client_assessments WHERE client_id = $1`, [clientId]),
      this.db.query(`SELECT * FROM client_medical_history WHERE client_id = $1`, [clientId]),
      this.db.query(`SELECT * FROM client_progress_logs WHERE client_id = $1 ORDER BY logged_at ASC`, [clientId]),
      this.db.query(`SELECT * FROM client_lab_reports WHERE client_id = $1 ORDER BY uploaded_at DESC`, [clientId]),
      this.db.query(`SELECT * FROM client_notes WHERE client_id = $1 ORDER BY created_at DESC`, [clientId]),
      this.db.query(`SELECT * FROM client_food_frequency WHERE client_id = $1 ORDER BY created_at DESC`, [clientId]),
      this.db.query(`SELECT * FROM client_progress_photos WHERE client_id = $1 ORDER BY uploaded_at DESC`, [clientId]),
      this.db.query(`SELECT * FROM client_timeline WHERE client_id = $1 ORDER BY created_at DESC`, [clientId]),
      this.db.query(`SELECT * FROM client_communications WHERE client_id = $1 ORDER BY created_at DESC`, [clientId]),
      this.db.query(`SELECT tag FROM client_tags WHERE client_id = $1 ORDER BY tag`, [clientId]),
    ]);
    return {
      client: c,
      assessment: assessment.rows[0] || null,
      medical_history: medical.rows[0] || null,
      progress_logs: progress.rows,
      lab_reports: labReports.rows,
      notes: notes.rows,
      food_frequency: foodFrequency.rows,
      progress_photos: progressPhotos.rows,
      timeline: timeline.rows,
      communications: communications.rows,
      tags: tags.rows.map((r: any) => r.tag),
    };
  }

  async updateClient(dietitianId: string, clientId: string, input: Partial<CreateClientInput>) {
    const existing = await this.getClientById(dietitianId, clientId);
    if (!existing) return null;

    const clientFields: Record<string, any> = {
      first_name: input.first_name, last_name: input.last_name, phone_number: input.phone_number,
      whatsapp_number: input.whatsapp_number, email: input.email, gender: input.gender,
      date_of_birth: input.date_of_birth, occupation: input.occupation, city: input.city,
      address: input.address, primary_goal: input.primary_goal, specify_goal: input.specify_goal,
      secondary_goals: input.secondary_goals, target_weight: input.target_weight, target_date: input.target_date,
      status: (input as any).status,
    };
    const setClauses: string[] = [];
    const params: any[] = [];
    for (const [k, v] of Object.entries(clientFields)) {
      if (v !== undefined) { params.push(v); setClauses.push(`${k} = $${params.length}`); }
    }
    if (setClauses.length > 0) {
      params.push(clientId);
      await this.db.query(`UPDATE clients SET ${setClauses.join(', ')} WHERE id = $${params.length}`, params);
      if (input.target_weight !== undefined || input.target_date !== undefined) {
        await this.addTimelineEvent(clientId, 'goal_updated', 'Goal updated');
      }
      if ((input as any).status !== undefined) {
        await this.addTimelineEvent(clientId, 'status_changed', `Status changed to ${String((input as any).status).replace('_', ' ')}`);
      }
    }

    const assessmentFields: Record<string, any> = {
      height_cm: input.height_cm, current_weight_kg: input.current_weight_kg, goal_weight_kg: input.goal_weight_kg,
      waist_cm: input.waist_cm, hip_cm: input.hip_cm, chest_cm: input.chest_cm, neck_cm: input.neck_cm,
      diet_type: input.diet_type, specify_diet_type: input.specify_diet_type, food_preferences: input.food_preferences,
      disliked_foods: input.disliked_foods, food_allergies: input.food_allergies, food_intolerances: input.food_intolerances,
      wake_up_time: input.wake_up_time, sleep_time: input.sleep_time, water_intake_per_day: input.water_intake_per_day,
      working_hours: input.working_hours, stress_level: input.stress_level, activity_level: input.activity_level,
      exercise_routine: input.exercise_routine, lifestyle_notes: input.lifestyle_notes,
      recall_breakfast: input.recall_breakfast, recall_lunch: input.recall_lunch, recall_dinner: input.recall_dinner,
      recall_snacks: input.recall_snacks, recall_tea_coffee: input.recall_tea_coffee, recall_water: input.recall_water,
    };

    if (input.height_cm !== undefined || input.current_weight_kg !== undefined || input.activity_level !== undefined || input.date_of_birth !== undefined || input.gender !== undefined) {
      const current = await this.db.query(`SELECT * FROM client_assessments WHERE client_id = $1`, [clientId]);
      const cur = current.rows[0] || {};
      const heightCm = input.height_cm ?? cur.height_cm;
      const weightKg = input.current_weight_kg ?? cur.current_weight_kg;
      const dob = input.date_of_birth ?? existing.date_of_birth;
      const gender = input.gender ?? existing.gender;
      const activityLevel = input.activity_level ?? cur.activity_level;

      const age = calcAge(dob);
      const bmi = calcBmi(weightKg, heightCm);
      const bmr = calcBmr(weightKg, heightCm, age, gender);
      assessmentFields.bmi = bmi;
      assessmentFields.bmi_category = bmiCategory(bmi);
      assessmentFields.bmr = bmr;
      assessmentFields.daily_calories = calcDailyCalories(bmr, activityLevel);
      assessmentFields.daily_protein = calcDailyProtein(weightKg);
      const idealWeight = calcIdealWeightRange(heightCm);
      assessmentFields.ideal_weight_min = idealWeight.min;
      assessmentFields.ideal_weight_max = idealWeight.max;

      if (input.current_weight_kg !== undefined) {
        await this.db.query(
          `INSERT INTO client_progress_logs (client_id, weight_kg, bmi, waist_cm) VALUES ($1,$2,$3,$4)`,
          [clientId, weightKg, bmi, input.waist_cm ?? cur.waist_cm ?? null]
        );
        await this.addTimelineEvent(clientId, 'weight_updated', `Weight updated to ${weightKg} kg`);
      } else {
        await this.addTimelineEvent(clientId, 'assessment_updated', 'Assessment details updated');
      }
    }

    const aSet: string[] = [];
    const aParams: any[] = [];
    for (const [k, v] of Object.entries(assessmentFields)) {
      if (v !== undefined) { aParams.push(v); aSet.push(`${k} = $${aParams.length}`); }
    }
    if (aSet.length > 0) {
      aParams.push(clientId);
      await this.db.query(`INSERT INTO client_assessments (client_id) VALUES ($${aParams.length}) ON CONFLICT (client_id) DO NOTHING`, [clientId]);
      await this.db.query(`UPDATE client_assessments SET ${aSet.join(', ')} WHERE client_id = $${aParams.length}`, aParams);
    }

    const medFields: Record<string, any> = {
      conditions: input.conditions, specify_condition: input.specify_condition,
      current_medications: input.current_medications, family_medical_history: input.family_medical_history,
      medical_notes: input.medical_notes,
    };
    const mSet: string[] = [];
    const mParams: any[] = [];
    for (const [k, v] of Object.entries(medFields)) {
      if (v !== undefined) { mParams.push(v); mSet.push(`${k} = $${mParams.length}`); }
    }
    if (mSet.length > 0) {
      await this.db.query(`INSERT INTO client_medical_history (client_id) VALUES ($1) ON CONFLICT (client_id) DO NOTHING`, [clientId]);
      mParams.push(clientId);
      await this.db.query(`UPDATE client_medical_history SET ${mSet.join(', ')} WHERE client_id = $${mParams.length}`, mParams);
    }
    return this.getClientById(dietitianId, clientId);
  }

  async deleteClient(dietitianId: string, clientId: string) {
    const res = await this.db.query(`DELETE FROM clients WHERE id = $1 AND dietitian_id = $2`, [clientId, dietitianId]);
    return (res.rowCount ?? 0) > 0;
  }

  async addNote(clientId: string, dietitianId: string, content: string) {
    const res = await this.db.query(
      `INSERT INTO client_notes (client_id, dietitian_id, content) VALUES ($1,$2,$3) RETURNING *`,
      [clientId, dietitianId, content]
    );
    await this.addTimelineEvent(clientId, 'note_added', 'Note added');
    return res.rows[0];
  }

  async updateNote(clientId: string, noteId: string, content: string) {
    const res = await this.db.query(
      `UPDATE client_notes SET content = $1 WHERE id = $2 AND client_id = $3 RETURNING *`,
      [content, noteId, clientId]
    );
    return res.rows[0] || null;
  }

  async deleteNote(clientId: string, noteId: string) {
    const res = await this.db.query(`DELETE FROM client_notes WHERE id = $1 AND client_id = $2`, [noteId, clientId]);
    return (res.rowCount ?? 0) > 0;
  }

  async addTimelineEvent(clientId: string, eventType: string, description: string) {
    await this.db.query(
      `INSERT INTO client_timeline (client_id, event_type, description) VALUES ($1,$2,$3)`,
      [clientId, eventType, description]
    );
  }

  async addFoodFrequency(clientId: string, input: Record<string, string | undefined>) {
    const res = await this.db.query(
      `INSERT INTO client_food_frequency (client_id, fruits, vegetables, dairy_products, fast_food, sweets, sugary_drinks, tea_coffee, fried_foods, bakery_products, packaged_foods)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [clientId, input.fruits || null, input.vegetables || null, input.dairy_products || null,
       input.fast_food || null, input.sweets || null, input.sugary_drinks || null, input.tea_coffee || null,
       input.fried_foods || null, input.bakery_products || null, input.packaged_foods || null]
    );
    await this.addTimelineEvent(clientId, 'assessment_updated', 'Food frequency questionnaire updated');
    return res.rows[0];
  }

  async listFoodFrequency(clientId: string) {
    const res = await this.db.query(`SELECT * FROM client_food_frequency WHERE client_id = $1 ORDER BY created_at DESC`, [clientId]);
    return res.rows;
  }

  async updateStatus(dietitianId: string, clientId: string, status: string) {
    const res = await this.db.query(
      `UPDATE clients SET status = $1 WHERE id = $2 AND dietitian_id = $3 RETURNING *`,
      [status, clientId, dietitianId]
    );
    if (res.rows[0]) await this.addTimelineEvent(clientId, 'status_changed', `Status changed to ${status.replace('_', ' ')}`);
    return res.rows[0] || null;
  }

  async getTimeline(clientId: string) {
    const res = await this.db.query(`SELECT * FROM client_timeline WHERE client_id = $1 ORDER BY created_at DESC`, [clientId]);
    return res.rows;
  }

  async addCommunication(clientId: string, dietitianId: string, type: string, description?: string) {
    const res = await this.db.query(
      `INSERT INTO client_communications (client_id, dietitian_id, type, description) VALUES ($1,$2,$3,$4) RETURNING *`,
      [clientId, dietitianId, type, description || null]
    );
    await this.addTimelineEvent(clientId, 'communication_logged', `${type} logged`);
    return res.rows[0];
  }

  async listCommunications(clientId: string) {
    const res = await this.db.query(`SELECT * FROM client_communications WHERE client_id = $1 ORDER BY created_at DESC`, [clientId]);
    return res.rows;
  }

  async updateCommunication(clientId: string, commId: string, type: string, description?: string) {
    const res = await this.db.query(
      `UPDATE client_communications SET type = $1, description = $2 WHERE id = $3 AND client_id = $4 RETURNING *`,
      [type, description || null, commId, clientId]
    );
    return res.rows[0] || null;
  }

  async deleteCommunication(clientId: string, commId: string) {
    const res = await this.db.query(`DELETE FROM client_communications WHERE id = $1 AND client_id = $2`, [commId, clientId]);
    return (res.rowCount ?? 0) > 0;
  }

  async addTag(clientId: string, tag: string) {
    await this.db.query(
      `INSERT INTO client_tags (client_id, tag) VALUES ($1,$2) ON CONFLICT (client_id, tag) DO NOTHING`,
      [clientId, tag]
    );
    return this.listTags(clientId);
  }

  async removeTag(clientId: string, tag: string) {
    await this.db.query(`DELETE FROM client_tags WHERE client_id = $1 AND tag = $2`, [clientId, tag]);
    return this.listTags(clientId);
  }

  async listTags(clientId: string) {
    const res = await this.db.query(`SELECT tag FROM client_tags WHERE client_id = $1 ORDER BY tag`, [clientId]);
    return res.rows.map((r: any) => r.tag);
  }

  async listAllTags(dietitianId: string) {
    const res = await this.db.query(
      `SELECT DISTINCT t.tag FROM client_tags t JOIN clients c ON c.id = t.client_id WHERE c.dietitian_id = $1 ORDER BY t.tag`,
      [dietitianId]
    );
    return res.rows.map((r: any) => r.tag);
  }

  async checkDuplicate(dietitianId: string, phone?: string, whatsapp?: string, email?: string) {
    const conditions: string[] = [];
    const params: any[] = [dietitianId];
    if (phone) { params.push(phone); conditions.push(`phone_number = $${params.length} OR whatsapp_number = $${params.length}`); }
    if (whatsapp && whatsapp !== phone) { params.push(whatsapp); conditions.push(`phone_number = $${params.length} OR whatsapp_number = $${params.length}`); }
    if (email) { params.push(email); conditions.push(`email = $${params.length}`); }
    if (conditions.length === 0) return [];
    const res = await this.db.query(
      `SELECT id, first_name, last_name, phone_number, whatsapp_number, email FROM clients WHERE dietitian_id = $1 AND (${conditions.join(' OR ')}) LIMIT 5`,
      params
    );
    return res.rows;
  }

  async archiveClient(dietitianId: string, clientId: string) {
    const res = await this.db.query(
      `UPDATE clients SET is_archived = true, archived_at = NOW() WHERE id = $1 AND dietitian_id = $2 RETURNING *`,
      [clientId, dietitianId]
    );
    if (res.rows[0]) await this.addTimelineEvent(clientId, 'archived', 'Client archived');
    return res.rows[0] || null;
  }

  async restoreClient(dietitianId: string, clientId: string) {
    const res = await this.db.query(
      `UPDATE clients SET is_archived = false, archived_at = NULL WHERE id = $1 AND dietitian_id = $2 RETURNING *`,
      [clientId, dietitianId]
    );
    if (res.rows[0]) await this.addTimelineEvent(clientId, 'restored', 'Client restored');
    return res.rows[0] || null;
  }

  async countLabReports(clientId: string): Promise<number> {
    const res = await this.db.query(
      `SELECT COUNT(*)::int AS count FROM client_lab_reports WHERE client_id = $1`,
      [clientId]
    );
    return res.rows[0]?.count || 0;
  }

  async addLabReport(clientId: string, reportType: string, filePath: string, originalFilename: string, uploadedBy: string) {
    const res = await this.db.query(
      `INSERT INTO client_lab_reports (client_id, report_type, file_path, original_filename, uploaded_by) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [clientId, reportType, filePath, originalFilename, uploadedBy]
    );
    await this.addTimelineEvent(clientId, 'report_uploaded', `${reportType} report uploaded`);
    return res.rows[0];
  }

  async deleteLabReport(clientId: string, reportId: string) {
    const res = await this.db.query(
      `DELETE FROM client_lab_reports WHERE id = $1 AND client_id = $2 RETURNING file_path`,
      [reportId, clientId]
    );
    return res.rows[0] || null;
  }

  async addProgressPhoto(clientId: string, photoType: string, label: string, filePath: string, originalFilename: string) {
    const res = await this.db.query(
      `INSERT INTO client_progress_photos (client_id, photo_type, view_type, file_path, original_filename) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [clientId, photoType, label, filePath, originalFilename]
    );
    await this.addTimelineEvent(clientId, 'photo_uploaded', `${label} progress photo uploaded`);
    return res.rows[0];
  }

  async listProgressPhotos(clientId: string) {
    const res = await this.db.query(`SELECT * FROM client_progress_photos WHERE client_id = $1 ORDER BY uploaded_at DESC`, [clientId]);
    return res.rows;
  }

  async deleteProgressPhoto(clientId: string, photoId: string) {
    const res = await this.db.query(
      `DELETE FROM client_progress_photos WHERE id = $1 AND client_id = $2 RETURNING file_path`,
      [photoId, clientId]
    );
    return res.rows[0] || null;
  }
}