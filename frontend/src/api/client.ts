// frontend/src/api/client.ts
import type {
  CommandRequest,
  CommandResponse,
  TaskItem,
  LedgerTree,
  LedgerContent,
  HealthResponse,
} from '../types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    let errorDetail = response.statusText;
    try {
      const errorJson = await response.json();
      if (errorJson.detail) {
        errorDetail = typeof errorJson.detail === 'string' 
          ? errorJson.detail 
          : JSON.stringify(errorJson.detail);
      }
    } catch {
      // JSON 파싱 실패 시 statusText 유지
    }
    throw new ApiError(response.status, `API 요청 실패 [${response.status}]: ${errorDetail}`);
  }

  return response.json() as Promise<T>;
}

/**
 * 서버 상태 점검 (Health Check)
 */
export async function getHealth(): Promise<HealthResponse> {
  return request<HealthResponse>('/api/health');
}

/**
 * CEO 지시 명령 하달
 */
export async function postCommand(command: CommandRequest | string): Promise<CommandResponse> {
  const payload: CommandRequest =
    typeof command === 'string' ? { instruction: command, target_team: '전체' } : command;

  return request<CommandResponse>('/api/commands', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * 전체 태스크 목록 조회
 */
export async function getTasks(): Promise<TaskItem[]> {
  return request<TaskItem[]>('/api/tasks');
}

/**
 * 4대 장부 파일 트리 조회
 */
export async function getLedgerTree(): Promise<LedgerTree> {
  return request<LedgerTree>('/api/ledgers');
}

/**
 * 개별 장부 파일 내용 조회
 */
export async function getLedgerFile(subfolder: string, filename: string): Promise<LedgerContent> {
  const encodedFolder = encodeURIComponent(subfolder);
  const encodedFile = encodeURIComponent(filename);
  return request<LedgerContent>(`/api/ledgers/${encodedFolder}/${encodedFile}`);
}
