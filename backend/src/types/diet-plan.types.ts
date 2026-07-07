import { Pool } from 'pg';
import { CreateDietPlanInput } from '../types/diet-plan.types';

const SELECT_JOIN = `
  SELECT dp.id, dp.client_id, dp.dietitian_id, dp.plan_number, dp.goal,
         dp.morning, dp.breakfast, dp.mid_morning, dp.lunch, dp.evening_snacks,
         dp.dinner, dp.bed_time, dp.note, dp.created_at, dp.updated_at,
         c.first_name, c.last_name
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

    return this.getById(dietitianId, res.rows[0].id);
  }

  async update(dietitianId: string, id: string, input: Partial<CreateDietPlanInput>) {
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
  // plan #2 out of 1,2,3 shifts #3 down to become the new #2).
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
    return true;
  }
}