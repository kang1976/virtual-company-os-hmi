// frontend/src/components/ceo/CommandBar.tsx
import React, { useState } from 'react';
import {
  Terminal,
  Send,
  Sparkles,
  CheckCircle2,
  Clock,
  Code2,
  Award,
  Layers,
  ExternalLink,
  ChevronRight,
  AlertCircle,
  FolderOpen,
  ShieldAlert,
  Lock,
} from 'lucide-react';
import type { CommandResponse, Priority, TaskItem } from '../../types';

export interface CommandBarProps {
  onCommandSubmit: (instruction: string, targetTeam: string, priority: Priority) => Promise<CommandResponse | void>;
  isExecuting: boolean;
  executionStage?: number; // 0: 대기, 1: COO 분해, 2: 특허 조사, 3: 개발 구현, 4: 보안 심사, 5: QA 검수, 6: 완료
  latestResult: CommandResponse | null;
  onNavigateTab?: (tab: 'kanban' | 'ledgers' | 'org') => void;
  onSelectDeliverable?: (task: TaskItem) => void;
}

const PRESET_COMMANDS = [
  '스마트 팩토리 PLC 모니터링 시스템 구축',
  'AI 비전 품질 검사 파이프라인 개발',
  'ERP 실시간 재고 연동 서비스 구축',
  '클라우드 네이티브 MES 제조 실행 시스템 설계',
];

const TARGET_TEAMS = [
  { id: '전체', label: '전사 총괄 (COO 자율 분해)' },
  { id: '운영기획팀', label: '운영기획팀 (COO)' },
  { id: 'IP특허팀', label: 'IP·특허팀 (Gatekeeper)' },
  { id: '백엔드개발팀', label: '백엔드개발팀 (회피설계)' },
  { id: '보안팀', label: '보안팀 (취약점·CVE 심사)' },
  { id: '품질QA팀', label: '품질QA팀 (독립 검수)' },
];

const PRIORITIES: { id: Priority; label: string; color: string }[] = [
  { id: 'P0', label: 'P0 (긴급)', color: 'border-rose-500/50 text-rose-400 bg-rose-950/40' },
  { id: 'P1', label: 'P1 (높음)', color: 'border-amber-500/50 text-amber-400 bg-amber-950/40' },
  { id: 'P2', label: 'P2 (보통)', color: 'border-sky-500/50 text-sky-400 bg-sky-950/40' },
  { id: 'P3', label: 'P3 (낮음)', color: 'border-emerald-500/50 text-emerald-400 bg-emerald-950/40' },
  { id: 'P4', label: 'P4 (예비)', color: 'border-slate-600 text-slate-400 bg-slate-900/60' },
];

const PIPELINE_STEPS = [
  { step: 1, name: 'COO 분해', desc: '지시 분석 및 업무 할당', icon: Layers },
  { step: 2, name: '특허 FTO', desc: '선행특허 회피설계', icon: ShieldAlert },
  { step: 3, name: '시스템 개발', desc: '특허 회피설계 구현', icon: Code2 },
  { step: 4, name: '보안 심사', desc: 'OWASP / CVE 검증', icon: Lock },
  { step: 5, name: 'QA 검수', desc: '품질 및 신뢰성 마감', icon: Award },
];

export const CommandBar: React.FC<CommandBarProps> = ({
  onCommandSubmit,
  isExecuting,
  executionStage = 0,
  latestResult,
  onNavigateTab,
  onSelectDeliverable,
}) => {
  const [instruction, setInstruction] = useState('');
  const [targetTeam, setTargetTeam] = useState('전체');
  const [priority, setPriority] = useState<Priority>('P0');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = instruction.trim();
    if (!trimmed) {
      setErrorMsg('CEO 업무 지시 내용을 입력해주세요.');
      return;
    }
    setErrorMsg(null);
    try {
      await onCommandSubmit(trimmed, targetTeam, priority);
    } catch (err: any) {
      setErrorMsg(err.message || '명령 전달 중 오류가 발생했습니다.');
    }
  };

  const handleSelectPreset = (preset: string) => {
    setInstruction(preset);
    setErrorMsg(null);
  };

  return (
    <div className="space-y-4">
      {/* CEO 지시 입력 메인 패널 */}
      <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl relative overflow-hidden backdrop-blur-sm">
        {/* 상단 액센트 글로우 */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-sky-500 via-indigo-500 to-emerald-500" />

        {/* 헤더 & 설명 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-400 shrink-0">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-white text-sm sm:text-base md:text-lg flex items-center gap-1.5 sm:gap-2">
                CEO 자율 지시 관제실
                <span className="text-[10px] sm:text-xs font-normal text-slate-400">
                  (Executive Terminal)
                </span>
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-400">
                자연어로 지시를 내리면 가상 조직의 에이전트들이 협업 파이프라인을 자율 구동합니다.
              </p>
            </div>
          </div>

          {/* 대상 팀 & 우선순위 셀렉터 */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* 우선순위 선택 */}
            <div className="flex items-center gap-1 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800 text-xs flex-1 sm:flex-initial">
              <span className="text-slate-500 font-medium">우선순위:</span>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                disabled={isExecuting}
                className="bg-transparent text-slate-200 focus:outline-none cursor-pointer font-medium w-full sm:w-auto"
              >
                {PRIORITIES.map((p) => (
                  <option key={p.id} value={p.id} className="bg-slate-900 text-slate-200">
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 담당 팀 선택 */}
            <div className="flex items-center gap-1 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800 text-xs flex-1 sm:flex-initial">
              <span className="text-slate-500 font-medium">수신:</span>
              <select
                value={targetTeam}
                onChange={(e) => setTargetTeam(e.target.value)}
                disabled={isExecuting}
                className="bg-transparent text-slate-200 focus:outline-none cursor-pointer font-medium w-full sm:w-auto"
              >
                {TARGET_TEAMS.map((t) => (
                  <option key={t.id} value={t.id} className="bg-slate-900 text-slate-200">
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* 명령어 입력 폼 (모바일 대응 터치 UI) */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              disabled={isExecuting}
              placeholder="예: 스마트 팩토리 PLC 모니터링 시스템 구축 및 특허/보안 검증 지시"
              className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-4 py-3 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition-all shadow-inner disabled:opacity-60 min-h-[44px]"
            />
            <button
              type="submit"
              disabled={isExecuting || !instruction.trim()}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-md shadow-sky-600/30 disabled:shadow-none disabled:text-slate-500 disabled:cursor-not-allowed active:scale-95 shrink-0"
            >
              {isExecuting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  <span>실행 중...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>지시 발령</span>
                </>
              )}
            </button>
          </div>

          {errorMsg && (
            <div className="flex items-center gap-1.5 text-xs text-rose-400 bg-rose-950/40 border border-rose-800/60 px-3 py-1.5 rounded-lg">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 사전 정의 프리셋 퀵 액션 (모바일 스와이프 지원) */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pt-1 pb-0.5">
            <div className="flex items-center gap-1 text-slate-500 text-[11px] shrink-0 font-medium">
              <Sparkles className="w-3 h-3 text-sky-400" />
              <span className="hidden xs:inline">추천:</span>
            </div>
            {PRESET_COMMANDS.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectPreset(preset)}
                disabled={isExecuting}
                className="px-2.5 py-1 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 text-[11px] transition-colors active:scale-95 disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                {preset}
              </button>
            ))}
          </div>
        </form>

        {/* 자율 실행 중 실시간 파이프라인 5단계 스테퍼 */}
        {isExecuting && (
          <div className="mt-4 pt-4 border-t border-slate-800/80">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-semibold text-sky-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
                5단계 에이전트 파이프라인 자율 수행 중
              </span>
              <span className="text-xs text-slate-400 font-mono">
                진행: {executionStage}/5
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
              {PIPELINE_STEPS.map((item) => {
                const IconComponent = item.icon;
                const isCurrent = executionStage === item.step;
                const isPassed = executionStage > item.step;
                return (
                  <div
                    key={item.step}
                    className={`p-2.5 rounded-xl border text-xs transition-all ${
                      isCurrent
                        ? 'bg-sky-950/50 border-sky-500/60 shadow-md shadow-sky-500/10 ring-1 ring-sky-500/30'
                        : isPassed
                        ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                        : 'bg-slate-950/50 border-slate-800/80 text-slate-500'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold flex items-center gap-1 text-[11px] sm:text-xs">
                        <IconComponent
                          className={`w-3.5 h-3.5 ${
                            isCurrent ? 'text-sky-400 animate-bounce' : isPassed ? 'text-emerald-400' : 'text-slate-600'
                          }`}
                        />
                        {item.name}
                      </span>
                      {isPassed ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      ) : isCurrent ? (
                        <Clock className="w-3.5 h-3.5 text-sky-400 animate-spin" />
                      ) : (
                        <span className="text-[10px] text-slate-600">대기</span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 leading-tight line-clamp-1">{item.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 최근 실행 결과 브리핑 카드 */}
      {latestResult && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-lg relative">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 mb-3 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-white text-xs sm:text-sm">
                    최근 명령 처리 브리핑
                  </h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800">
                    {latestResult.status === 'SUCCESS' ? '수행 완료' : latestResult.status}
                  </span>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 text-[11px] text-slate-400 mt-0.5 font-mono">
                  <span>프로젝트: <strong className="text-slate-200">{latestResult.project_id}</strong></span>
                  <span>·</span>
                  <span>지시: <strong className="text-slate-200">{latestResult.command_id}</strong></span>
                </div>
              </div>
            </div>

            {/* 탭 이동 숏컷 */}
            <div className="flex items-center gap-2">
              {onNavigateTab && (
                <>
                  <button
                    onClick={() => onNavigateTab('kanban')}
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 hover:text-white border border-slate-700 transition-colors"
                  >
                    <span>칸반 보드</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onNavigateTab('ledgers')}
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 hover:text-white border border-slate-700 transition-colors"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span>원장 열람</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* 총평 및 요약 */}
          <div className="bg-slate-950/70 rounded-lg p-3 border border-slate-800/80 mb-3 text-xs text-slate-300 leading-relaxed">
            <span className="font-semibold text-sky-400 block mb-0.5">총괄 요약 (COO 브리핑):</span>
            {latestResult.summary || '전 공정 검증 완료 및 4대 장부 최종 마감되었습니다.'}
          </div>

          {/* 생성/완료된 태스크 목록 */}
          {latestResult.completed_tasks && latestResult.completed_tasks.length > 0 && (
            <div>
              <div className="text-xs text-slate-400 font-medium mb-2 flex items-center justify-between">
                <span>공정별 산출물 ({latestResult.completed_tasks.length}건)</span>
                <span className="text-[11px] text-slate-500">터치하여 상세 보기</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                {latestResult.completed_tasks.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => onSelectDeliverable?.(task)}
                    className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 hover:border-sky-500/60 hover:bg-slate-900 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="font-mono text-slate-400">{task.id}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800/60">
                        {task.status}
                      </span>
                    </div>
                    <div className="text-xs font-medium text-slate-200 group-hover:text-sky-300 transition-colors line-clamp-1">
                      {task.title}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
                      <span className="line-clamp-1">담당: {task.assignee}</span>
                      <ExternalLink className="w-3 h-3 text-slate-600 group-hover:text-sky-400 shrink-0" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
