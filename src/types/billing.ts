export interface BillingProject {
  id: number;
  name: string;
  hourly_rate: number;
  created_at: number;
  archived: boolean;
}

export interface BillingTrackInfo {
  id: number;
  name: string;
  total_seconds: number;
}

export interface BillingProjectDetail {
  project: BillingProject;
  tracks: BillingTrackInfo[];
  total_seconds: number;
  total_value: number;
}
