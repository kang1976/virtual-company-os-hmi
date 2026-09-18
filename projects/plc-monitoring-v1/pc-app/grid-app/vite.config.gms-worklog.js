import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// GMS 조작화면(public/gms.html)의 "작업이력" 화면에 임베드할 Univer 위젯 빌드.
// 다른 grid-app 산출물과 출력 위치를 분리해야 서로 emptyOutDir로 상대방 산출물을 지우지
// 않는다 - `npm run build:gms-worklog`로 실행한다.
//   grid-app/src/gms-worklog-widget.js  →  public/gms-worklog-grid/gms-worklog-widget.js (+ css)
// gms.html이 이 파일을 <script type="module">로 직접 로드해서 쓴다.
export default defineConfig({
  base: '/gms-worklog-grid/',
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    'process.env': '{}',
  },
  build: {
    outDir: '../public/gms-worklog-grid',
    emptyOutDir: true,
    cssCodeSplit: false,
    lib: {
      entry: fileURLToPath(new URL('./src/gms-worklog-widget.js', import.meta.url)),
      name: 'GmsWorkLogGrid',
      formats: ['es'],
      fileName: () => 'gms-worklog-widget.js',
    },
  },
});
