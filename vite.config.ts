import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * ビルド結果の全ファイルを事前キャッシュする Service Worker を生成する。
 * ファイル一覧とバージョン（内容のハッシュ）を埋め込むので、
 * 初回表示だけでオフライン起動に必要なファイルがすべて端末に保存される。
 */
function serviceWorker(): Plugin {
  return {
    name: 'dance-mc-service-worker',
    apply: 'build',
    // index.html はビルドの終盤に出力されるため、最後に実行する
    enforce: 'post',
    generateBundle(_, bundle) {
      const files = Object.keys(bundle).filter((f) => !f.endsWith('.map'));
      const assets = [...new Set(['./', './index.html', ...files.map((f) => `./${f}`), './manifest.webmanifest', './icon.svg'])];
      const version = createHash('sha256').update(files.sort().join('|')).digest('hex').slice(0, 10);
      const source = readFileSync('sw/sw.template.js', 'utf8')
        .replace('__ASSETS__', JSON.stringify(assets))
        .replace('__VERSION__', version);
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

/** 画面に出すバージョン（ビルド日 + コミット）。どの版が入っているか確認できるようにする */
function appVersion(): string {
  const d = new Date();
  const date = `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
  try {
    return `${date} (${execSync('git rev-parse --short HEAD').toString().trim()})`;
  } catch {
    return date;
  }
}

// 相対パスでビルドし、任意のサブディレクトリや静的ホスティングに置けるようにする
export default defineConfig({
  base: './',
  define: { __APP_VERSION__: JSON.stringify(appVersion()) },
  plugins: [react(), serviceWorker()],
});
