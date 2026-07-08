export interface CreateDietPlanInput {
  client_id: string;
  goal?: string | null;
  morning?: string | null;
  breakfast?: string | null;
  mid_morning?: string | null;
  lunch?: string | null;
  evening_snacks?: string | null;
  dinner?: string | null;
  bed_time?: string | null;
  note?: string | null;
  // Optional — status to record against the client's PREVIOUS plan (if any)
  // now that this new plan is being created.
  previous_plan_status?: string;
  previous_plan_status_other?: string;
}

export interface DietPlanRow {
  id: string;
  client_id: string;
  client_name: string;
  dietitian_id: string;
  plan_number: number;
  goal: string | null;
  morning: string | null;
  breakfast: string | null;
  mid_morning: string | null;
  lunch: string | null;
  evening_snacks: string | null;
  dinner: string | null;
  bed_time: string | null;
  note: string | null;
  closure_status: string | null;
  closure_note: string | null;
  is_editable: boolean;
  created_at: string;
  updated_at: string;
}
export type DietPlan = DietPlanRow;
export type DietPlanInput = CreateDietPlanInput;
