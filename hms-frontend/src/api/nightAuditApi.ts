import api from './fetchClient';

export interface NightAuditResult {
  date: string;
  totalAssignments: number;
  chargesPosted: number;
  skippedAlreadyPosted: number;
  skippedFolioNotOpen: number;
  skippedNoFolio: number;
  errors: number;
  mealPlanChargesPosted: number;
  mealPlanChargesSkipped: number;
}

export function runNightAudit(date: string): Promise<NightAuditResult> {
  return api.post<NightAuditResult>(`/night-audit/run?date=${date}`);
}
