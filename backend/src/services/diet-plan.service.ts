import { Pool } from 'pg';
import { CreateDietPlanInput } from '../types/diet-plan.types';
import { logClientTimelineEvent } from './client.service';

const SELECT_JOIN = `
  SELECT dp.id, dp.client_id, dp.dietitian_id, dp.plan_number, dp.goal,
         dp.morning, dp.breakfast, dp.mid_morning, dp.lunch, dp.evening_snacks,
         dp.dinner, dp.bed_time, dp.note, dp.closure_status, dp.closure_note,
         dp.created_at, dp.updated_at,
         c.first_name, c.last_name,
         (dp.plan_number = MAX(dp.plan_number) OVER (PARTITION BY dp.client_id)) AS is_editable
  FROM diet_plans dp
  JOIN clients c ON c.id = dp.client_id
`;

function withClientName(row: any) {
  if (!row) return null;
  const { first_name, last_name, ...rest } = row;
  return { ...rest, client_name: `${first_name} ${last_name}` };
}

export class DietPlanService {
  constructor(private db: Pool) {}

  async list(dietitianId: string) {
    const res = await this.db.query(
      `${SELECT_JOIN} WHERE dp.dietitian_id = $1 ORDER BY dp.created_at DESC`,
      [dietitianId]
    );
    return res.rows.map(withClientName);
  }

  async getById(dietitianId: string, id: string) {
    const res = await this.db.query(
      `${SELECT_JOIN} WHERE dp.dietitian_id = $1 AND dp.id = $2`,
      [dietitianId, id]
    );
    return withClientName(res.rows[0]);
  }

  async create(dietitianId: string, input: CreateDietPlanInput) {
    const countRes = await this.db.query(
      `SELECT COALESCE(MAX(plan_number), 0) + 1 AS next FROM diet_plans WHERE client_id = $1`,
      [input.client_id]
    );
    const planNumber = countRes.rows[0].next;

    // If a previous plan exists for this client and the user told us what
    // happened to it, record that on the OLD plan before it gets superseded.
    if (planNumber > 1 && (input.previous_plan_status || input.previous_plan_status_other)) {
      await this.db.query(
        `UPDATE diet_plans SET closure_status = $1, closure_note = $2
         WHERE client_id = $3 AND plan_number = $4`,
        [
          input.previous_plan_status ?? null,
          input.previous_plan_status_other ?? null,
          input.client_id,
          planNumber - 1,
        ]
      );
    }

    const res = await this.db.query(
      `INSERT INTO diet_plans
         (client_id, dietitian_id, plan_number, goal, morning, breakfast, mid_morning, lunch, evening_snacks, dinner, bed_time, note)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
      [
        input.client_id, dietitianId, planNumber, input.goal ?? null,
        input.morning ?? null, input.breakfast ?? null, input.mid_morning ?? null,
        input.lunch ?? null, input.evening_snacks ?? null, input.dinner ?? null,
        input.bed_time ?? null, input.note ?? null,
      ]
    );

    if (input.goal) {
      await this.db.query(`UPDATE clients SET primary_goal = $1, updated_at = now() WHERE id = $2`, [input.goal, input.client_id]);
    }

    await logClientTimelineEvent(this.db, input.client_id, 'diet_plan_created', `Diet Plan #${planNumber} created`);

    return this.getById(dietitianId, res.rows[0].id);
  }

  async update(dietitianId: string, id: string, input: Partial<CreateDietPlanInput>) {
    // Only the latest plan for a client may be edited. Older plans are locked
    // once a newer plan exists for the same client.
    const currentRes = await this.db.query(
      `SELECT client_id, plan_number FROM diet_plans WHERE dietitian_id = $1 AND id = $2`,
      [dietitianId, id]
    );
    const current = currentRes.rows[0];
    if (!current) return null;

    const maxRes = await this.db.query(
      `SELECT MAX(plan_number) AS max FROM diet_plans WHERE client_id = $1`,
      [current.client_id]
    );
    if (current.plan_number !== maxRes.rows[0].max) {
      throw new Error('DIET_PLAN_LOCKED');
    }

    const fields: string[] = [];
    const params: any[] = [dietitianId, id];
    Object.entries(input).forEach(([key, value]) => {
      if (value === undefined || key === 'client_id') return;
      params.push(value);
      fields.push(`${key} = $${params.length}`);
    });

    if (fields.length > 0) {
      await this.db.query(
        `UPDATE diet_plans SET ${fields.join(', ')}, updated_at = now() WHERE dietitian_id = $1 AND id = $2`,
        params
      );
      await logClientTimelineEvent(this.db, current.client_id, 'diet_plan_updated', `Diet Plan #${current.plan_number} updated`);
    }

    if (input.goal !== undefined && input.goal) {
      const plan = await this.getById(dietitianId, id);
      if (plan) {
        await this.db.query(`UPDATE clients SET primary_goal = $1, updated_at = now() WHERE id = $2`, [input.goal, plan.client_id]);
      }
    }

    return this.getById(dietitianId, id);
  }

  // Hard delete + renumber remaining plans for that client (e.g. deleting
  // plan #2 out of 1,2,3 shifts #3 down to become the new #2). Because
  // "editable" is computed live as "highest plan_number for this client",
  // deleting the current latest plan automatically makes the one before it
  // editable again — no extra logic needed for that part.
  async remove(dietitianId: string, id: string) {
    const planRes = await this.db.query(
      `SELECT client_id, plan_number FROM diet_plans WHERE dietitian_id = $1 AND id = $2`,
      [dietitianId, id]
    );
    const plan = planRes.rows[0];
    if (!plan) return false;

    await this.db.query(`DELETE FROM diet_plans WHERE dietitian_id = $1 AND id = $2`, [dietitianId, id]);
    await this.db.query(
      `UPDATE diet_plans SET plan_number = plan_number - 1 WHERE client_id = $1 AND plan_number > $2`,
      [plan.client_id, plan.plan_number]
    );
    await logClientTimelineEvent(this.db, plan.client_id, 'diet_plan_deleted', `Diet Plan #${plan.plan_number} deleted`);
    return true;
  }
}