// frontend/src/types/index.ts

export type TaskStatus =
  | 'IDLE'        // 대기 (배정 완료)
  | 'WORKING'     // 진행 중 (에이전트 작업 중)
  | 'SUBMITTED'   // 산출물 제출 (1차 완료)
  | 'REVIEW'      // 품질 검수 중 (QA 검증)
  | 'VERIFIED'    // 품질 검증 완료 (QA 통과)
  | 'CLOSED'      // 최종 종결 (COO 승인 마감)
  | 'BLOCKED';    // 차단/CEO 결정 대기 (특허 위험 등)

export type Priority = 'P0' | 'P1' | 'P2' | 'P3' | 'P4';

export interface TaskItem {
  id: string;
  project_id: string;
  title: string;
  assignee: string;
  priority: Priority | string;
  status: TaskStatus | string;
  deliverable?: string | null;
}

export interface ProjectItem {
  id: string;
  title: string;
  description?: string;
  created_at?: string;
}

export interface CommandRequest {
  instruction: string;
  target_team?: string;
}

export interface CommandItem {
  id: string;
  project_id: string;
  sender: string;
  recipient: string;
  instruction: string;
  priority: Priority | string;
  status: string;
  created_at?: string;
}

export interface CommandResponse {
  status: string;
  project_id: string;
  command_id: string;
  completed_tasks?: TaskItem[];
  summary?: string;
  coo_audit?: COOFinalApprovalData;
}

export interface LedgerTree {
  PROJECTS: string[];
  COMMAND_LOG: string[];
  TASK_LEDGER: string[];
  MEETING_LOG: string[];
  KNOWLEDGE_PATENT: string[];
  [key: string]: string[];
}

export interface LedgerContent {
  content: string;
}

export interface HealthResponse {
  status: string;
  system: string;
}

export type WebSocketEventType =
  | 'COMMAND_CREATED'
  | 'TASK_UPDATED'
  | 'AGENT_LOG'
  | 'LEDGER_SYNCED'
  | 'ALERT_TRIGGERED'
  | string;

export interface WebSocketEvent<T = any> {
  event: WebSocketEventType;
  data: T;
}

export interface AgentLogData {
  agent: string;
  message: string;
  timestamp?: string;
  level?: 'INFO' | 'WARN' | 'ERROR';
}

export interface AlertData {
  id: string;
  title: string;
  message: string;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  requires_decision?: boolean;
  data?: any;
}

export interface AgentInfo {
  id: string;
  name: string;
  role: string;
  team: string;
  status: 'IDLE' | 'WORKING' | 'REVIEW' | 'BLOCKED';
  currentTask?: string;
}

export interface SecurityAuditData {
  passed: boolean;
  security_score: number;
  vulnerabilities: string[];
  cve_risk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | string;
  recommendations: string;
}

export interface FrontendAuditData {
  component_name: string;
  design_system: string;
  responsive_layout: string;
  deliverable: string;
  accessibility_audit: string;
}

export interface COOFinalApprovalData {
  approved: boolean;
  executive_summary: string;
  checked_items: string[];
  directive_feedback: string;
}

