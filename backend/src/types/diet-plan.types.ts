export type ClosureStatus =
  | 'sent'
  | 'rejected'
  | 'not_appropriate'
  | 'discontinued'
  | 'replaced'
  | 'other';

export interface CreateDietPlanInput {
  client_id: string;
  goal?: string;
  morning?: string;
  breakfast?: string;
  mid_morning?: string;
  lunch?: string;
  evening_snacks?: string;
  dinner?: string;
  bed_time?: string;
  note?: string | null;
  // Optional — describes what happened to the client's PREVIOUS plan (if any)
  // now that this new one is being created. Saved against the old plan, not this one.
  previous_plan_status?: ClosureStatus;
  previous_plan_status_other?: string;
}

export interface DietPlan {
  id: string;
  client_id: string;
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
  closure_status: ClosureStatus | null;
  closure_note: string | null;
  created_at: string;
  updated_at: string;
  client_name?: string;
  is_editable?: boolean;
}

export type DietPlanInput = CreateDietPlanInput;