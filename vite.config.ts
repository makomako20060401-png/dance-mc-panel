import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 相対パスでビルドし、任意のサブディレクトリや静的ホスティングに置けるようにする
export default defineConfig({
  base: './',
  plugins: [react()],
});
