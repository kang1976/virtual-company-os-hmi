// frontend/src/components/kanban/KanbanBoard.tsx
import React, { useState, useMemo } from 'react';
import {
  Kanban,
  Search,
  Filter,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  PlayCircle,
  FileCheck,
  X,
  Copy,
  Check,
  User,
  ShieldAlert,
  Code2,
  Award,
  Layers,
  Sparkles,
  Lock,
} from 'lucide-react';
import type { TaskItem } from '../../types';

export interface KanbanBoardProps {
  tasks: TaskItem[];
  isLoading?: boolean;
  onRefresh?: () => void;
  selectedDeliverableTask?: TaskItem | null;
  onCloseDeliverableModal?: () => void;
}

interface ColumnConfig {
  id: string;
  label: string;
  subLabel: string;
  match: (status: string) => boolean;
  headerBg: string;
  borderColor: string;
  badgeBg: string;
  badgeText: string;
  icon: React.ComponentType<{ className?: string }>;
}

const COLUMNS: ColumnConfig[] = [
  {
    id: 'IDLE',
    label: '대기',
    subLabel: 'IDLE',
    match: (s) => s === 'IDLE',
    headerBg: 'bg-slate-900/80',
    borderColor: 'border-slate-800',
    badgeBg: 'bg-slate-800',
    badgeText: 'text-slate-400',
    icon: Clock,
  },
  {
    id: 'WORKING',
    label: '진행 중',
    subLabel: 'WORKING',
    match: (s) => s === 'WORKING',
    headerBg: 'bg-sky-950/40',
    borderColor: 'border-sky-800/60',
    badgeBg: 'bg-sky-950',
    badgeText: 'text-sky-400',
    icon: PlayCircle,
  },
  {
    id: 'SUBMITTED',
    label: '제출됨',
    subLabel: 'SUBMITTED',
    match: (s) => s === 'SUBMITTED',
    headerBg: 'bg-indigo-950/40',
    borderColor: 'border-indigo-800/60',
    badgeBg: 'bg-indigo-950',
    badgeText: 'text-indigo-400',
    icon: FileCheck,
  },
  {
    id: 'REVIEW',
    label: '심사/검증 중',
    subLabel: 'REVIEW',
    match: (s) => s === 'REVIEW',
    headerBg: 'bg-amber-950/40',
    borderColor: 'border-amber-800/60',
    badgeBg: 'bg-amber-950',
    badgeText: 'text-amber-400',
    icon: AlertTriangle,
  },
  {
    id: 'CLOSED',
    label: '완료/종결',
    subLabel: 'VERIFIED / CLOSED',
    match: (s) => s === 'VERIFIED' || s === 'CLOSED',
    headerBg: 'bg-emerald-950/40',
    borderColor: 'border-emerald-800/60',
    badgeBg: 'bg-emerald-950',
    badgeText: 'text-emerald-400',
    icon: CheckCircle2,
  },
  {
    id: 'BLOCKED',
    label: '차단/반려',
    subLabel: 'BLOCKED',
    match: (s) => s === 'BLOCKED',
    headerBg: 'bg-rose-950/40',
    borderColor: 'border-rose-800/60',
    badgeBg: 'bg-rose-950',
    badgeText: 'text-rose-400',
    icon: AlertCircle,
  },
];

const PRIORITY_STYLES: Record<string, { badge: string; text: string }> = {
  P0: { badge: 'bg-rose-950/80 border-rose-600/70 text-rose-400', text: 'P0 긴급' },
  P1: { badge: 'bg-amber-950/80 border-amber-600/70 text-amber-400', text: 'P1 높음' },
  P2: { badge: 'bg-sky-950/80 border-sky-600/70 text-sky-400', text: 'P2 보통' },
  P3: { badge: 'bg-emerald-950/80 border-emerald-600/70 text-emerald-400', text: 'P3 낮음' },
  P4: { badge: 'bg-slate-900 border-slate-700 text-slate-400', text: 'P4 예비' },
};

function getAssigneeMeta(assignee: string) {
  const norm = (assignee || '').toLowerCase();
  if (norm.includes('patent')) {
    return {
      name: 'PatentSearchAgent',
      role: '특허 Gatekeeper',
      badge: 'bg-purple-950/60 border-purple-800/60 text-purple-300',
      icon: ShieldAlert,
    };
  }
  if (norm.includes('dev') || norm.includes('backend')) {
    return {
      name: 'BackendDevAgent',
      role: '백엔드 회피개발',
      badge: 'bg-sky-950/60 border-sky-800/60 text-sky-300',
      icon: Code2,
    };
  }
  if (norm.includes('security') || norm.includes('보안')) {
    return {
      name: 'SecurityAgent',
      role: '정보보안 심사',
      badge: 'bg-rose-950/60 border-rose-800/60 text-rose-300',
      icon: Lock,
    };
  }
  if (norm.includes('qa')) {
    return {
      name: 'QAAgent',
      role: '독립 품질검수',
      badge: 'bg-emerald-950/60 border-emerald-800/60 text-emerald-300',
      icon: Award,
    };
  }
  if (norm.includes('coo')) {
    return {
      name: 'COOAgent',
      role: '총괄 운영',
      badge: 'bg-amber-950/60 border-amber-800/60 text-amber-300',
      icon: Layers,
    };
  }
  return {
    name: assignee || '미배정',
    role: '자율 에이전트',
    badge: 'bg-slate-800 border-slate-700 text-slate-300',
    icon: User,
  };
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  tasks,
  isLoading = false,
  onRefresh,
  selectedDeliverableTask = null,
  onCloseDeliverableModal,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('ALL');
  const [mobileColumn, setMobileColumn] = useState<string>('ALL');
  const [activeModalTask, setActiveModalTask] = useState<TaskItem | null>(selectedDeliverableTask);
  const [copied, setCopied] = useState(false);

  // Sync external selected deliverable task if provided
  React.useEffect(() => {
    if (selectedDeliverableTask) {
      setActiveModalTask(selectedDeliverableTask);
    }
  }, [selectedDeliverableTask]);

  // Unique assignees
  const uniqueAssignees = useMemo(() => {
    const set = new Set<string>();
    tasks.forEach((t) => {
      if (t.assignee) set.add(t.assignee);
    });
    return Array.from(set);
  }, [tasks]);

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      const matchSearch =
        !searchTerm.trim() ||
        t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.project_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.assignee && t.assignee.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchPriority = priorityFilter === 'ALL' || t.priority === priorityFilter;
      const matchAssignee = assigneeFilter === 'ALL' || t.assignee === assigneeFilter;

      return matchSearch && matchPriority && matchAssignee;
    });
  }, [tasks, searchTerm, priorityFilter, assigneeFilter]);

  const handleCopyDeliverable = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      {/* 헤더 및 컨트롤 필터 바 */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-3 shadow-md backdrop-blur-sm">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
            <Kanban className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-white text-base flex items-center gap-2">
              5단계 검증 태스크 칸반 보드
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-950 text-indigo-400 border border-indigo-800">
                총 {tasks.length}건
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              특허 Gatekeeper 검증 및 독립 QA 품질 승인을 통과한 업무만 최종 종결(CLOSED)됩니다.
            </p>
          </div>
        </div>

        {/* 검색 및 필터 컨트롤 */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-end">
          {/* 검색 입력 */}
          <div className="relative flex-1 sm:w-60 md:w-56">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="업무명, 태스크 ID, 담당자 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* 우선순위 필터 */}
          <div className="flex items-center gap-1 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800 text-xs">
            <Filter className="w-3 h-3 text-slate-500" />
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="bg-transparent text-slate-300 focus:outline-none cursor-pointer text-xs"
            >
              <option value="ALL" className="bg-slate-900 text-slate-200">
                우선순위 전체
              </option>
              <option value="P0" className="bg-slate-900 text-slate-200">P0 긴급</option>
              <option value="P1" className="bg-slate-900 text-slate-200">P1 높음</option>
              <option value="P2" className="bg-slate-900 text-slate-200">P2 보통</option>
              <option value="P3" className="bg-slate-900 text-slate-200">P3 낮음</option>
              <option value="P4" className="bg-slate-900 text-slate-200">P4 예비</option>
            </select>
          </div>

          {/* 담당 에이전트 필터 */}
          {uniqueAssignees.length > 0 && (
            <div className="flex items-center gap-1 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800 text-xs">
              <select
                value={assigneeFilter}
                onChange={(e) => setAssigneeFilter(e.target.value)}
                className="bg-transparent text-slate-300 focus:outline-none cursor-pointer text-xs"
              >
                <option value="ALL" className="bg-slate-900 text-slate-200">
                  담당자 전체
                </option>
                {uniqueAssignees.map((a) => (
                  <option key={a} value={a} className="bg-slate-900 text-slate-200">
                    {a}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 새로고침 버튼 */}
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors disabled:opacity-50"
              title="태스크 목록 새로고침"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-indigo-400' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* 모바일 전용 컬럼 탭 필터 (작은 화면에서만 표시, 가로 스크롤 가능) */}
      <div className="flex md:hidden items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
        <button
          onClick={() => setMobileColumn('ALL')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
            mobileColumn === 'ALL'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-slate-900 text-slate-400 border border-slate-800'
          }`}
        >
          전체 보기 ({filteredTasks.length})
        </button>
        {COLUMNS.map((col) => {
          const count = filteredTasks.filter((t) => col.match(t.status)).length;
          const isActive = mobileColumn === col.id;
          return (
            <button
              key={col.id}
              onClick={() => setMobileColumn(col.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-900 text-slate-400 border border-slate-800'
              }`}
            >
              <span>{col.label}</span>
              <span className="text-[10px] opacity-80 font-mono">({count})</span>
            </button>
          );
        })}
      </div>

      {/* 6컬럼 칸반 보드 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5 items-start">
        {COLUMNS.filter((col) => mobileColumn === 'ALL' || mobileColumn === col.id).map((col) => {
          const colTasks = filteredTasks.filter((t) => col.match(t.status));
          const ColIcon = col.icon;

          return (
            <div
              key={col.id}
              className="bg-slate-900/60 border border-slate-800/90 rounded-xl overflow-hidden flex flex-col min-h-[380px] shadow-sm"
            >
              {/* 컬럼 헤더 */}
              <div className={`px-3 py-2.5 border-b border-slate-800 flex items-center justify-between ${col.headerBg}`}>
                <div className="flex items-center gap-1.5">
                  <ColIcon className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-bold text-xs text-white">{col.label}</span>
                  <span className="text-[10px] text-slate-400 font-mono">({col.subLabel})</span>
                </div>
                <span
                  className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full border ${col.badgeBg} ${col.badgeText} border-current/20`}
                >
                  {colTasks.length}
                </span>
              </div>

              {/* 태스크 카드 목록 컨테이너 */}
              <div className="p-2 flex-1 space-y-2.5 overflow-y-auto max-h-[calc(100vh-320px)] scrollbar-thin">
                {colTasks.length === 0 ? (
                  <div className="h-32 flex flex-col items-center justify-center text-center p-3 border border-dashed border-slate-800/80 rounded-lg text-slate-600 text-xs">
                    <span>태스크 없음</span>
                  </div>
                ) : (
                  colTasks.map((task) => {
                    const assigneeMeta = getAssigneeMeta(task.assignee);
                    const priorityStyle =
                      PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.P2;
                    const AssigneeIcon = assigneeMeta.icon;

                    return (
                      <div
                        key={task.id}
                        onClick={() => setActiveModalTask(task)}
                        className="p-3 bg-slate-950/90 hover:bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-lg shadow transition-all cursor-pointer group relative overflow-hidden"
                      >
                        {/* 카드 상단: ID 및 우선순위 */}
                        <div className="flex items-center justify-between gap-1 mb-1.5">
                          <span className="text-[10px] font-mono text-slate-400 group-hover:text-indigo-400 transition-colors">
                            {task.id}
                          </span>
                          <span
                            className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${priorityStyle.badge}`}
                          >
                            {priorityStyle.text}
                          </span>
                        </div>

                        {/* 카드 본문: 타이틀 */}
                        <h4 className="text-xs font-semibold text-slate-200 group-hover:text-white leading-snug line-clamp-2 mb-2">
                          {task.title}
                        </h4>

                        {/* 프로젝트 ID */}
                        <div className="text-[10px] font-mono text-slate-500 mb-2 truncate">
                          {task.project_id}
                        </div>

                        {/* 카드 하단: 담당자 배지 & 산출물 뱃지 */}
                        <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[10px]">
                          <div
                            className={`flex items-center gap-1 px-1.5 py-0.5 rounded border ${assigneeMeta.badge} truncate max-w-[130px]`}
                            title={`${assigneeMeta.name} (${assigneeMeta.role})`}
                          >
                            <AssigneeIcon className="w-2.5 h-2.5 shrink-0" />
                            <span className="truncate">{assigneeMeta.name}</span>
                          </div>

                          {task.deliverable ? (
                            <span className="text-[9px] font-medium text-emerald-400 bg-emerald-950/60 px-1 py-0.5 rounded border border-emerald-800/60">
                              산출물
                            </span>
                          ) : (
                            <span className="text-[9px] text-slate-500">
                              상세보기
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 태스크 및 산출물 상세 모달 */}
      {activeModalTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* 모달 헤더 */}
            <div className="p-5 border-b border-slate-800 flex items-start justify-between bg-slate-950/60">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs text-sky-400 font-semibold">
                    {activeModalTask.id}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                      (PRIORITY_STYLES[activeModalTask.priority] || PRIORITY_STYLES.P2).badge
                    }`}
                  >
                    {activeModalTask.priority}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
                    상태: {activeModalTask.status}
                  </span>
                </div>
                <h3 className="text-base font-bold text-white leading-snug">
                  {activeModalTask.title}
                </h3>
              </div>
              <button
                onClick={() => {
                  setActiveModalTask(null);
                  onCloseDeliverableModal?.();
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 모달 본문 정보 */}
            <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
              {/* 메타데이터 그리드 */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
                <div>
                  <span className="text-slate-500 block mb-0.5">소속 프로젝트</span>
                  <span className="font-mono text-slate-200 font-medium">{activeModalTask.project_id}</span>
                </div>
                <div>
                  <span className="text-slate-500 block mb-0.5">담당 에이전트</span>
                  <span className="text-slate-200 font-medium">{activeModalTask.assignee}</span>
                </div>
                <div>
                  <span className="text-slate-500 block mb-0.5">검증 단계</span>
                  <span className="text-slate-200 font-medium">
                    {activeModalTask.status === 'VERIFIED' || activeModalTask.status === 'CLOSED'
                      ? '최종 마감 (CLOSED)'
                      : activeModalTask.status}
                  </span>
                </div>
              </div>

              {/* 산출물 내용 영역 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-white flex items-center gap-1.5">
                    <FileCheck className="w-4 h-4 text-emerald-400" />
                    업무 산출물 및 실행 보고서
                  </span>
                  {activeModalTask.deliverable && (
                    <button
                      onClick={() => handleCopyDeliverable(activeModalTask.deliverable || '')}
                      className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] transition-colors"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400 font-medium">복사됨!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>복사하기</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 font-mono text-slate-300 leading-relaxed max-h-72 overflow-y-auto whitespace-pre-wrap selection:bg-indigo-900 selection:text-indigo-200">
                  {activeModalTask.deliverable || (
                    <div className="text-slate-500 italic">
                      산출물이 제출 대기 중이거나 원장(Task Ledger)에 기록된 결과입니다.
                      <br />
                      원장 탐색기(LedgerViewer)에서 전체 검증 이력을 상세 조회할 수 있습니다.
                    </div>
                  )}
                </div>
              </div>

              {/* 검증 가이드 배너 */}
              <div className="p-3 rounded-lg bg-indigo-950/30 border border-indigo-900/60 text-slate-300 flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong className="text-indigo-300 font-semibold block mb-0.5">5단계 검증 프로세스 가이드:</strong>
                  모든 태스크는 선행특허 Gatekeeper의 FTO 리스크 평가를 거쳐 회피 설계를 수행한 후, 독립 QAAgent의 검증을 거쳐 최종 종결 처리됩니다.
                </div>
              </div>
            </div>

            {/* 모달 푸터 */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-end">
              <button
                onClick={() => {
                  setActiveModalTask(null);
                  onCloseDeliverableModal?.();
                }}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
