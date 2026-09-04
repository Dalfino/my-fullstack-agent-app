export const UserRole = {
  TALENT: 'TALENT',
  REVIEWER: 'REVIEWER',
  HR_ADMIN: 'HR_ADMIN',
  DEPT_HEAD: 'DEPT_HEAD',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const ProjectType = {
  FULLSTACK: 'FULLSTACK',
  DATA_ANALYSIS: 'DATA_ANALYSIS',
  ML_MODEL: 'ML_MODEL',
  API: 'API',
  SCRIPT: 'SCRIPT',
  DESIGN: 'DESIGN',
} as const;
export type ProjectType = (typeof ProjectType)[keyof typeof ProjectType];

export const ProjectStatus = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  APPROVED: 'APPROVED',
  ARCHIVED: 'ARCHIVED',
} as const;
export type ProjectStatus = (typeof ProjectStatus)[keyof typeof ProjectStatus];

export const ProjectVisibility = {
  PRIVATE: 'PRIVATE',
  TEAM: 'TEAM',
  DEPT: 'DEPT',
  COMPANY: 'COMPANY',
} as const;
export type ProjectVisibility = (typeof ProjectVisibility)[keyof typeof ProjectVisibility];

export const ReviewType = {
  PEER: 'PEER',
  MENTOR: 'MENTOR',
  AI: 'AI',
} as const;
export type ReviewType = (typeof ReviewType)[keyof typeof ReviewType];

export const ReviewRecommendation = {
  PROMOTE: 'PROMOTE',
  DEVELOP: 'DEVELOP',
  REJECT: 'REJECT',
} as const;
export type ReviewRecommendation = (typeof ReviewRecommendation)[keyof typeof ReviewRecommendation];

export const ReviewStatus = {
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;
export type ReviewStatus = (typeof ReviewStatus)[keyof typeof ReviewStatus];

export const AgentType = {
  EXPLAIN: 'EXPLAIN',
  CODE_ANALYST: 'CODE_ANALYST',
  SECURITY_SCANNER: 'SECURITY_SCANNER',
  REVIEW_EVALUATION: 'REVIEW_EVALUATION',
  CAREER_ADVISOR: 'CAREER_ADVISOR',
  COMPARATIVE_ANALYSIS: 'COMPARATIVE_ANALYSIS',
  SYNTHESIS: 'SYNTHESIS',
} as const;
export type AgentType = (typeof AgentType)[keyof typeof AgentType];

export const SandboxStatus = {
  SPINNING_UP: 'SPINNING_UP',
  RUNNING: 'RUNNING',
  TERMINATED: 'TERMINATED',
} as const;
export type SandboxStatus = (typeof SandboxStatus)[keyof typeof SandboxStatus];

/** Status of an async queue job (AI pipelines, virus scans, ...). */
export const JobStatus = {
  QUEUED: 'QUEUED',
  PROCESSING: 'PROCESSING',
  DONE: 'DONE',
  FAILED: 'FAILED',
} as const;
export type JobStatus = (typeof JobStatus)[keyof typeof JobStatus];

/** Payload types carried by the async queue. */
export const JobType = {
  AI_EXPLAIN: 'AI_EXPLAIN',
  AI_CODE_ANALYST: 'AI_CODE_ANALYST',
  AI_SECURITY_SCANNER: 'AI_SECURITY_SCANNER',
  AI_EVALUATION: 'AI_EVALUATION',
  AI_CAREER_ADVISOR: 'AI_CAREER_ADVISOR',
  VIRUS_SCAN: 'VIRUS_SCAN',
} as const;
export type JobType = (typeof JobType)[keyof typeof JobType];

/** Audit log action taxonomy (Phase 3 admin/compliance). */
export const AuditAction = {
  USER_LOGIN: 'USER_LOGIN',
  USER_LOGIN_FAILED: 'USER_LOGIN_FAILED',
  USER_LOGOUT: 'USER_LOGOUT',
  USER_CREATED: 'USER_CREATED',
  USER_ROLE_CHANGED: 'USER_ROLE_CHANGED',
  USER_MFA_ENABLED: 'USER_MFA_ENABLED',
  USER_MFA_DISABLED: 'USER_MFA_DISABLED',
  PROJECT_CREATED: 'PROJECT_CREATED',
  PROJECT_UPDATED: 'PROJECT_UPDATED',
  PROJECT_SUBMITTED: 'PROJECT_SUBMITTED',
  PROJECT_STATUS_CHANGED: 'PROJECT_STATUS_CHANGED',
  PROJECT_DELETED: 'PROJECT_DELETED',
  FILE_UPLOADED: 'FILE_UPLOADED',
  FILE_DELETED: 'FILE_DELETED',
  FILE_SCAN_FAILED: 'FILE_SCAN_FAILED',
  REVIEW_CREATED: 'REVIEW_CREATED',
  REVIEW_DECIDED: 'REVIEW_DECIDED',
  COMMENT_CREATED: 'COMMENT_CREATED',
  COMMENT_RESOLVED: 'COMMENT_RESOLVED',
  AI_REPORT_REQUESTED: 'AI_REPORT_REQUESTED',
  AI_REPORT_COMPLETED: 'AI_REPORT_COMPLETED',
  AI_REPORT_FAILED: 'AI_REPORT_FAILED',
} as const;
export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];

/** Skill taxonomy used by evaluations and the skill radar. */
export const SkillCategory = {
  FRONTEND: 'FRONTEND',
  BACKEND: 'BACKEND',
  DATABASE: 'DATABASE',
  DEVOPS: 'DEVOPS',
  SECURITY: 'SECURITY',
  TESTING: 'TESTING',
  DATA: 'DATA',
  ARCHITECTURE: 'ARCHITECTURE',
  DOCUMENTATION: 'DOCUMENTATION',
} as const;
export type SkillCategory = (typeof SkillCategory)[keyof typeof SkillCategory];