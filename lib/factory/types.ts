export const FACTORY_PROJECT_ID = "sitesinc-growth-case-study";

export type StageStatus =
  | "not_started"
  | "in_progress"
  | "blocked"
  | "ready_for_review"
  | "approved"
  | "complete";

export type StageKey =
  | "research"
  | "blueprint"
  | "content_briefs"
  | "content_drafting"
  | "human_approval"
  | "technical_seo"
  | "staging_build"
  | "production_deployment"
  | "indexing_submission"
  | "backlink_authority"
  | "monitoring_reporting";

export type IndexingState =
  | "not_submitted"
  | "submitted"
  | "discovered"
  | "crawled"
  | "indexed"
  | "excluded_error";

export type BriefStatus = "draft" | "ready_for_review" | "approved" | "rejected";

export type PageStatus =
  | "planned"
  | "brief_required"
  | "drafting"
  | "ready_for_review"
  | "approved"
  | "staged"
  | "published"
  | "rolled_back";

export type BacklinkStatus = "active" | "lost" | "pending";

export type ConversionSeverity = "ok" | "warning" | "launch_blocking";

export type FactoryStage = {
  key: StageKey;
  order: number;
  name: string;
  status: StageStatus;
  requiredInputs: string[];
  artifacts: string[];
  operatorApproval: boolean;
  approvedBy: string;
  approvedAt: string;
  completedAt: string;
  notes: string;
};

export type HeadingMap = {
  h1: string[];
  h2: string[];
  h3: string[];
};

export type PageAudit = {
  url: string;
  path: string;
  statusCode: number | null;
  title: string;
  metaDescription: string;
  canonical: string;
  robots: string;
  wordCount: number;
  headings: HeadingMap;
  schemaTypes: string[];
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  images: { src: string; alt: string }[];
  missingAlt: number;
  internalLinks: string[];
  externalLinks: string[];
  forms: { action: string; method: string; fields: string[] }[];
  ttfbMs: number | null;
  bytes: number | null;
  error: string;
};

export type BrokenLink = {
  from: string;
  href: string;
  status: number | null;
  error: string;
};

export type BaselineSnapshot = {
  id: string;
  projectId: string;
  capturedAt: string;
  origin: string;
  source: "live_production" | "local" | "manual";
  pageInventory: PageAudit[];
  robotsTxt: { url: string; ok: boolean; body: string; error: string };
  sitemap: { url: string; ok: boolean; urls: string[]; error: string };
  canonicalSummary: { path: string; canonical: string; matches: boolean }[];
  internalLinkSummary: { uniqueTargets: number; total: number };
  brokenLinks: BrokenLink[];
  performance: {
    method: string;
    pagesTimed: number;
    avgTtfbMs: number | null;
    lighthouse: "not_run";
    note: string;
  };
  indexing: {
    configured: boolean;
    source: string;
    lastChecked: string;
    note: string;
  };
  analytics: {
    configured: boolean;
    source: string;
    lastChecked: string;
    note: string;
  };
  intakeFormHealth: {
    checklistEndpoint: ConversionSeverity;
    inquiryEndpoint: ConversionSeverity;
    storeWritable: boolean;
    smtpConfigured: boolean;
    notes: string[];
    launchBlocking: boolean;
  };
  screenshots: ScreenshotRef[];
  secretsRedacted: true;
};

export type ScreenshotRef = {
  id: string;
  viewport: "desktop" | "mobile";
  label: string;
  url: string;
  uploadedAt: string;
};

export type TopicCluster = {
  id: string;
  topic: string;
  intent: string;
  hubPath: string;
  supporting: string[];
  notes: string;
};

export type BlueprintPage = {
  slug: string;
  path: string;
  title: string;
  purpose: string;
  clusterId: string;
  existing: boolean;
  thinDoorwayRisk: "none" | "watched";
};

export type ContentBrief = {
  id: string;
  slug: string;
  title: string;
  status: BriefStatus;
  searchIntent: string;
  competitorUrls: string[];
  wordCountGuidance: { min: number; max: number; note: string };
  headings: string[];
  recurringTopics: string[];
  gaps: string[];
  outline: string[];
  citations: string[];
  notes: string;
  approvedBy: string;
  approvedAt: string;
};

export type FactoryPage = {
  slug: string;
  path: string;
  title: string;
  metaDescription: string;
  status: PageStatus;
  briefId: string;
  wordCount: number;
  headings: string[];
  body: string;
  noindex: boolean;
  approvedBy: string;
  approvedAt: string;
  publishedAt: string;
};

export type IndexingRecord = {
  path: string;
  url: string;
  state: IndexingState;
  lastChecked: string;
  source: string;
  notes: string;
};

export type BacklinkRecord = {
  id: string;
  referringDomain: string;
  destinationUrl: string;
  anchor: string;
  relevance: string;
  qualityNotes: string;
  acquisitionMethod: string;
  discoveredDate: string;
  status: BacklinkStatus;
};

export type ConversionCheck = {
  id: string;
  label: string;
  severity: ConversionSeverity;
  ok: boolean;
  detail: string;
  lastRun: string;
};

export type ConversionEvent = {
  id: string;
  type:
    | "cta_click"
    | "intake_start"
    | "intake_success"
    | "email_notification"
    | "internal_project"
    | "mobile_complete";
  path: string;
  createdAt: string;
  meta: string;
};

export type DeploymentRecord = {
  id: string;
  environment: "staging" | "production" | "rollback";
  createdAt: string;
  approvedBy: string;
  notes: string;
  snapshot: {
    pageSlugs: string[];
    productionLive: boolean;
  };
};

export type FactoryProject = {
  id: string;
  name: string;
  internal: true;
  brand: string;
  productionUrl: string;
  stagingPath: string;
  productionProtected: true;
  createdAt: string;
  notes: string;
};

export type PreflightReport = {
  generatedAt: string;
  stagingNoindex: boolean;
  productionProtected: true;
  items: {
    area: string;
    status: "pass" | "watch" | "fail";
    detail: string;
  }[];
};

export type StudyCheckpoint = {
  day: 0 | 30 | 60 | 90;
  label: string;
  dueDate: string;
  status: "scheduled" | "complete" | "missed";
  capturedAt: string;
  notes: string;
  evidence: string[];
};

export type IntakeProject = {
  id: string;
  source: "inquiry" | "subscribe" | "factory_intake";
  createdAt: string;
  label: string;
  factoryProjectId: string;
  leadId?: string;
  monitoringInterest?: boolean;
};

export type VisibleGap = {
  id: string;
  area: string;
  owner: "operator" | "google" | "system";
  status: "open" | "blocked" | "done";
  detail: string;
};

export type FactoryWorkspace = {
  project: FactoryProject;
  stages: FactoryStage[];
  clusters: TopicCluster[];
  blueprint: BlueprintPage[];
  briefs: ContentBrief[];
  pages: FactoryPage[];
  indexing: IndexingRecord[];
  backlinks: BacklinkRecord[];
  conversions: {
    lastRun: string;
    checks: ConversionCheck[];
    events: ConversionEvent[];
    launchBlocking: boolean;
  };
  deployments: DeploymentRecord[];
  screenshots: ScreenshotRef[];
  intakeProjects: IntakeProject[];
  study: {
    startedAt: string;
    horizonDays: 90;
    checkpoints: StudyCheckpoint[];
  };
  visibleGaps: VisibleGap[];
  latestBaselineId: string;
  productionLive: boolean;
  rollbackOf: string;
  productionRelease: {
    selected: string[];
    approvedBy: string;
    approvedAt: string;
    notes: string;
    homepageReplaced: false;
  };
};
