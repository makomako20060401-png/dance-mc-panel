// dist/ のビルド結果を、CSS・JSを埋め込んだ1枚のHTMLにまとめる。
// ファイル1つで配布・ホスティングしたい場合に使う（npm run build:single）。
// 出力: dist-single/index.html （<html>/<head>/<body> を含まない本文のみ）
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = 'dist';
const html = readFileSync(join(dist, 'index.html'), 'utf8');

const cssPath = html.match(/<link rel="stylesheet"[^>]*href="\.\/([^"]+)"/)?.[1];
const jsPath = html.match(/<script type="module"[^>]*src="\.\/([^"]+)"/)?.[1];
if (!cssPath || !jsPath) throw new Error('dist/index.html から CSS/JS が見つかりません。先に npm run build を実行してください');

const css = readFileSync(join(dist, cssPath), 'utf8');
// インライン script を途中で閉じないようにエスケープ
const js = readFileSync(join(dist, jsPath), 'utf8').replace(/<\/script/gi, '<\\/script');
const title = html.match(/<title>.*<\/title>/)?.[0] ?? '<title>ダンスバトル MCパネル</title>';

const out = `${title}
<meta name="theme-color" content="#ffffff">
<meta name="description" content="ダンスバトルMC専用コントロールパネル">
<style>${css}</style>
<div id="root"></div>
<script type="module">${js}</script>
`;

mkdirSync('dist-single', { recursive: true });
writeFileSync('dist-single/index.html', out);
console.log(`dist-single/index.html (${(out.length / 1024).toFixed(0)} KB)`);
