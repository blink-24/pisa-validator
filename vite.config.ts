import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages는 하위 경로(/<저장소이름>/)에서 서비스된다.
// 배포 저장소 이름이 다르면 BASE_PATH 환경변수로 덮어쓴다.
// 예: BASE_PATH=/my-repo/ npm run build
const base = process.env.BASE_PATH ?? '/pisa-validator/';

// https://vitejs.dev/config/
export default defineConfig({
  base,
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
