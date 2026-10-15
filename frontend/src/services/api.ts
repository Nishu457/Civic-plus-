/* CivicPulse AI — API Client */

import axios from 'axios';
import type {
  Report,
  ReportListResponse,
  EvidenceAssessment,
  TimelineResponse,
  DashboardStats,
  PublicConfig,
  HealthResponse,
  ReportFormData,
} from '../types';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach auth token (dev token, Supabase token, or Firebase token) to requests
api.interceptors.request.use(async (config) => {
  const devToken = localStorage.getItem('civicpulse_dev_token');
  if (devToken) {
    config.headers.Authorization = `Bearer ${devToken}`;
    return config;
  }

  // 1. Try Supabase session token
  try {
    const { getSupabaseSession } = await import('./supabase');
    const session = await getSupabaseSession();
    if (session?.access_token) {
      config.headers.Authorization = `Bearer ${session.access_token}`;
      return config;
    }
  } catch (e) {
    // Supabase auth not initialized
  }

  // 2. Try Firebase fallback if configured
  try {
    const { getFirebaseAuth } = await import('./firebase');
    const auth = getFirebaseAuth();
    const user = auth?.currentUser;
    if (user) {
      const token = await user.getIdToken();
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (e) {
    // Auth not available, proceed unauthenticated
  }
  return config;
});

// Friendly error messages for unconfigured or unreachable backends
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response && error.message === 'Network Error') {
      const isVercel = typeof window !== 'undefined' && window.location.hostname.includes('vercel.app');
      if (isVercel && !import.meta.env.VITE_API_BASE_URL) {
        error.message =
          'Backend is not connected. Add VITE_API_BASE_URL in Vercel Project Settings (Environment Variables) pointing to your Render backend URL, then redeploy.';
      } else {
        error.message = 'Backend API is currently unreachable. Please check if the server is running.';
      }
    }
    return Promise.reject(error);
  }
);

// ── System ────────────────────────────────────────────

export const getHealth = () =>
  api.get<HealthResponse>('/health').then((r) => r.data);

export const getPublicConfig = () =>
  api.get<PublicConfig>('/api/v1/config/public').then((r) => r.data);

// ── Reports ───────────────────────────────────────────

export const listReports = (params?: {
  page?: number;
  page_size?: number;
  category?: string;
  status?: string;
  severity?: string;
}) =>
  api.get<ReportListResponse>('/api/v1/reports', { params }).then((r) => r.data);

export const getReport = (reportId: string) =>
  api.get<Report>(`/api/v1/reports/${reportId}`).then((r) => r.data);

export const createReport = async (data: ReportFormData): Promise<Report> => {
  const formData = new FormData();

  // Append all fields
  formData.append('category', data.category);
  formData.append('title', data.title);
  if (data.description) formData.append('description', data.description);
  formData.append('observed_severity', data.observed_severity);
  if (data.observed_at) formData.append('observed_at', data.observed_at);
  formData.append('is_safety_risk', String(data.is_safety_risk));
  if (data.nearby_landmark) formData.append('nearby_landmark', data.nearby_landmark);
  if (data.latitude != null) formData.append('latitude', String(data.latitude));
  if (data.longitude != null) formData.append('longitude', String(data.longitude));
  if (data.location_accuracy_m != null)
    formData.append('location_accuracy_m', String(data.location_accuracy_m));
  formData.append('location_source', data.location_source);
  if (data.address) formData.append('address', data.address);
  formData.append('location_consent', String(data.location_consent));
  formData.append('submission_consent', String(data.submission_consent));
  if (data.image) formData.append('image', data.image);

  const response = await api.post<Report>('/api/v1/reports', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000,
  });
  return response.data;
};

export const getMyReports = (params?: { page?: number; page_size?: number }) =>
  api.get<ReportListResponse>('/api/v1/users/me/reports', { params }).then((r) => r.data);

export const getReportTimeline = (reportId: string) =>
  api.get<TimelineResponse>(`/api/v1/reports/${reportId}/timeline`).then((r) => r.data);

export const getEvidenceAssessment = (reportId: string) =>
  api.get<EvidenceAssessment>(`/api/v1/reports/${reportId}/evidence`).then((r) => r.data);

// ── Admin ─────────────────────────────────────────────

export const getDashboard = () =>
  api.get<DashboardStats>('/api/v1/admin/dashboard').then((r) => r.data);

export const adminListReports = (params?: Record<string, string | number | undefined>) =>
  api.get<ReportListResponse>('/api/v1/admin/reports', { params }).then((r) => r.data);

export const updateReportStatus = (
  reportId: string,
  data: { status: string; reason?: string; assigned_authority?: string }
) => api.post(`/api/v1/admin/reports/${reportId}/status`, data).then((r) => r.data);

export const getSyncStatus = () =>
  api.get('/api/v1/admin/sync-status').then((r) => r.data);

export const triggerSync = () =>
  api.post('/api/v1/admin/sync-reports').then((r) => r.data);

export const getAuditLog = (params?: { page?: number }) =>
  api.get('/api/v1/admin/audit-log', { params }).then((r) => r.data);

export default api;
