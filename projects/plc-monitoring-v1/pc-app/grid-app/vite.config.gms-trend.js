import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// GMS 조작화면(public/gms.html)의 TREND 태그 체크리스트에 임베드할 Univer 위젯 빌드.
// vite.config.trend.js(모니터링 페이지용, 12열 변수 정의 그리드)와 출력 위치를 분리해야
// 서로 emptyOutDir로 상대방 산출물을 지우지 않는다 - `npm run build:gms-trend`로 실행한다.
//   grid-app/src/gms-trend-widget.js  →  public/gms-trend-grid/gms-trend-widget.js (+ css)
// gms.html이 이 파일을 <script type="module">로 직접 로드해서 쓴다.
export default defineConfig({
  base: '/gms-trend-grid/',
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    'process.env': '{}',
  },
  build: {
    outDir: '../public/gms-trend-grid',
    emptyOutDir: true,
    cssCodeSplit: false,
    lib: {
      entry: fileURLToPath(new URL('./src/gms-trend-widget.js', import.meta.url)),
      name: 'GmsTrendGrid',
      formats: ['es'],
      fileName: () => 'gms-trend-widget.js',
    },
  },
});
