// frontend/src/hooks/useWebSocket.ts
import { useEffect, useRef, useState, useCallback } from 'react';
import type { WebSocketEvent, WebSocketEventType } from '../types';

export type WebSocketStatus = 'CONNECTING' | 'OPEN' | 'CLOSING' | 'CLOSED';

export interface UseWebSocketOptions {
  /**
   * 커스텀 WebSocket URL (기본값: 현재 호스트의 /ws 또는 VITE_WS_URL)
   */
  url?: string;
  /**
   * 재연결 대기 시간 (ms, 기본값: 3000ms)
   */
  reconnectInterval?: number;
  /**
   * 최대 재연결 시도 횟수 (기본값: 무제한, 0은 무제한)
   */
  maxReconnectAttempts?: number;
  /**
   * 모든 수신 이벤트에 대한 전역 핸들러
   */
  onEvent?: (event: WebSocketEvent) => void;
  /**
   * 연결 성공 콜백
   */
  onOpen?: () => void;
  /**
   * 연결 종료 콜백
   */
  onClose?: (event: CloseEvent) => void;
  /**
   * 에러 콜백
   */
  onError?: (error: Event) => void;
  /**
   * 마운트 시 자동 연결 여부 (기본값: true)
   */
  autoConnect?: boolean;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    url,
    reconnectInterval = 3000,
    maxReconnectAttempts = 0,
    autoConnect = true,
  } = options;

  const [status, setStatus] = useState<WebSocketStatus>('CLOSED');
  const [lastEvent, setLastEvent] = useState<WebSocketEvent | null>(null);
  const [reconnectCount, setReconnectCount] = useState<number>(0);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listenersRef = useRef<Map<string, Set<(data: any) => void>>>(new Map());
  const isManuallyClosedRef = useRef<boolean>(false);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // 기본 URL 계산
  const resolveUrl = useCallback(() => {
    if (url) return url;
    const envWsUrl = import.meta.env.VITE_WS_URL;
    if (envWsUrl) return envWsUrl;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/ws`;
  }, [url]);

  // 특정 이벤트 구독 등록/해제
  const subscribe = useCallback((eventType: WebSocketEventType, handler: (data: any) => void) => {
    if (!listenersRef.current.has(eventType)) {
      listenersRef.current.set(eventType, new Set());
    }
    const handlers = listenersRef.current.get(eventType)!;
    handlers.add(handler);

    return () => {
      handlers.delete(handler);
      if (handlers.size === 0) {
        listenersRef.current.delete(eventType);
      }
    };
  }, []);

  // 메시지 전송
  const sendMessage = useCallback((message: any) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      const payload = typeof message === 'string' ? message : JSON.stringify(message);
      socketRef.current.send(payload);
    } else {
      console.warn('[useWebSocket] 소켓이 열려있지 않아 메시지를 전송할 수 없습니다.');
    }
  }, []);

  // 연결 수행
  const connect = useCallback(() => {
    if (socketRef.current && (socketRef.current.readyState === WebSocket.OPEN || socketRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    isManuallyClosedRef.current = false;
    const targetUrl = resolveUrl();
    setStatus('CONNECTING');

    try {
      const ws = new WebSocket(targetUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        setStatus('OPEN');
        setReconnectCount(0);
        optionsRef.current.onOpen?.();
      };

      ws.onmessage = (event) => {
        try {
          const parsed: WebSocketEvent = JSON.parse(event.data);
          setLastEvent(parsed);

          // 전역 이벤트 리스너 실행
          optionsRef.current.onEvent?.(parsed);

          // 개별 이벤트 리스너 디스패치
          if (parsed && parsed.event) {
            const handlers = listenersRef.current.get(parsed.event);
            if (handlers) {
              handlers.forEach((h) => {
                try {
                  h(parsed.data);
                } catch (err) {
                  console.error(`[useWebSocket] 이벤트 [${parsed.event}] 처리기 오류:`, err);
                }
              });
            }
          }
        } catch {
          // 비-JSON 일반 텍스트 메시지
          const textEvent: WebSocketEvent<string> = {
            event: 'RAW_MESSAGE',
            data: event.data,
          };
          setLastEvent(textEvent);
          optionsRef.current.onEvent?.(textEvent);
        }
      };

      ws.onerror = (e) => {
        optionsRef.current.onError?.(e);
      };

      ws.onclose = (e) => {
        setStatus('CLOSED');
        socketRef.current = null;
        optionsRef.current.onClose?.(e);

        // 수동 종료가 아니고 재연결 조건에 부합할 때 자동 재연결
        if (!isManuallyClosedRef.current) {
          setReconnectCount((prev) => {
            const nextCount = prev + 1;
            if (maxReconnectAttempts === 0 || nextCount <= maxReconnectAttempts) {
              reconnectTimerRef.current = setTimeout(() => {
                connect();
              }, reconnectInterval);
            }
            return nextCount;
          });
        }
      };
    } catch (err) {
      console.error('[useWebSocket] WebSocket 인스턴스 생성 실패:', err);
      setStatus('CLOSED');
    }
  }, [resolveUrl, reconnectInterval, maxReconnectAttempts]);

  // 연결 수동 종료
  const disconnect = useCallback(() => {
    isManuallyClosedRef.current = true;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (socketRef.current) {
      setStatus('CLOSING');
      socketRef.current.close();
      socketRef.current = null;
    }
    setStatus('CLOSED');
  }, []);

  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      isManuallyClosedRef.current = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [autoConnect, connect]);

  return {
    isConnected: status === 'OPEN',
    status,
    lastEvent,
    reconnectCount,
    connect,
    disconnect,
    sendMessage,
    subscribe,
  };
}
