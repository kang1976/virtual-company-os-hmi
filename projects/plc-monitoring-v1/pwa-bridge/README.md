# PLC 원격 제어 (모바일/태블릿 PWA)

Omron CJ2H-CPU65-EIP PLC(FINS/TCP, 192.168.0.80)를 공장 내부 와이파이에서 핸드폰/태블릿으로
모니터링·제어하는 독립 프로젝트. 기존 GMS 프로젝트(`plc-monitoring ver1.0 - google`)와는
완전히 분리되어 있으며, FINS 통신 코드만 복사해서 사용한다. 자세한 배경은
[docs/00-start/PROJECT_START.md](docs/00-start/PROJECT_START.md), 아키텍처는
[docs/02-design/design.md](docs/02-design/design.md) 참고.

## 요구 사항

- Node.js 22.5 이상 (내장 `node:sqlite` 사용 — 별도 DB 설치/네이티브 빌드 불필요)

## 시작하기

```bash
npm install

# 관리자 계정 생성 (회원가입 API 없음 — 제어 시스템이라 CLI로만 생성)
node scripts/createUser.js <아이디> <비밀번호> <이름> ADMIN

# (선택) 태그 심볼 일괄 등록 — 매핑표(JSON)가 준비되면
node scripts/importTags.js <태그목록.json>

# 서버 실행
npm start
```

기본 포트 3004, PLC는 `192.168.0.80:9600`(환경변수 `PORT`, `PLC_HOST`, `PLC_PORT`로 변경 가능).

## 태그 가져오기 형식 (scripts/importTags.js)

```json
[
  { "symbol": "GMS_SEND.Program_Ver_0", "access": "read", "description": "Program Ver" },
  { "symbol": "Operation_B.Step_0", "access": "write", "description": "Side Step B 0" }
]
```

- `symbol` 필수, `access`는 `read`/`write`/`read_write` 중 하나
- `address`/`bitIndex`/`areaType`/`dataType`은 매핑표 도착 전까지 생략 가능 (schema.md §2-2)
- 쓰기 가능 태그는 기본 `risk_level='caution'`(2단계 확인 필수)로 등록됨

## 모바일에서 접속 (PWA)

**HTTPS가 필수입니다** — 평문 HTTP에서는 서비스워커 등록이 실패해 "홈 화면에 추가"가 아무 효과도 없습니다(2026-08-27 실기 검증, QA_LOG Q-025/Q-026).

1. 로컬 개발용 인증서 발급 (한 번만):
   ```bash
   winget install --id=FiloSottile.mkcert -e
   mkcert -install   # 이 PC를 신뢰 기관으로 등록 (보안 저장소 변경 — 직접 실행)
   mkdir certs && cd certs
   mkcert -cert-file server.pem -key-file server-key.pem localhost 127.0.0.1 <서버가 쓸 LAN IP들>
   ```
2. `npm start`로 서버 실행하면 `certs/`가 있으므로 자동으로 HTTPS로 기동됨
3. 모바일 브라우저로 `https://<서버IP>:3004` 접속 → 로그인 → 메뉴에서 "홈 화면에 추가" → "Add"/"Add to home screen"
4. 인증서를 신뢰하지 않은 상태(경고를 넘겨서 접속)라면 "즐겨찾기 바로가기"만 생성됨. **완전한 "앱처럼"(주소창 없음)** 실행하려면 mkcert의 루트 CA(`mkcert -CAROOT`로 위치 확인)를 해당 기기에도 설치해야 함(Android: 설정 > 보안 > 암호화 및 사용자 인증 정보 > 인증서 설치 > CA 인증서)

## 주의

- `data/app.db`는 실사용 데이터(사용자/태그/명령이력)이므로 `.gitignore`에 포함, 별도 백업 필요
- AuditLog(`/api/auditlog`)는 삭제 API가 없음 — 위변조 방지 목적
