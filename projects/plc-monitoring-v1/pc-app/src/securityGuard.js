'use strict';

/**
 * OT/ICS 산업 제어 시스템 보안 가드 미들웨어 (Security Guard)
 * - OWASP Top 10 & IEC 62443 산업 제어 시스템 보안 지침 반영
 * 1. 보안 응답 헤더 자동 적용 (Clickjacking, MIME Sniffing, XSS 방지)
 * 2. 원격 비인가 쓰기 차단 (로컬 루프백 검증 및 Remote Write Guard)
 * 3. 치명적 제어 명령(CPU 정지/밸브 강제구동) 안전 인터록(Command Guard)
 * 4. FINS 통신 DoS 방지 초당 쓰기 Rate Limiter
 * 5. 보안 감사 로그(Security Audit Log) 자동 기록
 */

const fs = require('fs');
const path = require('path');

const logDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}
const auditLogFile = path.join(logDir, 'security_audit.log');

function writeAuditLog(entry) {
  const line = `[${new Date().toISOString()}] [${entry.level || 'INFO'}] [IP:${entry.ip}] ${entry.action} - ${entry.details || ''}\n`;
  try {
    fs.appendFileSync(auditLogFile, line, 'utf8');
  } catch (err) {
    console.error('보안 감사 로그 기록 실패:', err.message);
  }
}

// IP별 쓰기 속도 제한 (Rate Limiting)
const writeRateLimits = new Map(); // ip -> { count, resetTime }
const RATE_LIMIT_WINDOW_MS = 1000;
const MAX_WRITES_PER_WINDOW = 30; // 초당 최대 30회 쓰기

function checkRateLimit(ip) {
  const now = Date.now();
  let record = writeRateLimits.get(ip);
  if (!record || now > record.resetTime) {
    record = { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS };
    writeRateLimits.set(ip, record);
    return true;
  }
  record.count += 1;
  return record.count <= MAX_WRITES_PER_WINDOW;
}

// 클라이언트 IP 추출 함수 (프록시 고려)
function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || req.ip || 'unknown';
}

function isLoopbackIp(ip) {
  return (
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip === '::ffff:127.0.0.1' ||
    ip === 'localhost'
  );
}

/**
 * 1. 보안 헤더 미들웨어
 */
function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
}

/**
 * 2. 쓰기 제어 엔드포인트 보안 가드 미들웨어
 * - PLC 메모리 쓰기, CPU 운전모드 변경, 메인 시퀀스 변경 등 위험 작업 보호
 */
function writeSecurityGuard(options = {}) {
  const allowRemoteWrite = options.allowRemoteWrite ?? true; // 기본 true (설정 변경 가능)

  return (req, res, next) => {
    // GET/HEAD/OPTIONS 등 안전한 메서드는 통과
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return next();
    }

    const ip = getClientIp(req);
    const isLocal = isLoopbackIp(ip);

    // Rate Limit 체크
    if (!checkRateLimit(ip)) {
      writeAuditLog({
        level: 'WARN',
        ip,
        action: 'RATE_LIMIT_EXCEEDED',
        details: `Path: ${req.originalUrl}, Writes exceeded ${MAX_WRITES_PER_WINDOW}/sec`,
      });
      return res.status(429).json({
        ok: false,
        error: '요청 빈도가 너무 높습니다. 잠시 후 다시 시도하십시오. (FINS 보호 제한)',
      });
    }

    // 원격 접속에서의 치명적 설정 변경 차단 (allowRemoteWrite가 false인 경우)
    if (!allowRemoteWrite && !isLocal) {
      writeAuditLog({
        level: 'SECURITY_ALERT',
        ip,
        action: 'REMOTE_WRITE_BLOCKED',
        details: `Path: ${req.originalUrl}`,
      });
      return res.status(403).json({
        ok: false,
        error: '원격 접속에서의 제어 명령이 시스템 보안 설정에 의해 차단되었습니다.',
      });
    }

    // 치명적 명령(CPU PROGRAM 모드 전환 - 공장 셧다운) 안전 인터록 확인
    if (req.originalUrl.includes('/plc/mode') && req.body?.mode === 'PROGRAM') {
      if (!req.body?.confirmed) {
        writeAuditLog({
          level: 'WARN',
          ip,
          action: 'CPU_STOP_INTERLOCK_TRIGGERED',
          details: 'PLC CPU를 정지(PROGRAM)하려면 confirmed: true 플래그가 필요합니다.',
        });
        return res.status(400).json({
          ok: false,
          error: 'PLC CPU 모드를 정지(PROGRAM)로 변경하려면 2단계 안전 확인(confirmed: true)이 필요합니다.',
          requireConfirm: true,
        });
      }
    }

    // 감사 로그 기록
    writeAuditLog({
      level: 'INFO',
      ip,
      action: `WRITE_${req.method}`,
      details: `Path: ${req.originalUrl}, BodyKeys: ${Object.keys(req.body || {}).join(',')}`,
    });

    next();
  };
}

module.exports = {
  securityHeaders,
  writeSecurityGuard,
  writeAuditLog,
  getClientIp,
};
