import { defineConfig } from 'vite';

// 이 grid-app/ 폴더는 plc-monitoring-usb/ 프로젝트 루트 바로 아래,
// src/, public/ 과 같은 레벨에 위치한다고 가정합니다.
//   plc-monitoring-usb/
//     src/            (기존 서버 코드)
//     public/         (기존 메인 화면 + 빌드된 grid/ 가 여기 들어감)
//     grid-app/        (이 Vite 프로젝트, 여기서 npm run build)
//
// 빌드하면 public/grid/ 에 정적 파일이 생성되고,
// 메인 서버(express.static)가 그대로 /grid/ 경로로 서빙합니다.
export default defineConfig({
  base: '/grid/',
  build: {
    outDir: '../public/grid',
    emptyOutDir: true,
  },
  server: {
    // 개발 중 백엔드 API(/api/..., ws)는 메인 서버(기본 3000포트)로 프록시
    proxy: {
      '/api': 'http://localhost:3000',
      '/ws': { target: 'ws://localhost:3000', ws: true },
    },
  },
});
