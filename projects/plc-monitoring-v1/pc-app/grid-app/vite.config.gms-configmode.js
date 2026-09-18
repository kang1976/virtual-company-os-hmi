import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// GMS 조작화면(public/gms.html)의 "설정모드 A/B" 화면에 임베드할 Univer 위젯 빌드.
// 다른 grid-app 산출물과 출력 위치를 분리해야 서로 emptyOutDir로 상대방 산출물을 지우지
// 않는다 - `npm run build:gms-configmode`로 실행한다.
//   grid-app/src/gms-configmode-widget.js  →  public/gms-configmode-grid/gms-configmode-widget.js (+ css)
// gms.html이 이 파일을 <script type="module">로 직접 로드해서 쓴다.
export default defineConfig({
  base: '/gms-configmode-grid/',
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    'process.env': '{}',
  },
  build: {
    outDir: '../public/gms-configmode-grid',
    emptyOutDir: true,
    cssCodeSplit: false,
    lib: {
      entry: fileURLToPath(new URL('./src/gms-configmode-widget.js', import.meta.url)),
      name: 'GmsConfigModeGrid',
      formats: ['es'],
      fileName: () => 'gms-configmode-widget.js',
    },
  },
});
