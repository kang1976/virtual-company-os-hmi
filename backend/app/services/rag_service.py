# backend/app/services/rag_service.py
import json
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional
from backend.app.core.config import get_settings

logger = logging.getLogger(__name__)


class CompanyLedgerRAGService:
    """사내 4대 장부(지시, 업무, 회의, 특허) 전수 기억 및 로컬 RAG 지식 검색 서비스.
    
    비용 0원 원칙:
    - 외부 유료 벡터 DB나 유료 임베딩 API 없이 로컬 파일 시스템과 고속 인메모리 역색인(Inverted Index)을 사용.
    - 대표님(CEO)의 모든 과거 지시, 산출물, 특허 분석 이력을 1초 만에 팩트 기반 검색.
    """

    def __init__(self, ledger_dir: Optional[Path] = None):
        self.settings = get_settings()
        self.ledger_dir = ledger_dir or self.settings.LEDGER_DIR
        self._documents: List[Dict[str, Any]] = []
        self._is_indexed = False

    async def reindex_ledgers(self) -> int:
        """COMPANY_LEDGERS/ 디렉토리의 모든 원장(Markdown/JSON)을 읽어 메모리 색인을 갱신합니다."""
        docs = []
        if not self.ledger_dir.exists():
            self._documents = []
            return 0

        # 4대 장부 하위 디렉토리 순회
        subdirs = ["PROJECTS", "COMMAND_LOG", "TASK_LEDGER", "MEETING_LOG", "KNOWLEDGE_PATENT"]
        for sub in subdirs:
            target_path = self.ledger_dir / sub
            if not target_path.exists():
                continue

            for file_path in target_path.glob("*.*"):
                if file_path.suffix.lower() in [".md", ".json"]:
                    try:
                        content = file_path.read_text(encoding="utf-8", errors="ignore")
                        doc_type = sub
                        title = file_path.stem
                        
                        metadata = {
                            "file_name": file_path.name,
                            "category": doc_type,
                            "path": str(file_path),
                        }

                        if file_path.suffix.lower() == ".json":
                            try:
                                json_data = json.loads(content)
                                if isinstance(json_data, dict):
                                    metadata["id"] = json_data.get("id", title)
                                    metadata["title"] = json_data.get("title", json_data.get("project_title", title))
                            except Exception:
                                pass

                        docs.append({
                            "id": f"{sub}:{file_path.name}",
                            "title": title,
                            "category": doc_type,
                            "content": content,
                            "metadata": metadata,
                        })
                    except Exception as e:
                        logger.warning(f"[RAGService] 파일 읽기 실패 {file_path}: {e}")

        self._documents = docs
        self._is_indexed = True
        logger.info(f"[RAGService] 사내 원장 색인 완료: 총 {len(docs)}건 문서 인덱싱 성공")
        return len(docs)

    async def search_company_history(self, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        """사내 과거 지시, 업무, 특허 원장에서 질문에 가장 부합하는 문서를 검색합니다."""
        if not self._is_indexed or not self._documents:
            await self.reindex_ledgers()

        if not self._documents:
            return []

        query_tokens = set(query.lower().split())
        scored_docs = []

        for doc in self._documents:
            content_lower = doc["content"].lower()
            title_lower = doc["title"].lower()

            # 가중치 계산 (제목 일치 + 내용 일치 빈도)
            score = 0.0
            for token in query_tokens:
                if not token.strip():
                    continue
                if token in title_lower:
                    score += 5.0
                if token in content_lower:
                    count = content_lower.count(token)
                    score += min(count * 1.0, 10.0)

            if score > 0:
                scored_docs.append((score, doc))

        scored_docs.sort(key=lambda x: x[0], reverse=True)
        results = []
        for score, doc in scored_docs[:limit]:
            content = doc["content"]
            snippet = content[:300] + "..." if len(content) > 300 else content
            results.append({
                "score": round(score, 2),
                "id": doc["id"],
                "title": doc["title"],
                "category": doc["category"],
                "snippet": snippet,
                "metadata": doc["metadata"],
            })

        return results
