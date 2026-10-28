/*
 * オフライン起動と、パソコン → スマホのデータ受け渡しの通し確認。
 *
 *   npm run build && npm run preview   # 別ターミナル
 *   node e2e/offline-transfer.cjs [URL] [スクリーンショット出力先]
 */
const { chromium } = require('playwright');
const fs = require('fs');

const URL = process.argv[2] || 'http://localhost:4173/';
const OUT = process.argv[3] || 'e2e/screenshots';
fs.mkdirSync(OUT, { recursive: true });

let failures = 0;
function check(label, ok, detail = '') {
  console.log(`${ok ? '✓' : '✗'} ${label}${detail ? ` (${detail})` : ''}`);
  if (!ok) failures++;
}

(async () => {
  const browser = await chromium.launch();
  const errors = [];

  // ---- オフライン起動
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(URL);
    await page.getByText('オフライン対応済み').waitFor({ timeout: 15000 });
    check('初回表示でオフライン対応済みになる', true);
    await page.getByText('新しいイベントを作成').click();
    await page.getByRole('radio', { name: /サークル/ }).click();

    await ctx.setOffline(true);
    await page.reload();
    const visible = (loc) => loc.waitFor({ timeout: 5000 }).then(() => true, () => false);
    check('電波なしで再読み込みしても起動する', await visible(page.getByText('バトル形式を選択')));
    const ev = await page.evaluate(() => JSON.parse(localStorage.getItem('dance-mc-panel/v1')).events.length);
    check('電波なしでも入力済みのデータが残る', ev === 1);

    // 新しいタブで開き直しても起動する（ホーム画面から起動する場合に相当）
    const page2 = await ctx.newPage();
    await page2.goto(URL);
    check('電波なしで新しく開いても起動する', await visible(page2.getByText('バトル形式を選択')));
    await ctx.close();
  }

  // ---- パソコンで入力 → 転送コード → スマホで受け取り
  let code;
  {
    const pc = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await pc.grantPermissions(['clipboard-read', 'clipboard-write']);
    const page = await pc.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(URL);
    await page.getByText('新しいイベントを作成').click();
    await page.getByRole('radio', { name: /1 vs 1/ }).click();
    await page.getByText('次へ →').click();
    await page.locator('.field', { hasText: 'イベント名' }).locator('input').fill('関東予選 2026');
    await page.getByText('次へ →').click();

    // スプレッドシートから貼り付けた想定の一括入力
    await page.getByText('対戦カードをまとめて入力').click();
    await page.locator('.bulk-text').fill('KAZANE vs Taisuke\nSHIGEKIX\tAyumi\nRIKU, Hiro');
    await page.getByRole('button', { name: '試合に反映する' }).click();
    check('対戦カードの一括入力で3試合になる', (await page.locator('.match-card').count()) === 3);
    await page.screenshot({ path: `${OUT}/pc-bulk.png`, fullPage: true });

    await page.getByText('次へ →').click();
    await page.getByRole('button', { name: /この内容をスマホへ送る/ }).click();
    await page.getByRole('button', { name: /転送コードをコピー/ }).click();
    code = await page.evaluate(() => navigator.clipboard.readText());
    check('転送コードをコピーできる', /^DMCP1z\./.test(code), `${code.length}文字`);
    check('QRコードが表示される', (await page.locator('.transfer-qr svg').count()) === 1);
    await page.screenshot({ path: `${OUT}/pc-send.png` });
    await pc.close();
  }
  {
    const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const page = await phone.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(URL);
    await page.getByRole('button', { name: /受け取る/ }).click();
    // LINE で送ると前後に文章が付くことがある
    await page.locator('.modal textarea').fill(`送るね\n${code}\n`);
    await page.screenshot({ path: `${OUT}/phone-receive.png` });
    await page.getByRole('button', { name: '取り込む' }).click();
    await page.getByText('関東予選 2026').first().waitFor();
    check('スマホで受け取ったイベントが一覧に出る', true);
    await page.getByText('関東予選 2026').first().click();
    await page.getByRole('button', { name: '▶ 本番画面へ' }).click();
    check('受け取った対戦カードで本番を始められる', (await page.locator('.nav-card').innerText()).includes('KAZANE vs Taisuke'));

    // パソコンで直して送り直した場合: 上書きの確認が出る
    await page.getByLabel('メニュー（設定・編集）').click();
    await page.getByText(/イベント一覧へ/).click();
    await page.getByRole('button', { name: /受け取る/ }).click();
    await page.locator('.modal textarea').fill(code);
    await page.getByRole('button', { name: '取り込む' }).click();
    await page.getByRole('button', { name: '上書きする' }).click();
    check('送り直しは上書きでき、重複しない', (await page.locator('.event-item').count()) === 1);
    await phone.close();
  }

  // ---- リンク（QRコード）から開いて取り込み
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${URL}#import=${code}`);
    await page.getByText('関東予選 2026').first().waitFor();
    check('リンクから開くと取り込まれる', true);
    check('取り込み後はURLからコードが消える', !page.url().includes('import='));
    await ctx.close();
  }

  check('ブラウザのエラーなし', errors.length === 0, errors.join(' | '));
  await browser.close();
  console.log(failures ? `\n${failures}件の確認に失敗しました` : '\nすべての確認に成功しました');
  process.exit(failures ? 1 : 0);
})();
