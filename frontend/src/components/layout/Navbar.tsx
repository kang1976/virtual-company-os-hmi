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
  Maximize,
  Minimize,
  Moon,
  Sun,
  RotateCcw,
} from 'lucide-react';
import type { HealthResponse } from '../../types';
import type { ThemeMode } from '../../hooks/useTheme';

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
  theme: ThemeMode;
  onThemeToggle: () => void;
  isFullscreen: boolean;
  onFullscreenToggle: () => void;
  onResetData?: () => void;
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
  theme,
  onThemeToggle,
  isFullscreen,
  onFullscreenToggle,
  onResetData,
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
      label: '5단계 칸반',
      icon: <Kanban className="w-4 h-4" />,
      desc: 'IDLE ~ CLOSED 5단계 검증 워크플로우',
    },
    {
      id: 'ledgers',
      label: '4대 장부',
      icon: <BookOpen className="w-4 h-4" />,
      desc: '지시·업무·회의·특허 원장 동기화',
    },
    {
      id: 'org',
      label: '조직도',
      icon: <Users className="w-4 h-4" />,
      desc: 'COO, 보안, 개발, QA 에이전트 상태',
    },
  ];

  const getThemeDisplay = () => {
    if (theme === 'modern-light') {
      return { icon: <Sun className="w-4 h-4 text-amber-500" />, label: '라이트 모드' };
    }
    return { icon: <Moon className="w-4 h-4 text-sky-400" />, label: '다크 모드' };
  };

  const currentTheme = getThemeDisplay();

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 dark:border-slate-700/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-3 sm:px-6 py-2.5 sm:py-3 transition-colors shadow-md">
      <div className="max-w-7xl mx-auto flex flex-col gap-2 sm:gap-3">
        {/* 상단 라인: 로고, 시스템 타이틀, 상태 뱃지, 제어 버튼군 */}
        <div className="flex items-center justify-between gap-2 w-full">
          {/* 좌측: 로고 및 타이틀 */}
          <div
            className="flex items-center gap-2 sm:gap-3 cursor-pointer select-none"
            onClick={() => onTabChange('overview')}
          >
            <div className="relative group">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 p-[1px] shadow-md shadow-sky-500/20">
                <div className="w-full h-full rounded-[11px] bg-slate-950 flex items-center justify-center text-sky-400 group-hover:text-sky-300 transition-colors">
                  <Cpu className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-slate-900" />
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                  AI Virtual Company
                </h1>
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-400 border border-sky-300 dark:border-sky-800">
                  V4.0
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block">
                초지능 자율운영 멀티에이전트 가상기업 OS
              </p>
            </div>
          </div>

          {/* 우측: 상태 뱃지 및 유틸리티 버튼 (전체화면, 테마, 새로고침) */}
          <div className="flex items-center gap-1.5 sm:gap-2.5">
            {/* API 서버 상태 뱃지 */}
            <div
              className="flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-950/80 border border-slate-300 dark:border-slate-800 text-[11px] sm:text-xs text-slate-700 dark:text-slate-300"
              title={healthError ? `오류: ${healthError}` : 'FastAPI 백엔드 서버'}
            >
              <Activity className="w-3 h-3 text-slate-400" />
              {health ? (
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="hidden xs:inline sm:inline">서버</span> 정상
                </span>
              ) : (
                <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400 font-medium">
                  <AlertCircle className="w-3 h-3 text-rose-500" />
                  점검
                </span>
              )}
            </div>

            {/* 실시간 WS 연결 뱃지 */}
            <div
              className="flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-950/80 border border-slate-300 dark:border-slate-800 text-[11px] sm:text-xs text-slate-700 dark:text-slate-300"
              title={`실시간 웹소켓 (${wsStatus}${reconnectCount > 0 ? `, 재접속: ${reconnectCount}회` : ''})`}
            >
              <Radio className="w-3 h-3 text-slate-400" />
              <span className="flex items-center gap-1 font-medium">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    wsConnected
                      ? 'bg-emerald-500 animate-pulse'
                      : 'bg-amber-400 animate-ping'
                  }`}
                />
                <span className={wsConnected ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
                  {wsConnected ? '실시간' : '연결중'}
                </span>
              </span>
            </div>

            {/* 테마 변경 버튼 */}
            <button
              onClick={onThemeToggle}
              title={`테마 변경 (현재: ${currentTheme.label})`}
              className="flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700/80 text-xs active:scale-95 transition-all"
              aria-label="테마 변경"
            >
              {currentTheme.icon}
              <span className="hidden sm:inline text-[11px] font-medium">{currentTheme.label}</span>
            </button>

            {/* 전체화면(Fullscreen) 토글 버튼 */}
            <button
              onClick={onFullscreenToggle}
              title={isFullscreen ? '전체화면 종료 (ESC)' : '전체화면 모드로 전환'}
              className="p-1.5 sm:p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700/80 active:scale-95 transition-all"
              aria-label="전체화면 전환"
            >
              {isFullscreen ? (
                <Minimize className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-600 dark:text-sky-400" />
              ) : (
                <Maximize className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white" />
              )}
            </button>

            {/* 전체 새로고침 버튼 */}
            {onRefreshAll && (
              <button
                onClick={onRefreshAll}
                disabled={isRefreshing}
                title="데이터 수동 새로고침"
                className="p-1.5 sm:p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-slate-700/80 active:scale-95 transition-all disabled:opacity-50"
                aria-label="새로고침"
              >
                <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isRefreshing ? 'animate-spin text-sky-600 dark:text-sky-400' : ''}`} />
              </button>
            )}

            {/* 데이터 전체 초기화 버튼 */}
            {onResetData && (
              <button
                onClick={onResetData}
                title="데이터 전체 초기화 (DB 및 4대 장부 리셋)"
                className="p-1.5 sm:p-2 rounded-lg bg-rose-100 hover:bg-rose-200 dark:bg-rose-950/60 dark:hover:bg-rose-900/70 text-rose-700 dark:text-rose-300 hover:text-rose-900 dark:hover:text-rose-100 border border-rose-300 dark:border-rose-800/60 active:scale-95 transition-all"
                aria-label="데이터 초기화"
              >
                <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-200" />
              </button>
            )}
          </div>
        </div>

        {/* 하단 라인: 모바일 친화적 탭 네비게이션 */}
        <nav className="flex items-center bg-slate-100 dark:bg-slate-950/80 p-1 rounded-xl border border-slate-300 dark:border-slate-800/90 overflow-x-auto scrollbar-none gap-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                title={tab.desc}
                className={`flex-1 min-w-[75px] sm:min-w-[100px] flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30 font-semibold text-white-force'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-800/60'

                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
