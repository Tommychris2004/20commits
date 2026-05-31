// ============================================================
// Shared TypeScript types for GridNode backend
// ============================================================

export type UserRole = 'resident' | 'estate_manager' | 'admin';

export type DeviceStatus = 'online' | 'offline' | 'not_connected';

export type EnergySource = 'generator' | 'solar' | 'grid';

export type AlertType =
  | 'low_load_generator'
  | 'solar_forecast'
  | 'high_consumption'
  | 'generator_runtime'
  | 'cost_spike';

export type CarbonStatus = 'accumulating' | 'verifying' | 'issued' | 'sold' | 'paid';

export type TradingStatus = 'active' | 'matched' | 'expired' | 'cancelled';

export type FinancingStatus = 'pending' | 'approved' | 'rejected' | 'disbursed';

// ---- Database row shapes ----

export interface EstateRow {
  id: string;
  name: string;
  location: string;
  state: string;
  created_at: Date;
}

export interface UserRow {
  id: string;
  estate_id: string | null;
  email: string;
  password_hash: string;
  name: string;
  role: UserRole;
  created_at: Date;
}

export interface DeviceRow {
  id: string;
  node_id: string;
  estate_id: string | null;
  user_id: string | null;
  name: string | null;
  location: string | null;
  firmware_version: string;
  status: DeviceStatus;
  last_seen: Date | null;
  created_at: Date;
}

export interface ReadingRow {
  id: string;
  device_id: string;
  timestamp: Date;
  source: EnergySource;
  power_kw: string; // pg returns numeric as string
  energy_kwh: string;
  is_simulated: boolean;
}

export interface AlertLogRow {
  id: string;
  device_id: string | null;
  user_id: string | null;
  alert_type: AlertType;
  message: string;
  impact_naira: string | null;
  dismissed_at: Date | null;
  created_at: Date;
}

export interface CarbonLedgerRow {
  id: string;
  device_id: string | null;
  period_start: Date;
  period_end: Date;
  solar_kwh: string;
  co2_avoided_kg: string;
  credits_earned: string;
  payout_naira: string | null;
  status: CarbonStatus;
  created_at: Date;
}

export interface TradingOfferRow {
  id: string;
  seller_device_id: string | null;
  estate_id: string | null;
  price_per_kwh: string;
  quantity_kwh: string;
  status: TradingStatus;
  created_at: Date;
  expires_at: Date | null;
}

export interface FinancingApplicationRow {
  id: string;
  user_id: string | null;
  system_size_kw: string;
  loan_amount_naira: string;
  term_months: number;
  monthly_payment: string;
  status: FinancingStatus;
  submitted_at: Date;
}

// ---- JWT payload ----

export interface JwtPayload {
  sub: string; // user id
  email: string;
  role: UserRole;
  estateId: string | null;
  iat?: number;
  exp?: number;
}

export interface RefreshPayload {
  sub: string;
  type: 'refresh';
  iat?: number;
  exp?: number;
}

// ---- Service layer types ----

export interface SourceCost {
  source: EnergySource;
  kwh: number;
  cost_naira: number;
}

export interface CostBreakdown {
  total_kwh: number;
  total_cost_naira: number;
  by_source: SourceCost[];
  savings_naira: number; // vs generator-only baseline
  blended_rate_naira_per_kwh: number;
}

export interface DailyCostRecord {
  date: string; // YYYY-MM-DD
  total_kwh: number;
  total_cost_naira: number;
  by_source: Record<EnergySource, number>;
}

export interface HourlyRecord {
  hour: number; // 0-23
  total_kwh: number;
  source: EnergySource | 'mixed';
}

export interface AlertResult {
  alert_type: AlertType;
  message: string;
  impact_naira: number;
  recommendation: string;
}

export interface CarbonSummary {
  solar_kwh: number;
  co2_avoided_kg: number;
  credits_earned: number; // in tonnes
  credit_value_usd: number;
  credit_value_naira: number;
  estimated_payout_naira: number;
  methodology: string;
}

// ---- Request-scoped augmentations ----

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}
