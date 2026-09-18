import { useEffect, useState } from 'react';
import {
  Activity,
  Terminal,
  Kanban,
  BookOpen,
  Users,
  Radio,
  CheckCircle2,
  AlertCircle,
  Cpu,
} from 'lucide-react';
import { getHealth } from './api/client';
import { useWebSocket } from './hooks/useWebSocket';
import type { HealthResponse } from './types';

export default function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);

  const { isConnected, status, lastEvent, reconnectCount } = useWebSocket({
    autoConnect: true,
  });

  useEffect(() => {
    let isMounted = true;
    getHealth()
      .then((res) => {
        if (isMounted) setHealth(res);
      })
      .catch((err) => {
        if (isMounted) setHealthError(err.message || '서버 연결 실패');
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* 상단 네비게이션 헤더 */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur px-6 py-4 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-sky-600/20 border border-sky-500/40 flex items-center justify-center text-sky-400">
              <Cpu className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                AI Virtual Company OS <span className="text-xs px-2 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-800">V4.0</span>
              </h1>
              <p className="text-xs text-slate-400">자율 멀티 에이전트 가상회사 운영 시스템</p>
            </div>
          </div>

          {/* 시스템 상태 뱃지 */}
          <div className="flex items-center gap-3">
            {/* API 서버 상태 */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700 text-xs">
              <Activity className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-400">API:</span>
              {health ? (
                <span className="flex items-center gap-1 text-emerald-400 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  {health.status}
                </span>
              ) : healthError ? (
                <span className="flex items-center gap-1 text-rose-400 font-medium" title={healthError}>
                  <AlertCircle className="w-3 h-3 text-rose-400" />
                  오프라인
                </span>
              ) : (
                <span className="text-amber-400">확인 중...</span>
              )}
            </div>

            {/* WebSocket 상태 */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700 text-xs">
              <Radio className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-400">실시간 WS:</span>
              <span
                className={`flex items-center gap-1 font-medium ${
                  isConnected ? 'text-emerald-400' : status === 'CONNECTING' ? 'text-amber-400' : 'text-slate-400'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isConnected
                      ? 'bg-emerald-500 animate-pulse'
                      : status === 'CONNECTING'
                      ? 'bg-amber-500 animate-ping'
                      : 'bg-slate-600'
                  }`}
                />
                {status}
                {reconnectCount > 0 && !isConnected && ` (#${reconnectCount})`}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* 메인 대시보드 셸 (태스크 9에서 풀 UI 컴포넌트로 확장) */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {/* CEO 명령 관제실 프리뷰 섹션 */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
          <div className="flex items-center gap-2 mb-3 text-sky-400">
            <Terminal className="w-5 h-5" />
            <h2 className="font-semibold text-white">CEO 관제실 (Command Center)</h2>
          </div>
          <p className="text-sm text-slate-400 mb-4">
            자연어 지시를 입력하면 COO 에이전트가 업무를 분해하고 특허 Gatekeeper 검증, 개발, 독립 QA 검수를 자율 진행합니다.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              placeholder="예: 산업용 IoT 게이트웨이 및 PLC 통신 모듈 개발 지시"
              className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-sky-500"
            />
            <button
              disabled
              className="px-5 py-2.5 rounded-lg bg-sky-600 text-white font-medium text-sm hover:bg-sky-500 transition-colors opacity-75 cursor-not-allowed"
            >
              지시 하달
            </button>
          </div>
        </section>

        {/* 4대 패널 그리드 플레이스홀더 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* 5단계 칸반 보드 */}
          <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col">
            <div className="flex items-center gap-2 text-indigo-400 mb-2">
              <Kanban className="w-5 h-5" />
              <h3 className="font-semibold text-white">5단계 업무 칸반</h3>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              IDLE → WORKING → SUBMITTED → REVIEW → VERIFIED → CLOSED
            </p>
            <div className="flex-1 border border-dashed border-slate-800 rounded-lg flex items-center justify-center p-6 text-slate-600 text-xs">
              태스크 9에서 구현 예정 (KanbanBoard.tsx)
            </div>
          </section>

          {/* 4대 장부 탐색기 */}
          <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col">
            <div className="flex items-center gap-2 text-emerald-400 mb-2">
              <BookOpen className="w-5 h-5" />
              <h3 className="font-semibold text-white">4대 장부 탐색기</h3>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              지시원장, 업무원장, 회의록, 특허/지식 원장 실시간 동기화
            </p>
            <div className="flex-1 border border-dashed border-slate-800 rounded-lg flex items-center justify-center p-6 text-slate-600 text-xs">
              태스크 9에서 구현 예정 (LedgerViewer.tsx)
            </div>
          </section>

          {/* 조직도 & 에이전트 모니터 */}
          <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col">
            <div className="flex items-center gap-2 text-amber-400 mb-2">
              <Users className="w-5 h-5" />
              <h3 className="font-semibold text-white">조직도 & 에이전트</h3>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              CEO, COO, 특허 Gatekeeper, 백엔드/프론트엔드 개발, QA 검수원
            </p>
            <div className="flex-1 border border-dashed border-slate-800 rounded-lg flex items-center justify-center p-6 text-slate-600 text-xs">
              태스크 9에서 구현 예정 (OrgChart.tsx)
            </div>
          </section>
        </div>

        {/* 최신 실시간 이벤트 수신 로그 바 */}
        <section className="bg-slate-900/60 border border-slate-800/80 rounded-lg px-4 py-3 text-xs flex items-center justify-between text-slate-400">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-sky-400" />
            <span>실시간 WebSocket 수신:</span>
            {lastEvent ? (
              <span className="font-mono text-slate-200">
                [{lastEvent.event}] {JSON.stringify(lastEvent.data)}
              </span>
            ) : (
              <span className="italic text-slate-500">대기 중...</span>
            )}
          </div>
          <span className="text-[11px] text-slate-500">환경: Vite + React 18 + TailwindCSS</span>
        </section>
      </main>

      {/* 푸터 */}
      <footer className="border-t border-slate-800/60 bg-slate-950 px-6 py-4 text-center text-xs text-slate-500">
        AI Virtual Company OS V4.0 &copy; 2026 Virtual Company Inc. All Rights Reserved.
      </footer>
    </div>
  );
}
