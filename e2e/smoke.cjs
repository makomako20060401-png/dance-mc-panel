/*
 * 実機に近い条件（タッチ・スマホ画面）での通し確認スクリプト。
 *
 *   npm run build && npm run preview   # 別ターミナル
 *   node e2e/smoke.cjs [URL] [スクリーンショット出力先]
 *
 * Playwright（npm i -D playwright && npx playwright install chromium）が必要。
 * 失敗した確認があれば終了コード 1 で終わる。
 */
const { chromium } = require('playwright');
const fs = require('fs');

const URL = process.argv[2] || 'http://localhost:4173/';
const OUT = process.argv[3] || 'e2e/screenshots';
fs.mkdirSync(OUT, { recursive: true });

const DEVICES = [
  { name: 'iphone-se', width: 375, height: 667 },
  { name: 'iphone-14', width: 390, height: 844 },
  { name: 'small-320', width: 320, height: 568 },
];

let failures = 0;
function check(label, ok, detail = '') {
  console.log(`${ok ? '✓' : '✗'} ${label}${detail ? ` (${detail})` : ''}`);
  if (!ok) failures++;
}

async function longPress(page, locator, ms = 800) {
  const box = await locator.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
}

/** 画面全体がスクロールせず、主要要素が画面内に収まっているか */
async function checkLayout(page, label) {
  const r = await page.evaluate(() => {
    const vw = innerWidth;
    const vh = innerHeight;
    const out = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return 'missing';
      const b = el.getBoundingClientRect();
      return b.left < -1 || b.right > vw + 1 || b.top < -1 || b.bottom > vh + 1 ? 'outside' : 'ok';
    };
    const small = [...document.querySelectorAll('.live button')].filter((b) => {
      const r = b.getBoundingClientRect();
      return r.height > 0 && r.height < 40 && !b.classList.contains('title-btn');
    });
    return {
      scroll: document.documentElement.scrollHeight <= vh && document.documentElement.scrollWidth <= vw,
      nav: out('.match-nav'),
      timers: out('.timer-bar'),
      middle: out('.live-middle'),
      small: small.map((b) => b.textContent.trim()).slice(0, 5),
    };
  });
  check(`${label}: ページ全体がスクロールしない`, r.scroll);
  check(`${label}: ナビ・中央・タイマーが画面内`, r.nav === 'ok' && r.middle === 'ok' && r.timers === 'ok', JSON.stringify(r));
  check(`${label}: 高さ40px未満のボタンがない`, r.small.length === 0, r.small.join(','));
}

async function setupCircle(page) {
  await page.getByText('新しいイベントを作成').click();
  await page.getByRole('radio', { name: /サークル/ }).click();
  await page.getByText('次へ →').click();
  await page.getByLabel('1試合増やす').click();
  await page.getByLabel('分').nth(0).fill('0');
  await page.getByLabel('秒').nth(0).fill('5');
  await page.getByLabel('秒').nth(1).fill('3');
  await page.getByText('次へ →').click();
  const inputs = page.getByPlaceholder('バトラー名');
  for (const n of ['KAZANE', 'Taisuke', 'SHIGEKIX', 'Ayumi', 'RIKU', 'Hiro', 'MIKI', 'Long Name Dancer']) {
    await inputs.nth(0).fill(n);
    await inputs.nth(0).press('Enter');
  }
  await inputs.nth(1).fill('Zero');
  await inputs.nth(1).press('Enter');
  await page.getByText('次へ →').click();
  await page.getByRole('button', { name: '▶ 本番画面へ' }).click();
}

(async () => {
  const browser = await chromium.launch();
  const errors = [];

  // ---- 機能の通し確認（iPhone 14 相当）
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(URL);
    await setupCircle(page);

    const btn = (name) => page.getByRole('button', { name: new RegExp('^' + name) });
    await btn('KAZANE').click();
    check('タップで NOW になる', (await btn('KAZANE').getAttribute('class')).includes('is-now'));
    await btn('Taisuke').click();
    check('前の人は「済」で残る', (await btn('KAZANE').getAttribute('class')).includes('is-danced'));

    await page.getByRole('button', { name: '元に戻す' }).click();
    check('元に戻すで前の担当者に戻る', (await btn('KAZANE').getAttribute('class')).includes('is-now'));
    check('取り消した人は未選択に戻る', (await btn('Taisuke').getAttribute('class')).includes('is-idle'));

    await btn('Taisuke').click();
    await btn('KAZANE').click();
    check('踊った人の通常タップでは担当が変わらない', (await btn('Taisuke').getAttribute('class')).includes('is-now'));

    await longPress(page, btn('KAZANE'));
    check('長押しで踊った印を解除', (await btn('KAZANE').getAttribute('class')).includes('is-idle'));
    check('他の人の解除ではタイマーが止まらない', (await btn('Taisuke').getAttribute('class')).includes('is-now'));

    await page.waitForTimeout(2500);
    check('警戒時間で警告表示', (await page.locator('.timer-personal').getAttribute('class')).includes('phase-warn'));
    await page.screenshot({ path: `${OUT}/live-warn.png` });
    await page.waitForTimeout(3000);
    check('時間切れで TIME UP 表示', (await page.locator('.timer-personal .timer-status').innerText()).includes('TIME UP'));

    // 原稿編集と名前挿入
    await page.getByRole('button', { name: '原稿を編集' }).click();
    const ta = page.locator('textarea').nth(0);
    await ta.fill('次は ');
    await page.locator('.name-chip', { hasText: 'SHIGEKIX' }).click();
    check('名前チップでカーソル位置に挿入', (await ta.inputValue()) === '次は SHIGEKIX', await ta.inputValue());
    await page.screenshot({ path: `${OUT}/live-edit.png` });
    await page.getByRole('button', { name: '保存' }).click();

    // 試合切替（スワイプ）でタイマー停止、戻っても再開しない
    const nav = await page.locator('.nav-center').boundingBox();
    await page.mouse.move(nav.x + nav.width - 10, nav.y + 20);
    await page.mouse.down();
    await page.mouse.move(nav.x + 10, nav.y + 22, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(200);
    check('スワイプで次の試合へ', (await page.locator('.nav-title').innerText()).includes('第2試合'));
    check('スワイプ後に試合一覧が開かない', (await page.locator('.modal').count()) === 0);
    await page.getByLabel('前の試合').click();
    await page.waitForTimeout(1200);
    check('戻ってもタイマーは停止のまま', !(await page.locator('.timer-personal').getAttribute('class')).includes('is-running'));

    await page.reload();
    check('再読み込み後も原稿が残る', (await page.locator('.script-text').innerText()).includes('SHIGEKIX'));
    check('再読み込み後も担当者が残る', (await btn('Taisuke').getAttribute('class')).includes('is-now'));

    await page.getByRole('button', { name: /拡大/ }).click();
    await page.screenshot({ path: `${OUT}/fullscreen.png` });
    await page.getByRole('button', { name: '✕ 閉じる' }).click();

    // 複製
    await page.getByLabel('メニュー（設定・編集）').click();
    await page.getByText(/イベント一覧へ/).click();
    await page.getByRole('button', { name: /を複製$/ }).first().click();
    check('イベントを複製できる', (await page.locator('.event-item').count()) === 2);
    await page.screenshot({ path: `${OUT}/start.png` });
    await ctx.close();
  }

  // ---- 画面サイズ別のレイアウト確認（縦・横）
  for (const d of DEVICES) {
    for (const landscape of [false, true]) {
      const viewport = landscape ? { width: d.height, height: d.width } : { width: d.width, height: d.height };
      const label = `${d.name}${landscape ? '-横' : '-縦'}`;
      const ctx = await browser.newContext({ viewport, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
      const page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(URL);
      await setupCircle(page);
      await page.getByRole('button', { name: /^KAZANE/ }).click();
      await page.waitForTimeout(300);
      await checkLayout(page, label);
      await page.screenshot({ path: `${OUT}/layout-${label}.png` });
      await ctx.close();
    }
  }

  check('ブラウザのエラーなし', errors.length === 0, errors.join(' | '));
  await browser.close();
  console.log(failures ? `\n${failures}件の確認に失敗しました` : '\nすべての確認に成功しました');
  process.exit(failures ? 1 : 0);
})();
