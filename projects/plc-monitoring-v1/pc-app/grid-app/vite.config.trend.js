import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// 트렌드 모니터링 페이지(public/monitoring.html)에 임베드할 Univer 위젯 번들을 만드는
// 별도 빌드. 기존 vite.config.js(그리드 페이지, 독립된 풀페이지 앱)와는 출력 위치/모드가
// 달라서 설정 파일을 분리했다 - `npm run build:trend`로 실행한다.
//   grid-app/src/trend-widget.js  →  public/trend-grid/trend-widget.js (+ css)
// monitoring.html이 이 파일을 <script type="module">로 직접 로드해서 쓴다.
export default defineConfig({
  base: '/trend-grid/',
  // 일반 앱 빌드(vite.config.js)는 process.env.NODE_ENV 등을 자동으로 치환해주지만,
  // 라이브러리 모드 빌드는 이걸 자동으로 안 해줘서 Univer 내부 의존성 중 하나가
  // "process is not defined"로 실패한다 - 직접 정의해서 채워준다.
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    'process.env': '{}',
  },
  build: {
    outDir: '../public/trend-grid',
    emptyOutDir: true,
    cssCodeSplit: false,
    lib: {
      entry: fileURLToPath(new URL('./src/trend-widget.js', import.meta.url)),
      name: 'TrendGrid',
      formats: ['es'],
      fileName: () => 'trend-widget.js',
    },
  },
});
