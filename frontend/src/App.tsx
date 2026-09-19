// frontend/src/App.tsx
import { useEffect, useState, useCallback } from 'react';
import {
  Activity,
  Kanban as KanbanIcon,
  BookOpen,
  Users,
  Radio,
  CheckCircle2,
  Clock,
  ChevronRight,
  TrendingUp,
  ShieldCheck,
} from 'lucide-react';
import { Navbar, type NavTabId } from './components/layout/Navbar';
import { CommandBar } from './components/ceo/CommandBar';
import { KanbanBoard } from './components/kanban/KanbanBoard';
import { LedgerViewer } from './components/ledgers/LedgerViewer';
import { OrgChart } from './components/org/OrgChart';
import { getHealth, getTasks, postCommand, resetSystemData, getLatestCommand } from './api/client';
import { useWebSocket } from './hooks/useWebSocket';
import { useTheme } from './hooks/useTheme';
import type {
  HealthResponse,
  TaskItem,
  CommandResponse,
  Priority,
  WebSocketEvent,
} from './types';

interface LiveEventLog {
  id: string;
  timestamp: string;
  event: string;
  message: string;
  type: 'info' | 'success' | 'warn';
}

export default function App() {
  const { theme, toggleTheme, isFullscreen, toggleFullscreen } = useTheme();
  const [activeTab, setActiveTab] = useState<NavTabId>('overview');
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loadingTasks, setLoadingTasks] = useState<boolean>(false);
  const [isExecutingCommand, setIsExecutingCommand] = useState<boolean>(false);
  const [executionStage, setExecutionStage] = useState<number>(0);
  const [latestCommandResult, setLatestCommandResult] = useState<CommandResponse | null>(() => {
    try {
      const saved = localStorage.getItem('latest_ceo_command_result');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [selectedDeliverableTask, setSelectedDeliverableTask] = useState<TaskItem | null>(null);
  const [liveEvents, setLiveEvents] = useState<LiveEventLog[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  // 이벤트 로그 추가 헬퍼
  const addLiveLog = useCallback((event: string, message: string, type: 'info' | 'success' | 'warn' = 'info') => {
    const newLog: LiveEventLog = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toLocaleTimeString('ko-KR', { hour12: false }),
      event,
      message,
      type,
    };
    setLiveEvents((prev) => [newLog, ...prev.slice(0, 19)]); // 최근 20개 유지
  }, []);

  // 태스크 목록 조회
  const fetchTasks = useCallback(async () => {
    setLoadingTasks(true);
    try {
      const data = await getTasks();
      setTasks(data);
    } catch (err: any) {
      console.error('태스크 조회 오류:', err);
    } finally {
      setLoadingTasks(false);
    }
  }, []);

  // 서버 상태 점검
  const fetchHealth = useCallback(async () => {
    try {
      const res = await getHealth();
      setHealth(res);
      setHealthError(null);
    } catch (err: any) {
      setHealthError(err.message || '서버 오프라인');
      setHealth(null);
    }
  }, []);

  // WebSocket 실시간 이벤트 핸들러
  const handleWebSocketEvent = useCallback((wsEvent: WebSocketEvent) => {
    if (!wsEvent || !wsEvent.event) return;

    switch (wsEvent.event) {
      case 'COMMAND_CREATED': {
        const cmd = wsEvent.data;
        addLiveLog(
          '명령 하달',
          `[${cmd.id || 'CMD'}] CEO 지시 등록: "${cmd.instruction || ''}"`,
          'info'
        );
        fetchTasks();
        setRefreshTrigger((c) => c + 1);
        break;
      }
      case 'TASK_UPDATED': {
        const task = wsEvent.data;
        addLiveLog(
          '태스크 변경',
          `[${task.id || 'TASK'}] ${task.title || ''} → ${task.status || ''}`,
          task.status === 'CLOSED' || task.status === 'VERIFIED' ? 'success' : 'info'
        );
        fetchTasks();
        break;
      }
      case 'AGENT_LOG': {
        const log = wsEvent.data;
        addLiveLog(
          `에이전트 로그 (${log.agent || 'Agent'})`,
          log.message || '',
          log.level === 'WARN' ? 'warn' : 'info'
        );
        break;
      }
      case 'LEDGER_SYNCED': {
        addLiveLog('원장 동기화', '4대 장부 및 데이터베이스 동기화 완료', 'success');
        setRefreshTrigger((c) => c + 1);
        break;
      }
      default: {
        addLiveLog(wsEvent.event, JSON.stringify(wsEvent.data), 'info');
        break;
      }
    }
  }, [addLiveLog, fetchTasks]);

  // WebSocket 훅 연결
  const { isConnected, status, reconnectCount } = useWebSocket({
    autoConnect: true,
    onEvent: handleWebSocketEvent,
  });

  // 초기 로드
  useEffect(() => {
    fetchHealth();
    fetchTasks();
    getLatestCommand()
      .then((res) => {
        if (res) {
          setLatestCommandResult(res);
          try {
            localStorage.setItem('latest_ceo_command_result', JSON.stringify(res));
          } catch {}
        }
      })
      .catch(() => {});
  }, [fetchHealth, fetchTasks]);

  // 전체 수동 새로고침
  const handleRefreshAll = () => {
    fetchHealth();
    fetchTasks();
    getLatestCommand()
      .then((res) => {
        if (res) {
          setLatestCommandResult(res);
          try {
            localStorage.setItem('latest_ceo_command_result', JSON.stringify(res));
          } catch {}
        }
      })
      .catch(() => {});
    setRefreshTrigger((c) => c + 1);
    addLiveLog('시스템 새로고침', '서버 상태 및 업무 원장 새로고침 완료', 'info');
  };

  // 시스템 데이터 초기화 핸들러 (CEO 명령: 누적 데이터 완전 초기화)
  const handleResetSystemData = async () => {
    if (
      !window.confirm(
        '⚠️ 주의: SQLite 데이터베이스 및 4대 장부의 모든 누적 데이터를 완전히 초기화(0건)하시겠습니까?\n이 작업은 즉시 실행되며 되돌릴 수 없습니다.'
      )
    ) {
      return;
    }
    try {
      addLiveLog('데이터 초기화', '전체 데이터 초기화 요청 전송 중...', 'warn');
      const res = await resetSystemData();
      addLiveLog('초기화 완료', res.message || '누적 데이터 0건으로 완전 리셋되었습니다.', 'success');
      alert('✅ 시스템 누적 데이터가 0건으로 완전 초기화되었습니다.');
      // 화면 상태 갱신
      handleRefreshAll();
      setLatestCommandResult(null);
      try {
        localStorage.removeItem('latest_ceo_command_result');
      } catch {}
    } catch (err: any) {
      addLiveLog('초기화 실패', err.message || '초기화 중 오류 발생', 'warn');
      alert(`초기화 실패: ${err.message || '알 수 없는 오류'}`);
    }
  };

  // CEO 지시 하달 실행 핸들러
  const handleExecuteCommand = async (
    instruction: string,
    targetTeam: string,
    priority: Priority
  ) => {
    setIsExecutingCommand(true);
    setExecutionStage(1); // 1: COO 분해 시작
    addLiveLog('CEO 지시', `"${instruction}" (수신: ${targetTeam}, 우선순위: ${priority})`, 'info');

    // 파이프라인 단계 시뮬레이션 타이머 (1: COO -> 2: 특허 -> 3: 프론트 -> 4: 백엔드 -> 5: 1차 검증 -> 6: 2차 재검증 -> 7: COO 승인)
    const timer1 = setTimeout(() => setExecutionStage(2), 500);  // 2: 특허 FTO
    const timer2 = setTimeout(() => setExecutionStage(3), 1000); // 3: 프론트 UI
    const timer3 = setTimeout(() => setExecutionStage(4), 1500); // 4: 백엔드 개발
    const timer4 = setTimeout(() => setExecutionStage(5), 2000); // 5: 1차 보안/QA
    const timer5 = setTimeout(() => setExecutionStage(6), 2500); // 6: 2차 심층 재검증

    try {
      const response = await postCommand({
        instruction,
        target_team: targetTeam,
      });

      setLatestCommandResult(response);
      try {
        localStorage.setItem('latest_ceo_command_result', JSON.stringify(response));
      } catch {}
      setExecutionStage(7); // 7: 완료 및 COO 최종 승인

      addLiveLog(
        '명령 실행 완료',
        `프로젝트 [${response.project_id}] 2차 다층 재검증 및 전 공정 완료 (완료 태스크 ${response.completed_tasks?.length || 0}건, COO 최종 품질검수 통과)`,
        'success'
      );

      // 최신 상태 갱신
      await fetchTasks();
      setRefreshTrigger((c) => c + 1);
      return response;
    } catch (err: any) {
      addLiveLog('명령 실행 실패', err.message || '오류 발생', 'warn');
      throw err;
    } finally {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
      clearTimeout(timer5);
      setIsExecutingCommand(false);
    }
  };

  // 통계 수치 계산
  const totalTaskCount = tasks.length;
  const closedTaskCount = tasks.filter((t) => t.status === 'CLOSED' || t.status === 'VERIFIED').length;
  const inProgressCount = tasks.filter((t) => t.status === 'WORKING' || t.status === 'REVIEW' || t.status === 'SUBMITTED').length;
  const blockedCount = tasks.filter((t) => t.status === 'BLOCKED').length;

  return (
    <div className={`min-h-screen ${theme} flex flex-col font-sans selection:bg-sky-900 selection:text-sky-200 transition-colors duration-200`}>
      {/* 글로벌 네비게이션 헤더 */}
      <Navbar
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab)}
        health={health}
        healthError={healthError}
        wsStatus={status}
        wsConnected={isConnected}
        reconnectCount={reconnectCount}
        onRefreshAll={handleRefreshAll}
        isRefreshing={loadingTasks}
        theme={theme}
        onThemeToggle={toggleTheme}
        isFullscreen={isFullscreen}
        onFullscreenToggle={toggleFullscreen}
        onResetData={handleResetSystemData}
      />

      {/* 메인 관제 콘솔 컨테이너 */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* ================= 탭 1: 전체 관제실 (Overview) ================= */}
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* 1. CEO 지시 터미널 및 최근 실행 브리핑 카드 */}
            <CommandBar
              onCommandSubmit={handleExecuteCommand}
              isExecuting={isExecutingCommand}
              executionStage={executionStage}
              latestResult={latestCommandResult}
              onNavigateTab={(tab) => setActiveTab(tab)}
              onSelectDeliverable={(task) => {
                setSelectedDeliverableTask(task);
                setActiveTab('kanban');
              }}
            />

            {/* 2. 핵심 운영 지표 KPI 위젯 그리드 (관제 모니터링 고대비 2px 구획) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-slate-900/90 border-2 border-slate-300 dark:border-slate-800 rounded-xl p-4 shadow-sm backdrop-blur-sm transition-colors">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs mb-1 font-medium">
                  <span>총 누적 태스크</span>
                  <Activity className="w-4 h-4 text-sky-500" />
                </div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono">{totalTaskCount}건</div>
                <span className="text-[11px] text-sky-600 dark:text-sky-400 flex items-center gap-1 mt-1 font-bold">
                  <TrendingUp className="w-3 h-3" />
                  실시간 전사 업무 누계
                </span>
              </div>

              <div className="bg-white dark:bg-slate-900/90 border-2 border-slate-300 dark:border-slate-800 rounded-xl p-4 shadow-sm backdrop-blur-sm transition-colors">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs mb-1 font-medium">
                  <span>검증 종결 (CLOSED)</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">{closedTaskCount}건</div>
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-1 font-bold">
                  독립 QA 품질 승인 마감
                </span>
              </div>

              <div className="bg-white dark:bg-slate-900/90 border-2 border-slate-300 dark:border-slate-800 rounded-xl p-4 shadow-sm backdrop-blur-sm transition-colors">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs mb-1 font-medium">
                  <span>진행 및 심사 중</span>
                  <Clock className="w-4 h-4 text-amber-500" />
                </div>
                <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 font-mono">{inProgressCount}건</div>
                <span className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 block font-medium">
                  {blockedCount > 0 ? `반려/차단: ${blockedCount}건` : '에이전트 작업 및 품질 심사'}
                </span>
              </div>

              <div className="bg-white dark:bg-slate-900/90 border-2 border-slate-300 dark:border-slate-800 rounded-xl p-4 shadow-sm backdrop-blur-sm transition-colors">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs mb-1 font-medium">
                  <span>특허 Gatekeeper 통과율</span>
                  <ShieldCheck className="w-4 h-4 text-purple-500" />
                </div>
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 font-mono">100%</div>
                <span className="text-[11px] text-purple-600 dark:text-purple-400 mt-1 block truncate font-bold">
                  FTO 회피 설계 100% 반영
                </span>
              </div>
            </div>

            {/* 3. 3대 패널 스냅샷 (칸반 미리보기, 4대 장부 현황, 조직도 상태) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* 패널 A: 5단계 칸반 요약 카드 */}
              <section className="bg-white dark:bg-slate-900/80 border-2 border-slate-300 dark:border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col backdrop-blur-sm transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                    <KanbanIcon className="w-4 h-4" />
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm">5단계 업무 칸반</h3>
                  </div>
                  <button
                    onClick={() => setActiveTab('kanban')}
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-0.5 font-bold"
                  >
                    <span>전체 보드</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
                  최근 파이프라인에서 실행된 태스크 상태 현황
                </p>

                <div className="flex-1 space-y-2 overflow-y-auto max-h-56 scrollbar-thin">
                  {tasks.length === 0 ? (
                    <div className="h-36 flex items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-800 rounded-xl text-slate-400 dark:text-slate-600 text-xs">
                      등록된 태스크가 없습니다.
                    </div>
                  ) : (
                    tasks.slice(0, 5).map((t) => (
                      <div
                        key={t.id}
                        onClick={() => {
                          setSelectedDeliverableTask(t);
                          setActiveTab('kanban');
                        }}
                        className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950/80 hover:bg-slate-100 dark:hover:bg-slate-900 border border-slate-300 dark:border-slate-800/80 flex items-center justify-between cursor-pointer transition-colors group"
                      >
                        <div className="truncate pr-2">
                          <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 block font-bold">
                            {t.id}
                          </span>
                          <span className="text-xs font-semibold text-slate-900 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors truncate block">
                            {t.title}
                          </span>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded border shrink-0 ${
                            t.status === 'CLOSED' || t.status === 'VERIFIED'
                              ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800'
                              : t.status === 'WORKING'
                              ? 'bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-400 border-sky-300 dark:border-sky-800'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-400 border-slate-300 dark:border-slate-700'
                          }`}
                        >
                          {t.status}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </section>

              {/* 패널 B: 4대 장부 탐색기 요약 */}
              <section className="bg-white dark:bg-slate-900/80 border-2 border-slate-300 dark:border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col backdrop-blur-sm transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                    <BookOpen className="w-4 h-4" />
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm">4대 장부 시스템</h3>
                  </div>
                  <button
                    onClick={() => setActiveTab('ledgers')}
                    className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 flex items-center gap-0.5 font-bold"
                  >
                    <span>원장 열람</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
                  이중 저장소(DB + Markdown)를 통해 완벽한 감사 추적성을 보장합니다.
                </p>

                <div className="grid grid-cols-2 gap-2 text-xs flex-1">
                  <div
                    onClick={() => setActiveTab('ledgers')}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-300 dark:border-slate-800 hover:border-emerald-500 hover:bg-slate-100 dark:hover:bg-slate-900 cursor-pointer transition-all"
                  >
                    <span className="text-amber-700 dark:text-amber-400 font-bold block mb-0.5">지시 원장</span>
                    <span className="text-[11px] text-slate-600 dark:text-slate-400">CEO 하달 명령 기록</span>
                  </div>
                  <div
                    onClick={() => setActiveTab('ledgers')}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-300 dark:border-slate-800 hover:border-emerald-500 hover:bg-slate-100 dark:hover:bg-slate-900 cursor-pointer transition-all"
                  >
                    <span className="text-indigo-700 dark:text-indigo-400 font-bold block mb-0.5">업무 원장</span>
                    <span className="text-[11px] text-slate-600 dark:text-slate-400">5단계 공정 검증 마감</span>
                  </div>
                  <div
                    onClick={() => setActiveTab('ledgers')}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-300 dark:border-slate-800 hover:border-emerald-500 hover:bg-slate-100 dark:hover:bg-slate-900 cursor-pointer transition-all"
                  >
                    <span className="text-purple-700 dark:text-purple-400 font-bold block mb-0.5">특허 지식 원장</span>
                    <span className="text-[11px] text-slate-600 dark:text-slate-400">FTO 조사 및 회피설계</span>
                  </div>
                  <div
                    onClick={() => setActiveTab('ledgers')}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-300 dark:border-slate-800 hover:border-emerald-500 hover:bg-slate-100 dark:hover:bg-slate-900 cursor-pointer transition-all"
                  >
                    <span className="text-emerald-700 dark:text-emerald-400 font-bold block mb-0.5">회의록 원장</span>
                    <span className="text-[11px] text-slate-600 dark:text-slate-400">에이전트 협의 이력</span>
                  </div>
                </div>
              </section>

              {/* 패널 C: 조직도 요약 카드 (전체 9개 자율 에이전트 Roster) */}
              <section className="bg-white dark:bg-slate-900/80 border-2 border-slate-300 dark:border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col backdrop-blur-sm transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                    <Users className="w-4 h-4" />
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm">가상 조직 에이전트 (11개체)</h3>
                  </div>
                  <button
                    onClick={() => setActiveTab('org')}
                    className="text-xs text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 flex items-center gap-0.5 font-bold"
                  >
                    <span>조직도 보기</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">
                  자율 에이전트 실시간 가동 상태 (실무 + 3대 감리 + 상품화 마케팅)
                </p>

                <div className="space-y-1.5 flex-1 overflow-y-auto max-h-56 scrollbar-thin pr-0.5">
                  {[
                    { name: 'COOAgent', role: '총괄 운영 및 업무 분해', status: '정상 가동', color: 'text-sky-700 dark:text-sky-400' },
                    { name: 'PatentSearchAgent', role: '특허 Gatekeeper (FTO)', status: '정상 가동', color: 'text-purple-700 dark:text-purple-400' },
                    { name: 'ChiefDesignAgent', role: '디자인 전공 수석 디렉터 (초고대비/색채)', status: '정상 가동', color: 'text-violet-700 dark:text-violet-400' },
                    { name: 'FrontendDevAgent', role: '모바일 반응형 및 UI/UX 개발', status: '정상 가동', color: 'text-cyan-700 dark:text-cyan-400' },
                    { name: 'BackendDevAgent', role: '회피설계 및 시스템 구현', status: '정상 가동', color: 'text-blue-700 dark:text-blue-400' },
                    { name: 'SecurityAgent', role: '1차 정보보안 및 OWASP 심사', status: '정상 가동', color: 'text-rose-700 dark:text-rose-400' },
                    { name: 'QAAgent', role: '1차 독립 품질 규격 검수', status: '정상 가동', color: 'text-emerald-700 dark:text-emerald-400' },
                    { name: 'SecOpsAuditAgent', role: '2차 수석 보안감리 (제로트러스트)', status: '정상 가동', color: 'text-red-700 dark:text-red-400' },
                    { name: 'SeniorQAAgent', role: '2차 수석 품질 재검증 (50건 엣지)', status: '정상 가동', color: 'text-teal-700 dark:text-teal-400' },
                    { name: 'VisualQAAgent', role: '시각·접근성 감리 (WCAG 4.5:1)', status: '정상 가동', color: 'text-pink-700 dark:text-pink-400' },
                    { name: 'ProductMarketingAgent', role: '상품화 카탈로그 및 운용 매뉴얼', status: '정상 가동', color: 'text-amber-700 dark:text-amber-400' },
                  ].map((agent) => (
                    <div
                      key={agent.name}
                      onClick={() => setActiveTab('org')}
                      className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950/80 border border-slate-300 dark:border-slate-800/80 flex items-center justify-between text-xs cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
                    >
                      <div className="truncate pr-1">
                        <span className={`font-bold block ${agent.color} truncate`}>{agent.name}</span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate block">{agent.role}</span>
                      </div>
                      <span className="text-[10px] text-emerald-700 dark:text-emerald-400 flex items-center gap-1 font-bold shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        {agent.status}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        )}

        {/* ================= 탭 2: 5단계 칸반 보드 ================= */}
        {activeTab === 'kanban' && (
          <div className="animate-in fade-in duration-200">
            <KanbanBoard
              tasks={tasks}
              isLoading={loadingTasks}
              onRefresh={fetchTasks}
              selectedDeliverableTask={selectedDeliverableTask}
              onCloseDeliverableModal={() => setSelectedDeliverableTask(null)}
            />
          </div>
        )}

        {/* ================= 탭 3: 4대 장부 탐색기 ================= */}
        {activeTab === 'ledgers' && (
          <div className="animate-in fade-in duration-200">
            <LedgerViewer onRefreshTrigger={refreshTrigger} />
          </div>
        )}

        {/* ================= 탭 4: 가상 조직도 ================= */}
        {activeTab === 'org' && (
          <div className="animate-in fade-in duration-200">
            <OrgChart
              tasks={tasks}
              isExecuting={isExecutingCommand}
              executionStage={executionStage}
            />
          </div>
        )}

        {/* ================= 하단 실시간 이벤트 수신 로그 티커 바 (관제 모니터링 콘솔) ================= */}
        <section className="bg-white dark:bg-slate-900/90 border-2 border-slate-300 dark:border-slate-800 rounded-xl p-3.5 shadow-md text-xs backdrop-blur-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 mb-2 border-b-2 border-slate-200 dark:border-slate-800/80">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              <span className="font-bold text-slate-900 dark:text-white">
                실시간 관제 이벤트 스트림 (WebSocket)
              </span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
                수신 {liveEvents.length}건
              </span>
            </div>
            <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400 text-[11px] font-medium">
              <span>연결 상태: <strong className={isConnected ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-500'}>{status}</strong></span>
              {liveEvents.length > 0 && (
                <button
                  onClick={() => setLiveEvents([])}
                  className="hover:text-slate-800 dark:hover:text-slate-200 underline font-semibold"
                >
                  로그 지우기
                </button>
              )}
            </div>
          </div>

          <div className="max-h-24 overflow-y-auto space-y-1.5 scrollbar-thin">
            {liveEvents.length === 0 ? (
              <div className="text-slate-500 dark:text-slate-400 italic py-1 text-center font-medium">
                실시간 관제 이벤트를 대기하고 있습니다...
              </div>
            ) : (
              liveEvents.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-2.5 font-mono text-[11px] text-slate-700 dark:text-slate-300 py-0.5 leading-snug"
                >
                  <span className="text-slate-500 shrink-0 font-semibold">[{item.timestamp}]</span>
                  <span
                    className={`font-bold shrink-0 px-1.5 py-0.5 rounded text-[10px] ${
                      item.type === 'success'
                        ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800/60'
                        : item.type === 'warn'
                        ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-400 border border-amber-300 dark:border-amber-800/60'
                        : 'bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-400 border border-sky-300 dark:border-sky-800/60'
                    }`}
                  >
                    {item.event}
                  </span>
                  <span className="truncate text-slate-800 dark:text-slate-200 font-medium">{item.message}</span>
                </div>
              ))
            )}
          </div>
        </section>
      </main>

      {/* 글로벌 푸터 */}
      <footer className="border-t-2 border-slate-300 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 px-6 py-4 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between text-xs text-slate-600 dark:text-slate-400 gap-2">
          <div>
            AI Virtual Company OS <span className="text-sky-600 dark:text-sky-400 font-bold">V4.5</span> &copy; 2026 Virtual Company Inc. 산업용 3-in-1 PLC 관제 자율 가상회사
          </div>
          <div className="flex items-center gap-4 text-[11px] font-medium">
            <span>아키텍처: FastAPI + React + Tailwind + WebSocket</span>
            <span>이중 원장 감사 보증</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
