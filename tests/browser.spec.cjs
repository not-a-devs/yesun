const { test, expect } = require('@playwright/test');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const AxeBuilder = require('@axe-core/playwright').default;
const KEY = 'campus-transfer-check:v1';
const sample = overrides => ({ id:'one', name:'첫 수업', day:'mon', start:'09:00', end:'10:00', building:'A', ...overrides });

async function loadClasses(page, classes) {
  await page.addInitScript(({ key, classes }) => {
    if (!sessionStorage.getItem('test-seeded')) {
      localStorage.setItem(key, JSON.stringify({ version:1, classes }));
      sessionStorage.setItem('test-seeded', 'yes');
    }
  }, { key:KEY, classes });
  await page.goto('./');
}
async function fillClass(page, { name='테스트 수업', day='mon', start='15:00', end='16:00', building='C' } = {}) {
  await page.locator('#class-name').fill(name);
  await page.locator(`input[name="day"][value="${day}"]`).check();
  await page.locator('#class-start').fill(start);
  await page.locator('#class-end').fill(end);
  await page.locator('#class-building').selectOption(building);
}
async function saveForm(page) {
  await page.locator('#save-class').click();
  await expect(page.locator('#screen-home')).toBeVisible();
}

test('최초 예시, 이동 계산, 부족 강조와 상세 정보', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('.class-card h3')).toHaveText(['자료구조', '웹프로그래밍', '데이터베이스']);
  await expect(page.locator('.transfer-row').first()).toContainText('여유 5분');
  await expect(page.locator('.transfer-row.warning')).toContainText('3분 부족');
  await expect(page.locator('#tightest-summary')).toContainText('3분이 부족해요.');
  await page.locator('#home-check').click();
  await expect(page.locator('.segment-card').first().locator('dd')).toHaveText(['15분', '10분', '+5분']);
  await expect(page.locator('.segment-card.warning dd')).toHaveText(['10분', '13분', '-3분']);
  await expect(page.locator('.screen:visible')).toHaveCount(1);
  await expect(page.locator('.screen')).toHaveCount(3);
});

test('수업 추가, 요일 분리, 시작 시각 정렬, 새로 고침 유지', async ({ page }) => {
  await page.goto('./');
  await page.locator('#home-add').click();
  await fillClass(page, { name:'이른 수업', start:'08:00', end:'08:50', building:'A' });
  await saveForm(page);
  await expect(page.locator('.class-card h3').first()).toHaveText('이른 수업');
  await page.reload();
  await expect(page.locator('.class-card h3')).toHaveCount(4);
  await expect(page.locator('.class-card h3').first()).toHaveText('이른 수업');
  await page.locator('#home-days [data-day="tue"]').click();
  await expect(page.locator('.class-card h3')).toHaveText(['알고리즘', '컴퓨터구조']);
  await page.locator('#home-days [data-day="wed"]').click();
  await expect(page.locator('#class-list')).toContainText('아직 등록된 수업이 없어요');
  await page.locator('#class-list .button').click();
  await expect(page.locator('[name="day"][value="wed"]')).toBeChecked();
  await fillClass(page, { name:'수요일 수업', day:'wed' });
  await saveForm(page);
  await expect(page.locator('#schedule-day')).toHaveText('수요일의 수업');
  await expect(page.locator('.class-card h3')).toHaveText(['수요일 수업']);
});

test('수정할 기존 값을 채우고 저장과 분석을 갱신한다', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('link', { name:'데이터베이스 수정', exact:true }).click();
  await expect(page.locator('#class-name')).toHaveValue('데이터베이스');
  await expect(page.locator('#class-start')).toHaveValue('11:55');
  await expect(page.locator('#class-end')).toHaveValue('13:10');
  await expect(page.locator('#class-building')).toHaveValue('D');
  await page.locator('#class-start').fill('12:00');
  await saveForm(page);
  await expect(page.locator('.transfer-row').last()).toContainText('여유 2분');
  await expect(page.locator('.transfer-row.warning')).toHaveCount(0);
  await expect(page.locator('#tightest-summary')).toContainText('2분의 여유가 있어요.');
  await page.reload();
  await page.getByRole('link', { name:'데이터베이스 수정', exact:true }).click();
  await expect(page.locator('#class-start')).toHaveValue('12:00');
});

test('삭제 취소와 삭제 확인, 분석 재계산 및 저장', async ({ page }) => {
  await page.goto('./');
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('button', { name:'웹프로그래밍 삭제', exact:true }).click();
  await expect(page.locator('.class-card')).toHaveCount(3);
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name:'웹프로그래밍 삭제', exact:true }).click();
  await expect(page.locator('.class-card')).toHaveCount(2);
  await expect(page.locator('.transfer-row')).toHaveCount(1);
  await expect(page.locator('.transfer-row')).toContainText('이동 15분');
  await page.reload();
  await expect(page.locator('.class-card')).toHaveCount(2);
});

test('모든 수업 삭제 후 새로 고침해도 예시가 생기지 않는다', async ({ page }) => {
  await page.goto('./');
  page.on('dialog', dialog => dialog.accept());
  for (const day of ['mon', 'tue']) {
    await page.locator(`#home-days [data-day="${day}"]`).click();
    await expect(page.locator(`#home-days [data-day="${day}"]`)).toHaveAttribute('aria-pressed', 'true');
    while (await page.locator('[data-delete]').count()) {
      const count = await page.locator('[data-delete]').count();
      await page.locator('[data-delete]').first().click();
      await expect(page.locator('[data-delete]')).toHaveCount(count - 1);
    }
  }
  await page.reload();
  const data = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), KEY);
  expect(data.classes).toHaveLength(0);
  await page.locator('#home-days [data-day="mon"]').click();
  await expect(page.locator('.class-card')).toHaveCount(0);
  await expect(page.locator('#class-list')).toContainText('아직 등록된 수업이 없어요');
});

test('필수 입력과 종료 시각 검증, 오류 포커스 및 저장 차단', async ({ page }) => {
  await page.goto('./');
  await page.locator('#home-add').click();
  await page.locator('#save-class').click();
  await expect(page.locator('#error-name')).toBeVisible();
  await expect(page.locator('#error-start')).toBeVisible();
  await expect(page.locator('#error-end')).toBeVisible();
  await expect(page.locator('#error-building')).toBeVisible();
  await expect(page.locator('#class-name')).toBeFocused();
  await fillClass(page, { name:'   ', start:'10:00', end:'09:00' });
  await page.locator('#save-class').click();
  await expect(page.locator('#error-name')).toBeVisible();
  await expect(page.locator('#error-end')).toContainText('종료 시각은 시작 시각보다 늦어야');
  await page.locator('#class-name').fill('검증 수업');
  await page.locator('#class-end').fill('10:00');
  await page.locator('#save-class').click();
  await expect(page.locator('#error-end')).toBeVisible();
  await expect(page.locator('#class-end')).toBeFocused();
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).classes.length, KEY)).toBe(5);
});

test('같은 건물 0분, 여유 0분, 수업 시간 중복을 구별한다', async ({ page }) => {
  await loadClasses(page, [sample(), sample({ id:'two', name:'두 번째', start:'10:05', end:'11:00' }), sample({ id:'three', name:'세 번째', start:'11:10', end:'12:00', building:'B' }), sample({ id:'four', name:'겹친 수업', start:'11:50', end:'13:00', building:'C' })]);
  await expect(page.locator('.transfer-row').nth(0)).toContainText('이동 0분');
  await expect(page.locator('.transfer-row').nth(1)).toContainText('여유 0분');
  await expect(page.locator('.transfer-row').nth(2)).toContainText('수업 시간 10분 중복');
  await page.locator('#nav-check').click();
  await expect(page.locator('.segment-card[data-status="tight"]')).toContainText('여유 0분');
  await expect(page.locator('.segment-card[data-status="overlap"]')).toContainText('수업 시간 중복');
  await expect(page.locator('.segment-card[data-status="overlap"] dd')).toHaveText(['-10분', '7분', '-17분']);
});

test('세 화면 이동, 취소, 브라우저 뒤로 가기와 요일 유지', async ({ page }) => {
  await page.goto('./');
  await page.locator('#home-days [data-day="tue"]').click();
  await page.locator('#nav-check').click();
  await expect(page.locator('#check-day-title')).toHaveText('화요일의 이동 구간');
  await page.goBack();
  await expect(page.locator('#schedule-day')).toHaveText('화요일의 수업');
  await page.locator('#home-add').click();
  await page.locator('#class-name').fill('저장하지 않을 수업');
  await page.locator('#form-cancel').click();
  await expect(page.locator('.class-card')).toHaveCount(2);
  await page.locator('#home-add').click();
  await page.goBack();
  await expect(page.locator('#screen-home')).toBeVisible();
  await expect(page.locator('#schedule-day')).toHaveText('화요일의 수업');
  await expect(page.locator('.screen:visible')).toHaveCount(1);
});

test('잘못된 저장 데이터를 빈 상태와 안내로 처리하고 새 수업으로 복구한다', async ({ page }) => {
  await page.addInitScript(key => {
    if (!sessionStorage.getItem('test-seeded')) { localStorage.setItem(key, '{broken'); sessionStorage.setItem('test-seeded', 'yes'); }
  }, KEY);
  await page.goto('./');
  await expect(page.locator('#storage-notice')).toContainText('저장된 시간표를 읽을 수 없어');
  await expect(page.locator('.class-card')).toHaveCount(0);
  expect(await page.evaluate(key => localStorage.getItem(key), KEY)).toBe('{broken');
  await page.locator('#home-add').click();
  await fillClass(page);
  await saveForm(page);
  await expect(page.locator('#storage-notice')).toBeHidden();
  await page.reload();
  await expect(page.locator('.class-card h3')).toHaveText(['테스트 수업']);
});

test('저장 실패 시 폼 값과 기존 데이터를 보존한다', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => { Storage.prototype.setItem = function () { throw new DOMException('Quota exceeded', 'QuotaExceededError'); }; });
  await page.locator('#home-add').click();
  await fillClass(page);
  await page.locator('#save-class').click();
  await expect(page.locator('#screen-class')).toBeVisible();
  await expect(page.locator('#class-name')).toHaveValue('테스트 수업');
  await expect(page.locator('#form-message')).toContainText('저장하지 못했어요');
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).classes.length, KEY)).toBe(5);
});

test('저장 공간 접근이 차단되어도 세 화면이 동작한다', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Access denied', 'SecurityError'); } });
  });
  await page.goto('./');
  await expect(page.locator('#storage-notice')).toContainText('저장 공간에 접근할 수 없어요');
  await page.locator('#home-add').click();
  await fillClass(page);
  await page.locator('#save-class').click();
  await expect(page.locator('#form-message')).toBeVisible();
  await page.locator('#nav-check').click();
  await expect(page.locator('#screen-check')).toBeVisible();
});

test('사용자 입력을 HTML로 실행하지 않고 긴 수업명을 표시한다', async ({ page }) => {
  const name = '<img src=x onerror=alert(1)> & 수업';
  await loadClasses(page, [sample({ name })]);
  await expect(page.locator('.class-card h3')).toHaveText(name);
  await expect(page.locator('.class-card img')).toHaveCount(0);
  await page.getByRole('link', { name:`${name} 수정`, exact:true }).click();
  await expect(page.locator('#class-name')).toHaveValue(name);
});

test('요일 선택과 폼을 키보드로 조작한다', async ({ page }) => {
  await page.goto('./');
  await page.keyboard.press('Tab');
  await expect(page.locator('.skip-link')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();
  await page.locator('#home-days [data-day="wed"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#schedule-day')).toHaveText('수요일의 수업');
  await page.locator('#home-add').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#screen-class')).toBeVisible();
  await page.locator('#class-name').focus();
  await page.keyboard.type('키보드 수업');
  await page.keyboard.press('Tab');
  await expect(page.locator('[name="day"][value="wed"]')).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('[name="day"][value="thu"]')).toBeChecked();
  await expect(page.locator('[name="day"][value="thu"]')).toBeFocused();
});

for (const width of [320, 390, 768, 1440]) {
  test(`${width}px에서 세 화면 가로 넘침 없이 주요 버튼을 사용한다`, async ({ page }) => {
    await page.setViewportSize({ width, height:900 });
    await page.goto('./');
    for (const selector of ['#home-title', '#form-title', '#check-title']) {
      if (selector === '#form-title') await page.locator('#home-add').click();
      if (selector === '#check-title') await page.locator('#nav-check').click();
      await expect(page.locator(selector)).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await expect(page.locator('.screen:visible')).toHaveCount(1);
    }
  });
}

test('정적 자원만 요청하고 런타임 오류가 없다 @pages', async ({ page, baseURL }) => {
  const errors = [];
  const requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => requests.push(request.url()));
  await page.goto('./');
  await page.locator('#home-add').click();
  await page.locator('#nav-check').click();
  await expect(page.locator('#screen-check')).toBeVisible();
  expect(errors).toEqual([]);
  expect(requests.every(url => url.startsWith(baseURL))).toBe(true);
  for (const resource of ['index.html', 'css/style.css', 'js/data.js', 'js/calculator.js', 'js/storage.js', 'js/app.js', 'favicon.svg']) {
    const response = await page.request.get(resource);
    expect(response.ok()).toBe(true);
  }
});

test('index.html을 file://로 직접 열어 추가와 새로 고침 저장이 동작한다', async ({ page }) => {
  await page.goto(pathToFileURL(path.join(__dirname, '../index.html')).href);
  await expect(page.locator('#home-title')).toBeVisible();
  await page.locator('#home-add').click();
  await fillClass(page, { name:'직접 실행 수업' });
  await saveForm(page);
  await page.reload();
  await expect(page.locator('.class-card h3').last()).toHaveText('직접 실행 수업');
});

test('모바일과 PC의 세 화면에서 접근성과 텍스트 대비를 검사한다', async ({ page }) => {
  const violations = [];
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height:900 });
    for (const [view, section] of [['home', 'home'], ['class/new', 'class'], ['check', 'check']]) {
      await page.goto(`./#${view}?day=mon`);
      await expect(page.locator(`#screen-${section}`)).toBeVisible();
      const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      violations.push(...result.violations.map(item => ({ width, view, rule:item.id, nodes:item.nodes.map(node => ({ target:node.target, summary:node.failureSummary })) })));
    }
  }
  expect(violations).toEqual([]);
});
