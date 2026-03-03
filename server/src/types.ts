export interface Employee {
  id: number;
  name: string;
  role: string;
  hourly_rate: number;
  weekly_hours_max: number;
  created_at: string;
}

export interface Availability {
  id: number;
  employee_id: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

export interface Forecast {
  id: number;
  date: string;
  expected_revenue: number;
  expected_covers: number;
}

export interface Schedule {
  id: number;
  week_start: string;
  labor_budget: number;
  status: string;
  created_at: string;
}

export interface Shift {
  id: number;
  schedule_id: number;
  employee_id: number;
  date: string;
  start_time: string;
  end_time: string;
  role: string;
  status: string;
  created_at: string;
}

export interface ShiftSwap {
  id: number;
  shift_id: number;
  requester_id: number;
  target_id: number | null;
  reason: string | null;
  status: string;
  manager_notes: string | null;
  created_at: string;
}

export interface BurnoutRisk {
  employee_id: number;
  employee_name: string;
  risk_level: 'low' | 'medium' | 'high';
  risk_score: number;
  factors: string[];
  weekly_hours: number;
  consecutive_days: number;
  clopens: number;
  doubles: number;
}

export interface LaborCostSummary {
  schedule_id: number;
  week_start: string;
  labor_budget: number;
  projected_cost: number;
  actual_cost: number;
  variance: number;
  by_day: { date: string; cost: number }[];
  by_role: { role: string; cost: number }[];
}
