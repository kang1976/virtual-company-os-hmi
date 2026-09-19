// frontend/src/components/ledgers/LedgerViewer.tsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  BookOpen,
  Folder,
  FolderOpen,
  FileText,
  RefreshCw,
  Copy,
  Check,
  Search,
  ChevronRight,
  ChevronDown,
  Layers,
  Terminal,
  Kanban,
  Users,
  ShieldCheck,
  FileCode,
} from 'lucide-react';
import { getLedgerTree, getLedgerFile } from '../../api/client';
import type { LedgerTree } from '../../types';

export interface LedgerViewerProps {
  initialFolder?: string;
  initialFile?: string;
  onRefreshTrigger?: number;
}

const FOLDER_CONFIG: Record<
  string,
  { name: string; desc: string; icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  PROJECTS: {
    name: '프로젝트 총괄 원장',
    desc: '사업 및 프로젝트 마스터 데이터',
    icon: Layers,
    color: 'text-sky-400',
  },
  COMMAND_LOG: {
    name: 'CEO 지시 원장',
    desc: 'CEO 하달 명령 및 원장 동기화 이력',
    icon: Terminal,
    color: 'text-amber-400',
  },
  TASK_LEDGER: {
    name: '5단계 업무 원장',
    desc: '공정별 태스크 실행 및 최종 검증 기록',
    icon: Kanban,
    color: 'text-indigo-400',
  },
  MEETING_LOG: {
    name: '에이전트 회의록',
    desc: 'COO 및 부서간 전략 협의 기록',
    icon: Users,
    color: 'text-emerald-400',
  },
  KNOWLEDGE_PATENT: {
    name: '특허 및 FTO 지식 원장',
    desc: '선행특허 조사, 청구항 분석, 회피설계 권고',
    icon: ShieldCheck,
    color: 'text-purple-400',
  },
};

/**
 * 간이 마크다운 렌더러 (Markdown 뷰어 스타일링)
 */
function renderMarkdownContent(content: string) {
  if (!content) return null;

  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBlockBuffer: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 코드 블록 토글
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        elements.push(
          <div key={`code-${i}`} className="my-3 rounded-lg bg-slate-950 p-3.5 font-mono text-xs text-sky-300 border border-slate-800 overflow-x-auto">
            <pre>{codeBlockBuffer.join('\n')}</pre>
          </div>
        );
        codeBlockBuffer = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockBuffer.push(line);
      continue;
    }

    // 빈 줄
    if (!line.trim()) {
      elements.push(<div key={`empty-${i}`} className="h-2" />);
      continue;
    }

    // 제목 1 (#)
    if (line.startsWith('# ')) {
      elements.push(
        <h1 key={`h1-${i}`} className="text-lg font-bold text-white mt-4 mb-2 pb-1.5 border-b border-slate-800 flex items-center gap-2">
          <span className="w-1.5 h-4 bg-sky-500 rounded-full inline-block" />
          {line.replace(/^#\s+/, '')}
        </h1>
      );
      continue;
    }

    // 제목 2 (##)
    if (line.startsWith('## ')) {
      elements.push(
        <h2 key={`h2-${i}`} className="text-base font-semibold text-slate-100 mt-3 mb-1.5 flex items-center gap-2">
          <span className="w-1.5 h-3 bg-indigo-500 rounded-full inline-block" />
          {line.replace(/^##\s+/, '')}
        </h2>
      );
      continue;
    }

    // 제목 3 (###)
    if (line.startsWith('### ')) {
      elements.push(
        <h3 key={`h3-${i}`} className="text-sm font-semibold text-sky-400 mt-2.5 mb-1">
          {line.replace(/^###\s+/, '')}
        </h3>
      );
      continue;
    }

    // 구분선 (---)
    if (line.trim() === '---' || line.trim() === '***') {
      elements.push(<hr key={`hr-${i}`} className="my-4 border-slate-800" />);
      continue;
    }

    // 인용문 (> )
    if (line.startsWith('> ')) {
      elements.push(
        <blockquote key={`quote-${i}`} className="my-2 pl-3 py-1 border-l-2 border-indigo-500 bg-indigo-950/20 rounded-r text-slate-300 text-xs italic">
          {line.replace(/^>\s+/, '')}
        </blockquote>
      );
      continue;
    }

    // 체크리스트 (- [x] / - [ ])
    if (/^-\s*\[([ xX])\]/.test(line)) {
      const isChecked = /^-\s*\[[xX]\]/.test(line);
      const text = line.replace(/^-\s*\[([ xX])\]\s*/, '');
      elements.push(
        <div key={`check-${i}`} className="flex items-center gap-2 text-xs py-0.5 text-slate-300">
          <input
            type="checkbox"
            checked={isChecked}
            readOnly
            className="rounded bg-slate-900 border-slate-700 text-sky-500 focus:ring-0 cursor-default"
          />
          <span className={isChecked ? 'line-through text-slate-500' : ''}>{text}</span>
        </div>
      );
      continue;
    }

    // 불릿 리스트 (- , * )
    if (/^[-*]\s+/.test(line)) {
      elements.push(
        <li key={`li-${i}`} className="ml-4 list-disc text-xs text-slate-300 py-0.5 leading-relaxed">
          {line.replace(/^[-*]\s+/, '')}
        </li>
      );
      continue;
    }

    // 테이블 행 (| ... |)
    if (line.startsWith('|') && line.endsWith('|')) {
      elements.push(
        <div key={`table-${i}`} className="font-mono text-xs text-slate-300 py-0.5 overflow-x-auto">
          {line}
        </div>
      );
      continue;
    }

    // 일반 문단
    elements.push(
      <p key={`p-${i}`} className="text-xs text-slate-300 leading-relaxed py-0.5">
        {line}
      </p>
    );
  }

  return <div className="space-y-1">{elements}</div>;
}

export const LedgerViewer: React.FC<LedgerViewerProps> = ({
  initialFolder,
  initialFile,
  onRefreshTrigger = 0,
}) => {
  const [tree, setTree] = useState<LedgerTree | null>(null);
  const [loadingTree, setLoadingTree] = useState<boolean>(false);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(initialFolder || 'COMMAND_LOG');
  const [selectedFile, setSelectedFile] = useState<string | null>(initialFile || null);
  const [fileContent, setFileContent] = useState<string>('');
  const [loadingFile, setLoadingFile] = useState<boolean>(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [mobileTab, setMobileTab] = useState<'tree' | 'content'>('tree');
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({
    PROJECTS: true,
    COMMAND_LOG: true,
    TASK_LEDGER: true,
    MEETING_LOG: true,
    KNOWLEDGE_PATENT: true,
  });

  // 장부 트리 로드
  const fetchTree = async () => {
    setLoadingTree(true);
    try {
      const data = await getLedgerTree();
      setTree(data);

      // 선택된 폴더나 파일이 없을 때 기본 선택
      if (!selectedFile) {
        for (const [folder, files] of Object.entries(data)) {
          if (files && files.length > 0) {
            setSelectedFolder(folder);
            setSelectedFile(files[0]);
            break;
          }
        }
      }
    } catch (err: any) {
      console.error('원장 트리 조회 실패:', err);
    } finally {
      setLoadingTree(false);
    }
  };

  useEffect(() => {
    fetchTree();
  }, [onRefreshTrigger]);

  // 파일 내용 로드
  const fetchFile = async (folder: string, file: string) => {
    setLoadingFile(true);
    setFileError(null);
    try {
      const res = await getLedgerFile(folder, file);
      setFileContent(res.content);
    } catch (err: any) {
      setFileError(err.message || '파일 내용을 불러오지 못했습니다.');
      setFileContent('');
    } finally {
      setLoadingFile(false);
    }
  };

  useEffect(() => {
    if (selectedFolder && selectedFile) {
      fetchFile(selectedFolder, selectedFile);
    }
  }, [selectedFolder, selectedFile]);

  // 폴더 토글
  const toggleFolder = (folderKey: string) => {
    setOpenFolders((prev) => ({
      ...prev,
      [folderKey]: !prev[folderKey],
    }));
  };

  // 클립보드 복사
  const handleCopy = () => {
    if (!fileContent) return;
    navigator.clipboard.writeText(fileContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 검색 필터링된 트리
  const filteredFolders = useMemo<Record<string, string[]>>(() => {
    if (!tree) return {};
    if (!searchQuery.trim()) {
      return tree as Record<string, string[]>;
    }

    const query = searchQuery.toLowerCase();
    const result: Record<string, string[]> = {
      PROJECTS: [],
      COMMAND_LOG: [],
      TASK_LEDGER: [],
      MEETING_LOG: [],
      KNOWLEDGE_PATENT: [],
    };

    Object.entries(tree).forEach(([folder, files]) => {
      const fileList = Array.isArray(files) ? files : [];
      const matchingFiles = fileList.filter((f) =>
        f.toLowerCase().includes(query)
      );
      if (matchingFiles.length > 0 || folder.toLowerCase().includes(query)) {
        result[folder] = matchingFiles.length > 0 ? matchingFiles : fileList;
      }
    });

    return result;
  }, [tree, searchQuery]);

  return (
    <div className="bg-white dark:bg-slate-900/90 border-2 border-slate-300 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden flex flex-col md:flex-row h-[650px] sm:h-[750px] backdrop-blur-sm">
      {/* 모바일 화면 전용 상단 탭 전환 바 (md 미만에서만 표시) */}
      <div className="flex md:hidden border-b-2 border-slate-300 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 p-2 gap-1.5 shrink-0">
        <button
          onClick={() => setMobileTab('tree')}
          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
            mobileTab === 'tree'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-400 border border-slate-300 dark:border-slate-800'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>원장 목록</span>
        </button>
        <button
          onClick={() => setMobileTab('content')}
          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
            mobileTab === 'content'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-400 border border-slate-300 dark:border-slate-800'
          }`}
        >
          <FileCode className="w-3.5 h-3.5" />
          <span className="truncate max-w-[130px]">
            {selectedFile ? selectedFile : '본문 열람'}
          </span>
        </button>
      </div>

      {/* 좌측 패널: 4대 장부 폴더 트리 탐색기 */}
      <div
        className={`w-full md:w-80 lg:w-96 border-b-2 md:border-b-0 md:border-r-2 border-slate-300 dark:border-slate-800 flex-col bg-slate-50 dark:bg-slate-950/70 ${
          mobileTab === 'tree' ? 'flex flex-1 md:flex-initial' : 'hidden md:flex'
        }`}
      >
        {/* 탐색기 상단 헤더 & 새로고침 */}
        <div className="p-4 border-b-2 border-slate-300 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <BookOpen className="w-4 h-4" />
            <span className="font-bold text-sm text-slate-900 dark:text-white">4대 장부 탐색기</span>
          </div>
          <button
            onClick={fetchTree}
            disabled={loadingTree}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors disabled:opacity-50"
            title="원장 트리 새로고침"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingTree ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>

        {/* 파일 검색 바 */}
        <div className="px-3 pt-3 pb-2 border-b border-slate-800/80">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="원장 파일 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-2.5 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* 폴더 & 파일 트리 리스트 */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin">
          {tree ? (
            Object.entries(filteredFolders).map(([folderKey, files]) => {
              const cfg = FOLDER_CONFIG[folderKey] || {
                name: folderKey,
                desc: '',
                icon: Folder,
                color: 'text-slate-400',
              };
              const isOpen = !!openFolders[folderKey];
              const fileCount = files ? files.length : 0;

              return (
                <div key={folderKey} className="space-y-0.5">
                  {/* 폴더 헤더 행 */}
                  <div
                    onClick={() => toggleFolder(folderKey)}
                    className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-slate-900 text-slate-300 hover:text-white cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center gap-2 truncate">
                      {isOpen ? (
                        <ChevronDown className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300 shrink-0" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300 shrink-0" />
                      )}
                      {isOpen ? (
                        <FolderOpen className={`w-4 h-4 ${cfg.color} shrink-0`} />
                      ) : (
                        <Folder className={`w-4 h-4 ${cfg.color} shrink-0`} />
                      )}
                      <span className="text-xs font-semibold truncate" title={cfg.name}>
                        {cfg.name}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                      {fileCount}
                    </span>
                  </div>

                  {/* 하위 파일 목록 */}
                  {isOpen && (
                    <div className="ml-5 pl-2 border-l border-slate-800 space-y-0.5">
                      {files && files.length > 0 ? (
                        files.map((file: string) => {
                          const isSelected = selectedFolder === folderKey && selectedFile === file;
                          return (
                            <div
                              key={file}
                              onClick={() => {
                                setSelectedFolder(folderKey);
                                setSelectedFile(file);
                                setMobileTab('content');
                              }}
                              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs cursor-pointer transition-all ${
                                isSelected
                                  ? 'bg-emerald-950/60 text-emerald-300 font-medium border border-emerald-800/60 shadow-sm'
                                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                              }`}
                              title={file}
                            >
                              <FileText className={`w-3.5 h-3.5 ${isSelected ? 'text-emerald-400' : 'text-slate-500'} shrink-0`} />
                              <span className="truncate font-mono text-[11px]">{file}</span>
                            </div>
                          );
                        })
                      ) : (
                        <div className="px-2 py-1 text-[11px] text-slate-600 italic">
                          기록된 파일 없음
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="p-4 text-center text-xs text-slate-500">
              원장 목록을 불러오는 중입니다...
            </div>
          )}
        </div>

        {/* 하단 동기화 상태 풋노트 */}
        <div className="p-3 border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
          <span>이중 원장 (DB + Markdown)</span>
          <span className="text-emerald-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            실시간 동기화
          </span>
        </div>
      </div>

      {/* 우측 패널: 마크다운 뷰어 */}
      <div
        className={`flex-1 flex-col bg-slate-900/50 ${
          mobileTab === 'content' ? 'flex' : 'hidden md:flex'
        }`}
      >
        {/* 파일 뷰어 상단 헤더 */}
        <div className="p-3 sm:p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            {/* 모바일 전용 목록으로 돌아가기 버튼 */}
            <button
              onClick={() => setMobileTab('tree')}
              className="md:hidden p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs shrink-0"
              title="원장 목록으로 돌아가기"
            >
              <ChevronRight className="w-4 h-4 rotate-180" />
            </button>
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shrink-0">
              <FileCode className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-white text-sm font-mono truncate max-w-[200px] sm:max-w-md">
                  {selectedFile || '원장 파일을 선택하세요'}
                </h3>
                {selectedFolder && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                    {selectedFolder}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono mt-0.5">
                <span>포맷: Markdown (.md)</span>
                <span>·</span>
                <span>글자 수: {fileContent.length.toLocaleString()}자</span>
              </div>
            </div>
          </div>

          {/* 복사 & 새로고침 액션 */}
          {selectedFile && (
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                onClick={handleCopy}
                disabled={!fileContent}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs border border-slate-700 transition-colors disabled:opacity-50"
                title="원장 본문 클립보드 복사"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400 font-medium">복사됨!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>내용 복사</span>
                  </>
                )}
              </button>

              <button
                onClick={() => selectedFolder && selectedFile && fetchFile(selectedFolder, selectedFile)}
                disabled={loadingFile}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors disabled:opacity-50"
                title="현재 파일 새로고침"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingFile ? 'animate-spin text-emerald-400' : ''}`} />
              </button>
            </div>
          )}
        </div>

        {/* 파일 본문 뷰어 */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
          {loadingFile ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
              <span>원장 내용을 불러오는 중입니다...</span>
            </div>
          ) : fileError ? (
            <div className="h-full flex flex-col items-center justify-center text-rose-400 text-xs gap-2 p-6 text-center">
              <span>{fileError}</span>
            </div>
          ) : selectedFile ? (
            <div className="max-w-4xl mx-auto bg-slate-950/70 p-6 rounded-xl border border-slate-800/80 shadow-inner">
              {renderMarkdownContent(fileContent)}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs gap-3 p-6 text-center">
              <BookOpen className="w-10 h-10 text-slate-700" />
              <p className="text-slate-400 font-medium">
                왼쪽 탐색기에서 열람할 원장 파일을 선택하세요.
              </p>
              <p className="text-slate-600 max-w-sm">
                지시 원장, 업무 원장, 회의록, 특허 원장 등 4대 장부의 실시간 기록을 마크다운 형식으로 즉시 확인할 수 있습니다.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
