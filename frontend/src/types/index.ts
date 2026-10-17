/* CivicPulse AI — TypeScript Type Definitions */

export interface Report {
  report_id: string;
  created_at: string;
  updated_at: string;
  category: string;
  category_label: string;
  title: string;
  description?: string;
  observed_severity: string;
  observed_at?: string;
  is_safety_risk: boolean;
  nearby_landmark?: string;
  latitude?: number;
  longitude?: number;
  location_accuracy_m?: number;
  location_source: string;
  address?: string;
  has_image: boolean;
  image_url?: string;
  evidence_risk: string;
  duplicate_status: string;
  ai_category?: string;
  ai_severity?: string;
  ai_description?: string;
  ai_confidence?: string;
  ai_analysis_status: string;
  priority_score?: number;
  priority_level?: string;
  status: string;
  assigned_authority?: string;
  rejection_reason?: string;
}

export interface ReportListItem {
  report_id: string;
  created_at: string;
  category: string;
  category_label: string;
  title: string;
  observed_severity: string;
  is_safety_risk: boolean;
  latitude?: number;
  longitude?: number;
  location_source: string;
  has_image: boolean;
  image_url?: string;
  evidence_risk: string;
  priority_score?: number;
  priority_level?: string;
  status: string;
  address?: string;
}

export interface ReportListResponse {
  reports: ReportListItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface EvidenceAssessment {
  file_integrity: string;
  metadata_status: string;
  location_consistency: string;
  duplicate_status: string;
  ai_analysis_status: string;
  evidence_risk: string;
  findings: string[];
  limitations: string[];
  requires_review: boolean;
  exif_timestamp?: string;
  exif_latitude?: number;
  exif_longitude?: number;
  exif_camera?: string;
  location_distance_m?: number;
  perceptual_hash?: string;
  duplicate_of_report_id?: string;
}

export interface StatusHistoryItem {
  changed_at: string;
  from_status?: string;
  to_status: string;
  changed_by?: string;
  reason?: string;
}

export interface TimelineResponse {
  report_id: string;
  current_status: string;
  history: StatusHistoryItem[];
}

export interface DashboardStats {
  total_reports: number;
  reports_by_status: Record<string, number>;
  reports_by_category: Record<string, number>;
  reports_by_priority: Record<string, number>;
  reports_awaiting_review: number;
  average_priority_score?: number;
  sheets_sync_status: string;
  last_sync_at?: string;
}

export interface PublicConfig {
  firebase_configured: boolean;
  firebase_api_key: string;
  firebase_auth_domain: string;
  firebase_project_id: string;
  firebase_messaging_sender_id: string;
  firebase_app_id: string;
  gemini_configured: boolean;
  sheets_configured: boolean;
  email_configured: boolean;
  categories: Record<string, string>;
  max_upload_size_mb: number;
}

export interface HealthResponse {
  status: string;
  version: string;
  environment: string;
  services: Record<string, string>;
}

export interface ImageVerificationResult {
  is_municipal_issue: boolean;
  issue_category: string;
  canonical_category: string;
  category_label: string;
  confidence: number;
  image_quality: string;
  severity: string;
  evidence: string;
  reason: string;
  user_message: string;
  verification_status: 'accepted' | 'unclear' | 'rejected_irrelevant' | 'error' | 'corrupted';
  can_submit: boolean;
  image_sha256: string;
  verification_token: string;
  verified_at: string;
}

export interface ReportFormData {
  category: string;
  title: string;
  description?: string;
  observed_severity: string;
  observed_at?: string;
  is_safety_risk: boolean;
  nearby_landmark?: string;
  latitude?: number;
  longitude?: number;
  location_accuracy_m?: number;
  location_source: string;
  address?: string;
  location_consent: boolean;
  submission_consent: boolean;
  image?: File;
  verification_token?: string;
}

// Category definitions
export const CATEGORIES: Record<string, { label: string; icon: string; description: string }> = {
  drainage_overflow: {
    label: 'Drainage Overflow / Blocked Drains',
    icon: 'Droplets',
    description: 'Overflowing or clogged drainage systems',
  },
  garbage_dumping: {
    label: 'Garbage Dumping',
    icon: 'Trash2',
    description: 'Illegal waste dumping or uncollected garbage',
  },
  pothole_damaged_road: {
    label: 'Potholes & Damaged Roads',
    icon: 'CircleAlert',
    description: 'Road damage, potholes, or broken surfaces',
  },
  waterlogging: {
    label: 'Waterlogging / Stagnant Water',
    icon: 'Waves',
    description: 'Flooded areas or stagnant water accumulation',
  },
  broken_streetlight: {
    label: 'Broken Streetlights',
    icon: 'Lightbulb',
    description: 'Non-functional or damaged street lighting',
  },
  damaged_infrastructure: {
    label: 'Damaged Public Infrastructure',
    icon: 'Construction',
    description: 'Broken benches, fences, signs, or public property',
  },
  sewage_leakage: {
    label: 'Sewage Leakage',
    icon: 'AlertTriangle',
    description: 'Sewage spills or leaking waste pipes',
  },
  other: {
    label: 'Other Civic Problem',
    icon: 'HelpCircle',
    description: 'Any other public issue requiring attention',
  },
};

export const SEVERITY_LEVELS = ['low', 'medium', 'high', 'critical'] as const;

export const STATUS_LABELS: Record<string, string> = {
  submitted: 'Submitted',
  evidence_review: 'Evidence Review',
  under_review: 'Under Review',
  forwarded: 'Forwarded to Authority',
  acknowledged: 'Acknowledged',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  rejected: 'Rejected',
};
