// frontend/src/components/layout/Navbar.tsx
import React from 'react';
import {
  Cpu,
  Activity,
  Radio,
  Kanban,
  BookOpen,
  Users,
  LayoutDashboard,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import type { HealthResponse } from '../../types';

export type NavTabId = 'overview' | 'kanban' | 'ledgers' | 'org';

export interface NavbarProps {
  activeTab: NavTabId;
  onTabChange: (tab: NavTabId) => void;
  health: HealthResponse | null;
  healthError: string | null;
  wsStatus: string;
  wsConnected: boolean;
  reconnectCount: number;
  onRefreshAll?: () => void;
  isRefreshing?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  health,
  healthError,
  wsStatus,
  wsConnected,
  reconnectCount,
  onRefreshAll,
  isRefreshing = false,
}) => {
  const tabs: { id: NavTabId; label: string; icon: React.ReactNode; desc: string }[] = [
    {
      id: 'overview',
      label: '전체 관제실',
      icon: <LayoutDashboard className="w-4 h-4" />,
      desc: '실시간 관제 요약 및 CEO 지시실',
    },
    {
      id: 'kanban',
      label: '5단계 칸반 보드',
      icon: <Kanban className="w-4 h-4" />,
      desc: 'IDLE ~ CLOSED 5단계 검증 워크플로우',
    },
    {
      id: 'ledgers',
      label: '4대 장부 탐색기',
      icon: <BookOpen className="w-4 h-4" />,
      desc: '지시·업무·회의·특허 원장 동기화',
    },
    {
      id: 'org',
      label: '가상 조직도',
      icon: <Users className="w-4 h-4" />,
      desc: 'COO 및 3대 전문 에이전트 실시간 상태',
    },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md px-4 lg:px-8 py-3.5 transition-all shadow-lg shadow-black/20">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* 좌측: 로고 및 시스템 타이틀 */}
        <div className="flex items-center gap-3.5 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-3">
            <div className="relative group cursor-pointer" onClick={() => onTabChange('overview')}>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 p-[1px] shadow-lg shadow-sky-500/10">
                <div className="w-full h-full rounded-[11px] bg-slate-950 flex items-center justify-center text-sky-400 group-hover:text-sky-300 transition-colors">
                  <Cpu className="w-5 h-5" />
                </div>
              </div>
              <span className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-slate-900" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
                  AI Virtual Company OS
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-sky-950 text-sky-400 border border-sky-800">
                    V4.0
                  </span>
                </h1>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                자율 멀티 에이전트 가상회사 운영 관제 시스템
              </p>
            </div>
          </div>

          {/* 모바일 새로고침 버튼 */}
          {onRefreshAll && (
            <button
              onClick={onRefreshAll}
              disabled={isRefreshing}
              title="전체 데이터 새로고침"
              className="md:hidden p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white border border-slate-700 active:scale-95 transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-sky-400' : ''}`} />
            </button>
          )}
        </div>

        {/* 중앙: 탭 네비게이션 */}
        <nav className="flex items-center bg-slate-950/80 p-1 rounded-xl border border-slate-800/90 w-full md:w-auto overflow-x-auto scrollbar-none">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                title={tab.desc}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* 우측: 시스템 상태 모니터 & 제어 */}
        <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
          {/* 전체 새로고침 버튼 */}
          {onRefreshAll && (
            <button
              onClick={onRefreshAll}
              disabled={isRefreshing}
              title="시스템 상태 및 원장 수동 새로고침"
              className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800/70 hover:bg-slate-800 border border-slate-700/80 text-xs text-slate-300 hover:text-white transition-all active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-sky-400' : ''}`} />
              <span>새로고침</span>
            </button>
          )}

          {/* API 서버 상태 뱃지 */}
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-950/70 border border-slate-800 text-xs"
            title={healthError ? `오류: ${healthError}` : 'FastAPI 백엔드 서버 상태'}
          >
            <Activity className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400 hidden lg:inline">API:</span>
            {health ? (
              <span className="flex items-center gap-1 text-emerald-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                온라인
              </span>
            ) : healthError ? (
              <span className="flex items-center gap-1 text-rose-400 font-medium">
                <AlertCircle className="w-3 h-3 text-rose-400" />
                오프라인
              </span>
            ) : (
              <span className="flex items-center gap-1 text-amber-400">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                확인 중
              </span>
            )}
          </div>

          {/* WebSocket 실시간 연결 상태 뱃지 */}
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-950/70 border border-slate-800 text-xs"
            title={`WebSocket 실시간 채널 (${wsStatus})`}
          >
            <Radio className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400 hidden lg:inline">실시간 WS:</span>
            <span
              className={`flex items-center gap-1.5 font-medium ${
                wsConnected
                  ? 'text-emerald-400'
                  : wsStatus === 'CONNECTING'
                  ? 'text-amber-400'
                  : 'text-slate-400'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  wsConnected
                    ? 'bg-emerald-500 animate-pulse'
                    : wsStatus === 'CONNECTING'
                    ? 'bg-amber-400 animate-ping'
                    : 'bg-slate-600'
                }`}
              />
              {wsConnected
                ? '연결됨'
                : wsStatus === 'CONNECTING'
                ? '연결 중'
                : '연결 끊김'}
              {reconnectCount > 0 && !wsConnected && (
                <span className="text-[10px] text-amber-400">({reconnectCount}회)</span>
              )}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
