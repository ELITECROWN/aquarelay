import type * as GeoJSON from "geojson";
export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  organisation_id?: string | null;
  csrf_token?: string;
}
export interface WaterBody {
  id: string;
  name: string;
  aliases: string[];
  type: string;
  locality: string;
  latitude: number;
  longitude: number;
  geometry?: GeoJSON.Geometry;
  summary?: string;
  synthetic: boolean;
  case_count: number;
  latest_observed_at?: string;
  source_count: number;
  case_state: string;
  data_state: string;
  distance_m?: number;
}
export interface CaseRecord {
  id: string;
  waterbody_id: string;
  waterbody_name?: string;
  title: string;
  description: string;
  state: string;
  review_state: string;
  delivery_state: string;
  organisation_id?: string;
  created_at: string;
  observed_at: string;
  synthetic: boolean;
  merged_into?: string | null;
}
export interface RecordedEvent {
  id: string;
  record_id?: string;
  href?: string;
  waterbody_id: string;
  case_id?: string;
  kind: string;
  title: string;
  description: string;
  created_at: string;
  source_id?: string;
  synthetic: boolean;
}
export interface Passport {
  waterbody: WaterBody;
  events: RecordedEvent[];
  observations: Record<string, any>[];
  biodiversity: Record<string, any>[];
  cases: CaseRecord[];
  actions: Record<string, any>[];
  sources: Record<string, any>[];
  relationships: Record<string, any>[];
  nearby: WaterBody[];
  organisations: Record<string, any>[];
  changes: RecordedEvent[];
}
