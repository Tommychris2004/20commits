import { getAuth, clearAuth } from '../store/index.ts';

const BASE = (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL ?? '';

class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const { accessToken } = getAuth();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string>),
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const res = await fetch(`${BASE}${path}`, { ...init, headers });

  if (res.status === 401) {
    clearAuth();
    window.location.href = '/login';
    throw new ApiError(401, 'UNAUTHORIZED', 'Session expired');
  }

  if (!res.ok) {
    let body: { error?: { code?: string; message?: string } } = {};
    try {
      body = await res.json();
    } catch {}
    throw new ApiError(
      res.status,
      body.error?.code ?? 'UNKNOWN',
      body.error?.message ?? `HTTP ${res.status}`,
    );
  }

  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

export { ApiError };

// ---- Typed API methods ----

export interface EnergyResponse {
  has_device: boolean;
  current_power_kw?: number;
  today?: {
    total_kwh: number;
    total_cost_naira: number;
    by_source: Array<{ source: string; kwh: number; cost_naira: number }>;
    savings_naira: number;
    blended_rate_naira_per_kwh: number;
  };
  projected_monthly_cost_naira?: number;
  device?: { id: string; node_id: string; name: string; status: string; last_seen: string };
}

export interface HistoryResponse {
  has_device: boolean;
  weekly: Array<{ date: string; total_kwh: number; total_cost_naira: number; by_source: Record<string, number> }>;
  hourly: Array<{ hour: number; total_kwh: number; is_peak: boolean }>;
  week_comparison: { this_week_cost_naira: number; last_week_cost_naira: number; change_pct: number; direction: string } | null;
}

export interface Alert {
  alert_type: string;
  message: string;
  impact_naira: number;
  recommendation: string;
}

export interface CarbonResponse {
  has_device: boolean;
  this_month?: {
    solar_kwh: number;
    co2_avoided_kg: number;
    credits_earned: number;
    credit_value_naira: number;
    estimated_payout_naira: number;
  };
  all_time?: { solar_kwh: number; co2_avoided_kg: number; credits_earned: number };
  impact?: { trees_equivalent: number; car_km_equivalent: number; flight_pct_lagos_london: number; co2_weight_kg: number };
  next_payout?: { date: string; estimated_naira: number };
  pool_progress?: { current_tonnes: number; target_tonnes: number; pct: number };
  disclaimer?: string;
}

export interface EstateResponse {
  has_estate: boolean;
  estate?: { id: string; name: string; location: string; state: string };
  nodes?: { total: number; online: number; offline: number; not_connected: number; connected_capacity_kw: number };
  collective_savings_naira_month?: number;
  devices?: Array<{ id: string; node_id: string; name: string; status: string; last_seen: string; user_name: string }>;
}

export const energyApi = {
  getCurrent: () => api.get<EnergyResponse>('/api/me/energy'),
  getHistory: () => api.get<HistoryResponse>('/api/me/history'),
  getAlerts: () => api.get<{ alerts: Alert[] }>('/api/me/alerts'),
};

export const carbonApi = {
  getSummary: () => api.get<CarbonResponse>('/api/me/carbon'),
  getLedger: () => api.get<{ ledger: unknown[] }>('/api/me/carbon/ledger'),
};

export const estateApi = {
  getEstate: () => api.get<EstateResponse>('/api/estate'),
  getLeaderboard: () => api.get<{ leaderboard: unknown[] }>('/api/estate/network'),
};

export const authApi = {
  login: (email: string, password: string) =>
    api.post<{ access_token: string; user: { id: string; email: string; name: string; role: string; estate_id: string | null } }>(
      '/api/auth/login',
      { email, password },
    ),
  register: (data: { email: string; password: string; name: string; estate_id?: string }) =>
    api.post<{ access_token: string; user: { id: string; email: string; name: string; role: string; estate_id: string | null } }>(
      '/api/auth/register',
      data,
    ),
};

export const devicesApi = {
  register: (node_id: string, name?: string) =>
    api.post<{ device: unknown }>('/api/devices/register', { node_id, name }),
  getAll: () => api.get<{ devices: unknown[] }>('/api/devices'),
};

export interface TradeOffer {
  id: string;
  seller_label: string;
  price_per_kwh: number;
  quantity_kwh: number;
  status: string;
  is_mine: boolean;
  created_at: string;
  expires_at: string | null;
}

export interface Trade {
  id: string;
  side: 'buy' | 'sell';
  seller_label: string;
  quantity_kwh: number;
  price_per_kwh: number;
  gross_naira: number;
  seller_naira: number;
  status: string;
  traded_at: string;
}

export interface TradingMarketResponse {
  offers: TradeOffer[];
  my_offers: TradeOffer[];
  monthly_earnings_naira: number;
  commission_rate_pct: number;
}

export const tradingApi = {
  getOffers: () => api.get<TradingMarketResponse>('/api/trading/offers'),
  createOffer: (price_per_kwh: number, quantity_kwh: number) =>
    api.post<{ offer: TradeOffer }>('/api/trading/offers', { price_per_kwh, quantity_kwh }),
  updateOffer: (id: string, data: Partial<{ price_per_kwh: number; quantity_kwh: number; status: string }>) =>
    api.patch<{ status: string }>(`/api/trading/offers/${id}`, data),
  buyOffer: (id: string, quantity_kwh: number) =>
    api.post<{ summary: { quantity_kwh: number; gross_naira: number; commission_naira: number; message: string } }>(
      `/api/trading/offers/${id}/buy`,
      { quantity_kwh },
    ),
  getHistory: () => api.get<{ trades: Trade[] }>('/api/trading/history'),
};
