// frontend/src/components/dashboard/ExecutiveStatsChart.tsx
import React, { useState } from 'react';
import {
  BarChart3,
  PieChart,
  TrendingUp,
  CheckCircle2,
  Clock,
  X,
  ChevronRight,
  FileText,
  Layers,
} from 'lucide-react';
import type { TaskItem } from '../../types';

interface ExecutiveStatsChartProps {
  tasks?: TaskItem[];
  isExecuting?: boolean;
  executionStage?: number;
  onNavigateTab?: (tab: string) => void;
  onSelectDeliverable?: (task: TaskItem) => void;
}

interface StageChartData {
  stageNumber: number;
  stageName: string;
  normalCount: number;
  workingCount: number;
  lagCount: number;
  bottleneckCount: number;
  latencySeconds: number; // 꺾은선용
}

export const ExecutiveStatsChart: React.FC<ExecutiveStatsChartProps> = ({
  tasks = [],
  isExecuting = false,
  executionStage = 0,
  onNavigateTab,
  onSelectDeliverable,
}) => {
  const [selectedDetail, setSelectedDetail] = useState<{
    title: string;
    description: string;
    tasks: TaskItem[];
    type: string;
  } | null>(null);

  // 1. 도넛 ① 데이터: 전사 업무 건전성 & 랙 비율 계산
  const totalTasks = tasks.length > 0 ? tasks.length : 8;
  const normalTasks = tasks.filter((t) => t.status === 'CLOSED' || t.status === 'VERIFIED');
  const workingTasks = tasks.filter((t) => t.status === 'WORKING' || t.status === 'SUBMITTED' || t.status === 'REVIEW');
  const lagTasks = tasks.filter((t) => t.latency_status === 'LAG' || (t.elapsed_seconds && t.elapsed_seconds > 3.0));
  const bottleneckTasks = tasks.filter((t) => t.status === 'BLOCKED' || t.latency_status === 'BOTTLENECK');

  const normalCount = tasks.length > 0 ? normalTasks.length : 6;
  const workingCount = tasks.length > 0 ? (isExecuting ? 2 : workingTasks.length) : 1;
  const lagCount = tasks.length > 0 ? lagTasks.length : 1;
  const bottleneckCount = tasks.length > 0 ? bottleneckTasks.length : 0;

  const healthSlices = [
    { label: '정상 완료 (Normal)', count: normalCount, color: '#10B981', textColor: 'text-emerald-500', rawTasks: normalTasks },
    { label: '작업 중 (Working)', count: workingCount, color: '#3B82F6', textColor: 'text-blue-500', rawTasks: workingTasks },
    { label: '지연 주의 (Lag)', count: lagCount, color: '#F59E0B', textColor: 'text-amber-500', rawTasks: lagTasks },
    { label: '병목/차단 (Blocked)', count: bottleneckCount, color: '#EF4444', textColor: 'text-rose-500', rawTasks: bottleneckTasks },
  ];

  // 2. 도넛 ② 데이터: 부서별 리소스 투입 점유율
  const deptSlices = [
    { label: '기술개발본부', count: 9, percent: 45, color: '#6366F1', textColor: 'text-indigo-500', deptKey: 'engineering' },
    { label: '보안·품질본부', count: 4, percent: 25, color: '#14B8A6', textColor: 'text-teal-500', deptKey: 'security_qa' },
    { label: '디자인센터', count: 3, percent: 15, color: '#EC4899', textColor: 'text-pink-500', deptKey: 'design' },
    { label: '사업·마케팅', count: 2, percent: 10, color: '#F59E0B', textColor: 'text-amber-500', deptKey: 'marketing' },
    { label: '경영·특허실', count: 2, percent: 5, color: '#8B5CF6', textColor: 'text-purple-500', deptKey: 'management' },
  ];

  // 3. 우측 복합 차트(Stacked Bar + Line) 데이터 (공정 6단계별)
  const stageData: StageChartData[] = [
    { stageNumber: 1, stageName: '1.지시', normalCount: 1, workingCount: 0, lagCount: 0, bottleneckCount: 0, latencySeconds: 0.4 },
    { stageNumber: 2, stageName: '2.전략', normalCount: 1, workingCount: 0, lagCount: 0, bottleneckCount: 0, latencySeconds: 0.9 },
    { stageNumber: 3, stageName: '3.기획', normalCount: 2, workingCount: 0, lagCount: 0, bottleneckCount: 0, latencySeconds: 1.5 },
    { stageNumber: 4, stageName: '4.개발', normalCount: 3, workingCount: isExecuting && executionStage === 4 ? 2 : 0, lagCount: 1, bottleneckCount: 0, latencySeconds: isExecuting && executionStage === 4 ? 4.2 : 2.4 },
    { stageNumber: 5, stageName: '5.품질', normalCount: 2, workingCount: isExecuting && executionStage === 5 ? 1 : 0, lagCount: 0, bottleneckCount: 0, latencySeconds: isExecuting && executionStage === 5 ? 3.1 : 1.8 },
    { stageNumber: 6, stageName: '6.출시', normalCount: 1, workingCount: isExecuting && executionStage === 6 ? 1 : 0, lagCount: 0, bottleneckCount: 0, latencySeconds: 1.2 },
  ];

  // 도넛 SVG 렌더링 헬퍼 함수
  const renderDonutSlices = (
    slices: { count: number; color: string }[],
    radius = 38,
    strokeWidth = 14
  ) => {
    const total = slices.reduce((acc, cur) => acc + cur.count, 0) || 1;
    const circumference = 2 * Math.PI * radius;
    let accumulatedAngle = 0;

    return slices.map((slice, idx) => {
      const strokeDasharray = `${(slice.count / total) * circumference} ${circumference}`;
      const strokeDashoffset = -accumulatedAngle;
      accumulatedAngle += (slice.count / total) * circumference;

      return (
        <circle
          key={idx}
          cx="50"
          cy="50"
          r={radius}
          fill="transparent"
          stroke={slice.color}
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-500 hover:opacity-80 cursor-pointer"
        />
      );
    });
  };

  // 콤보 차트 최대값 계산
  const maxStackHeight = 5; // 기준 최대 막대 높이
  const maxLatency = 5.0; // 기준 최대 레이턴시(초)

  return (
    <div className="bg-white dark:bg-slate-900/90 border-2 border-slate-300 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-lg backdrop-blur-sm transition-colors space-y-5">
      {/* 상단 통합 헤더 */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
              <BarChart3 className="w-5 h-5" />
            </span>
            <h2 className="font-extrabold text-slate-900 dark:text-white text-base sm:text-lg flex items-center gap-2">
              전사 운영 통계 & 에이전트 랙(지연) 복합 관제
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            차트나 수치를 클릭하시면 세부 산출물 및 에이전트 이력이 팝업으로 즉시 펼쳐집니다.
          </p>
        </div>

        {/* 종합 지표 뱃지 */}
        <div className="flex items-center gap-2 text-xs">
          <span className="px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 font-bold flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-indigo-500" />
            평균 지연: 1.4s (정상 범위)
          </span>
          <span className="px-3 py-1 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 font-bold flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            품질 합격률: 100%
          </span>
        </div>
      </div>

      {/* 메인 관제 차트 그리드: [좌측 도넛 2종] + [우측 복합 누적막대/꺾은선 차트] */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* ================= 1. 좌측 도넛 차트 2종 (5컬럼) ================= */}
        <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/70 dark:bg-slate-950/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800/80">
          {/* 도넛 ①: 업무 건전성 및 랙 상태 비율 */}
          <div
            onClick={() =>
              setSelectedDetail({
                title: '전사 업무 건전성 및 랙 분석',
                description: '전체 완료 태스크, 진행 중인 작업 및 지연/병목 건수의 세부 현황입니다.',
                tasks: tasks,
                type: 'health',
              })
            }
            className="flex flex-col items-center justify-between p-2 rounded-lg hover:bg-white dark:hover:bg-slate-900 transition-colors cursor-pointer group"
          >
            <div className="w-full flex items-center justify-between text-xs mb-2">
              <span className="font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                <PieChart className="w-3.5 h-3.5 text-indigo-500" />
                업무 건전성 비율
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
            </div>

            {/* 도넛 그래픽 */}
            <div className="relative w-28 h-28 my-1 flex items-center justify-center">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                {renderDonutSlices(healthSlices)}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-base font-black text-slate-900 dark:text-white font-mono">
                  {Math.round((normalCount / totalTasks) * 100)}%
                </span>
                <span className="text-[9px] text-slate-500 font-bold">정상 완료</span>
              </div>
            </div>

            {/* 범례 리스트 */}
            <div className="w-full space-y-1 text-[11px] mt-2">
              {healthSlices.map((s, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                    {s.label.split(' ')[0]}
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white font-mono">
                    {s.count}건 ({Math.round((s.count / totalTasks) * 100)}%)
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 도넛 ②: 부서별 리소스 투입 점유율 */}
          <div
            onClick={() => {
              if (onNavigateTab) onNavigateTab('org');
            }}
            className="flex flex-col items-center justify-between p-2 rounded-lg hover:bg-white dark:hover:bg-slate-900 transition-colors cursor-pointer group"
          >
            <div className="w-full flex items-center justify-between text-xs mb-2">
              <span className="font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-teal-500" />
                부서별 리소스 점유
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
            </div>

            {/* 도넛 그래픽 */}
            <div className="relative w-28 h-28 my-1 flex items-center justify-center">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                {renderDonutSlices(deptSlices)}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-base font-black text-slate-900 dark:text-white font-mono">
                  20명
                </span>
                <span className="text-[9px] text-slate-500 font-bold">자율 조직</span>
              </div>
            </div>

            {/* 범례 리스트 */}
            <div className="w-full space-y-1 text-[11px] mt-2">
              {deptSlices.map((d, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                    {d.label}
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white font-mono">
                    {d.count}명 ({d.percent}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ================= 2. 우측 복합 차트: 누적막대 + 꺾은선 추이 (7컬럼) ================= */}
        <div className="lg:col-span-7 bg-slate-50/70 dark:bg-slate-950/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs mb-2">
            <div>
              <span className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-amber-500" />
                공정 단계별 누적 처리량 & 랙(소요시간) 복합 추이
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                막대: 단계별 처리 태스크 수(건) · 꺾은선: 실제 연산 지연시간(초, Latency)
              </span>
            </div>

            {/* 콤보 차트 범례 */}
            <div className="flex items-center gap-2.5 text-[10px]">
              <span className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
                <span className="w-2.5 h-2.5 rounded bg-emerald-500" /> 정상
              </span>
              <span className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
                <span className="w-2.5 h-2.5 rounded bg-blue-500" /> 작업
              </span>
              <span className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
                <span className="w-2.5 h-2.5 rounded bg-amber-500" /> 지연
              </span>
              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-bold">
                <span className="w-3 h-0.5 bg-amber-500 inline-block" /> ⏱️ 소요시간(초)
              </span>
            </div>
          </div>

          {/* SVG 복합 콤보 차트 영역 */}
          <div className="relative w-full h-44 flex items-end pt-4 pb-6 px-4">
            {/* 좌측 Y축 눈금 (건수) */}
            <div className="absolute left-1 top-2 bottom-6 flex flex-col justify-between text-[9px] text-slate-400 font-mono">
              <span>5건</span>
              <span>3건</span>
              <span>1건</span>
              <span>0건</span>
            </div>

            {/* 우측 Y축 눈금 (소요시간 초) */}
            <div className="absolute right-1 top-2 bottom-6 flex flex-col justify-between text-[9px] text-amber-500 font-mono text-right">
              <span>5.0s</span>
              <span>3.0s</span>
              <span>1.0s</span>
              <span>0.0s</span>
            </div>

            {/* 차트 배경 가로 가이드라인 */}
            <div className="absolute left-8 right-8 top-3 bottom-6 flex flex-col justify-between pointer-events-none">
              <div className="border-b border-dashed border-slate-200 dark:border-slate-800 w-full" />
              <div className="border-b border-dashed border-slate-200 dark:border-slate-800 w-full" />
              <div className="border-b border-dashed border-slate-200 dark:border-slate-800 w-full" />
              <div className="border-b border-slate-300 dark:border-slate-700 w-full" />
            </div>

            {/* 6단계 막대 및 꺾은선 배치 컨테이너 */}
            <div className="relative w-full h-full flex items-end justify-between pl-6 pr-6 z-10">
              {/* 꺾은선 SVG 오버레이 */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
                {/* 꺾은선 패스 생성 */}
                {(() => {
                  const points = stageData.map((d, idx) => {
                    const xPercent = (idx / (stageData.length - 1)) * 85 + 7.5; // 좌우 마진 고려
                    const yPercent = 100 - (d.latencySeconds / maxLatency) * 85 - 10;
                    return `${xPercent}%,${yPercent}%`;
                  });
                  return (
                    <polyline
                      fill="none"
                      stroke="#F59E0B"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={points.join(' ')}
                    />
                  );
                })()}

                {/* 데이터 포인트 점 (Dots) */}
                {stageData.map((d, idx) => {
                  const xPercent = (idx / (stageData.length - 1)) * 85 + 7.5;
                  const yPercent = 100 - (d.latencySeconds / maxLatency) * 85 - 10;
                  return (
                    <circle
                      key={idx}
                      cx={`${xPercent}%`}
                      cy={`${yPercent}%`}
                      r="4.5"
                      fill="#F59E0B"
                      stroke="#FFFFFF"
                      strokeWidth="2"
                      className="transition-all hover:r-6"
                    />
                  );
                })}
              </svg>

              {/* 6단계 각각의 누적 막대 (Stacked Bar) */}
              {stageData.map((d) => {
                const totalCount = d.normalCount + d.workingCount + d.lagCount + d.bottleneckCount;
                const barHeightPercent = Math.min(100, (totalCount / maxStackHeight) * 85);

                return (
                  <div
                    key={d.stageNumber}
                    onClick={() =>
                      setSelectedDetail({
                        title: `${d.stageName} 공정 세부 분석`,
                        description: `해당 단계의 누적 태스크 수: ${totalCount}건 / 연산 소요 시간: ${d.latencySeconds}s`,
                        tasks: tasks,
                        type: 'stage',
                      })
                    }
                    className="flex flex-col items-center justify-end h-full w-9 group cursor-pointer"
                  >
                    {/* 상단 랙 뱃지 (지연 발생 시) */}
                    <div className="mb-1 text-[9px] font-mono font-bold text-amber-500">
                      {d.latencySeconds}s
                    </div>

                    {/* 누적 적층 막대 박스 */}
                    <div
                      className="w-6 rounded-t-md overflow-hidden flex flex-col-reverse shadow-sm border border-slate-300 dark:border-slate-700 group-hover:scale-105 transition-transform"
                      style={{ height: `${Math.max(14, barHeightPercent)}%` }}
                    >
                      {/* 정상 완료 */}
                      <div
                        style={{ height: `${(d.normalCount / (totalCount || 1)) * 100}%` }}
                        className="bg-emerald-500 w-full"
                      />
                      {/* 작업 중 */}
                      {d.workingCount > 0 && (
                        <div
                          style={{ height: `${(d.workingCount / (totalCount || 1)) * 100}%` }}
                          className="bg-blue-500 w-full animate-pulse"
                        />
                      )}
                      {/* 지연 주의 */}
                      {d.lagCount > 0 && (
                        <div
                          style={{ height: `${(d.lagCount / (totalCount || 1)) * 100}%` }}
                          className="bg-amber-500 w-full"
                        />
                      )}
                    </div>

                    {/* X축 레이블 */}
                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 mt-2 truncate w-full text-center">
                      {d.stageName.split('.')[1]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ================= 3. 원클릭 세부 상세 팝업 (모달) ================= */}
      {selectedDetail && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-800 rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <FileText className="w-5 h-5" />
                </span>
                <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
                  {selectedDetail.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedDetail(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400">
              {selectedDetail.description}
            </p>

            {/* 세부 태스크 리스트 */}
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {tasks.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-950 rounded-xl">
                  등록된 상세 내역이 없습니다.
                </div>
              ) : (
                tasks.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => {
                      if (onSelectDeliverable) {
                        onSelectDeliverable(t);
                        setSelectedDetail(null);
                      }
                    }}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800/80 flex items-center justify-between cursor-pointer transition-colors"
                  >
                    <div className="truncate pr-2">
                      <span className="text-[10px] font-bold text-slate-500 block">
                        [{t.assignee}] {t.id}
                      </span>
                      <span className="text-xs font-extrabold text-slate-900 dark:text-white truncate block">
                        {t.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] font-mono font-bold text-slate-500">
                        {t.elapsed_seconds || 1.2}s
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                        {t.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 flex justify-between items-center border-t border-slate-200 dark:border-slate-800">
              <span className="text-[11px] text-slate-500">
                태스크를 클릭하면 산출물 전문 화면으로 이동합니다.
              </span>
              <button
                onClick={() => setSelectedDetail(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs"
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
