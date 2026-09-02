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