// 실시간 사용자 클릭 및 인터랙션 추적기 (Click Tracker)
(function () {
  console.log('🖱️ [ClickTracker] 실시간 사용자 클릭 추적기가 활성화되었습니다.');

  // 클릭 시각화 Ripple 스타일 주입
  const style = document.createElement('style');
  style.textContent = `
    .click-tracker-ripple {
      position: fixed;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: rgba(255, 61, 0, 0.4);
      border: 2px solid #ff3d00;
      transform: translate(-50%, -50%) scale(0.5);
      pointer-events: none;
      z-index: 999999;
      animation: clickRippleAnim 0.6s ease-out forwards;
    }
    @keyframes clickRippleAnim {
      0% { transform: translate(-50%, -50%) scale(0.5); opacity: 1; }
      100% { transform: translate(-50%, -50%) scale(2.2); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
  function getZoomFactor() {
    const rawZoom = document.body.style.zoom || getComputedStyle(document.body).zoom;
    const zoom = parseFloat(rawZoom) || 1;
    return zoom > 0 ? zoom : 1;
  }

  function createRipple(x, y) {
    const zoom = getZoomFactor();
    const adjustedX = x / zoom;
    const adjustedY = y / zoom;
    const ripple = document.createElement('div');
    ripple.className = 'click-tracker-ripple';
    ripple.style.left = adjustedX + 'px';
    ripple.style.top = adjustedY + 'px';
    document.body.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
  }

  function getElementSummary(el) {
    if (!el) return 'unknown';
    const tag = el.tagName ? el.tagName.toLowerCase() : 'element';
    const id = el.id ? `#${el.id}` : '';
    const cls = el.className && typeof el.className === 'string' ? `.${el.className.trim().split(/\s+/).join('.')}` : '';
    let text = (el.innerText || el.textContent || el.value || '').trim();
    if (text.length > 40) text = text.substring(0, 40) + '...';
    return `${tag}${id}${cls} [${text.replace(/\s+/g, ' ')}]`;
  }

  document.addEventListener('pointerdown', (e) => {
    try {
      createRipple(e.clientX, e.clientY);
      const target = e.target;
      const summary = getElementSummary(target);
      const payload = {
        time: new Date().toLocaleTimeString('ko-KR', { hour12: false }),
        page: location.pathname,
        x: Math.round(e.clientX),
        y: Math.round(e.clientY),
        target: summary,
        tag: target.tagName,
        id: target.id || '',
        class: typeof target.className === 'string' ? target.className : '',
        text: (target.innerText || target.textContent || target.value || '').trim().substring(0, 50),
      };

      // 서버로 실시간 전송
      fetch('/api/debug/click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(() => {});
    } catch (err) {
      console.warn('ClickTracker error:', err);
    }
  }, true);
})();
