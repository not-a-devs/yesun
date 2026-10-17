const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function setup(raw = null, options = {}) {
  let stored = raw;
  let writes = 0;
  const localStorage = {
    getItem() { if (options.blockRead) throw new Error('Denied'); return stored; },
    setItem(key, value) { if (options.blockWrite) throw new Error('Quota exceeded'); stored = value; writes++; }
  };
  const context = vm.createContext({ window: { localStorage } });
  for (const file of ['data.js', 'calculator.js', 'storage.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', file), 'utf8'), context);
  }
  return { ...context.window, raw: () => stored, writes: () => writes };
}
const normal = (overrides = {}) => ({ id: 'one', name: '수업', day: 'mon', start: '09:00', end: '10:00', building: 'A', ...overrides });
const plain = value => JSON.parse(JSON.stringify(value));

test('시각을 정수 분으로 변환하고 잘못된 형식을 거부한다', () => {
  const { toMinutes } = setup().CampusCalculator;
  assert.equal(toMinutes('00:00'), 0);
  assert.equal(toMinutes('09:05'), 545);
  assert.equal(toMinutes('23:59'), 1439);
  for (const value of ['', '24:00', '9:00', '12:60', null, 930]) assert.ok(Number.isNaN(toMinutes(value)));
});

test('다섯 가지 필수 입력값을 검증한다', () => {
  const { validateClass } = setup().CampusCalculator;
  assert.equal(Object.keys(validateClass({})).length, 5);
  assert.equal(Object.keys(validateClass(normal())).length, 0);
  assert.ok(validateClass(normal({ name: '   ' })).name);
  assert.ok(validateClass(normal({ name: '가'.repeat(41) })).name);
  assert.ok(validateClass(normal({ day: 'sat' })).day);
  assert.ok(validateClass(normal({ building: 'E' })).building);
});

test('종료 시각이 시작보다 같거나 빠른 수업을 거부한다', () => {
  const { validateClass } = setup().CampusCalculator;
  assert.ok(validateClass(normal({ end: '09:00' })).end);
  assert.ok(validateClass(normal({ end: '08:59' })).end);
  assert.ok(validateClass(normal({ start: '23:00', end: '01:00' })).end);
});

test('이동 시간표의 모든 값과 대칭, 동일 건물 0분을 검증한다', () => {
  const { WALK_TIMES, BUILDINGS } = setup().CampusData;
  assert.deepEqual(plain(WALK_TIMES), { A: { A:0, B:10, C:8, D:15 }, B: { A:10, B:0, C:7, D:13 }, C: { A:8, B:7, C:0, D:6 }, D: { A:15, B:13, C:6, D:0 } });
  for (const a of BUILDINGS) for (const b of BUILDINGS) assert.equal(WALK_TIMES[a][b], WALK_TIMES[b][a]);
});

test('요일을 분리하고 시작 시각으로 정렬하되 원본을 바꾸지 않는다', () => {
  const { classesForDay } = setup().CampusCalculator;
  const classes = [normal({ id:'late', start:'15:00', end:'16:00' }), normal({ id:'tue', day:'tue' }), normal({ id:'early' })];
  assert.deepEqual(plain(classesForDay(classes, 'mon').map(item => item.id)), ['early', 'late']);
  assert.equal(classes[0].id, 'late');
  assert.equal(classesForDay(classes, 'wed').length, 0);
});

test('월요일 예시: 5분 여유, 3분 부족을 정확히 계산한다', () => {
  const { CampusCalculator:c, CampusData:d } = setup();
  const segments = c.analyzeDay(d.EXAMPLE_CLASSES, 'mon');
  assert.deepEqual(plain(segments.map(({ gap, walking, spare, status }) => ({ gap, walking, spare, status }))), [
    { gap:15, walking:10, spare:5, status:'safe' },
    { gap:10, walking:13, spare:-3, status:'shortage' }
  ]);
  assert.equal(c.tightest(segments).previous.name, '웹프로그래밍');
});

test('화요일 예시: C관에서 A관으로 이동 8분, 3분 부족', () => {
  const { CampusCalculator:c, CampusData:d } = setup();
  const [result] = c.analyzeDay(d.EXAMPLE_CLASSES, 'tue');
  assert.equal(result.gap, 5); assert.equal(result.walking, 8); assert.equal(result.spare, -3);
});

test('동일 건물은 이동 0분으로 계산한다', () => {
  const c = setup().CampusCalculator;
  const [result] = c.analyzeDay([normal(), normal({ id:'two', start:'10:05', end:'11:00' })], 'mon');
  assert.equal(result.walking, 0); assert.equal(result.spare, 5); assert.equal(result.status, 'safe');
});

test('공백과 이동 시간이 같으면 여유 0분이다', () => {
  const c = setup().CampusCalculator;
  const [result] = c.analyzeDay([normal(), normal({ id:'two', start:'10:10', end:'11:00', building:'B' })], 'mon');
  assert.equal(result.spare, 0); assert.equal(result.status, 'tight');
});

test('수업 중복은 단순 이동 부족과 구분한다', () => {
  const c = setup().CampusCalculator;
  const [result] = c.analyzeDay([normal(), normal({ id:'two', start:'09:45', end:'11:00', building:'B' })], 'mon');
  assert.equal(result.gap, -15); assert.equal(result.spare, -25); assert.equal(result.status, 'overlap');
});

test('가장 빠듯한 구간은 실제 여유 시간의 최솟값이다', () => {
  const c = setup().CampusCalculator;
  assert.equal(c.tightest([{ spare:-7, status:'overlap' }, { spare:-13, status:'shortage' }]).spare, -13);
  assert.equal(c.tightest([]), null);
});

test('수업이 0개 또는 1개이면 분석 구간은 없다', () => {
  const c = setup().CampusCalculator;
  assert.equal(c.analyzeDay([], 'mon').length, 0);
  assert.equal(c.analyzeDay([normal()], 'mon').length, 0);
});

test('최초 실행에만 예시 5개를 저장한다', () => {
  const env = setup();
  assert.equal(env.CampusStorage.load().classes.length, 5);
  assert.equal(env.writes(), 1);
  assert.equal(env.CampusStorage.load().classes.length, 5);
  assert.equal(env.writes(), 1);
});

test('사용자가 수정한 데이터는 다시 읽어도 유지된다', () => {
  const env = setup();
  env.CampusStorage.save([normal({ name:'수정한 수업' })]);
  assert.equal(env.CampusStorage.load().classes[0].name, '수정한 수업');
  assert.equal(JSON.parse(env.raw()).version, 1);
});

test('전체 삭제 후 다시 읽어도 빈 시간표를 유지한다', () => {
  const env = setup();
  env.CampusStorage.load();
  env.CampusStorage.save([]);
  assert.equal(env.CampusStorage.load().classes.length, 0);
  assert.equal(env.writes(), 2);
});

test('깨진 JSON 및 잘못된 스키마를 자동 덮어쓰기 없이 처리한다', () => {
  for (const raw of ['{broken', 'null', '[]', '{"version":2,"classes":[]}', '{"version":1}']) {
    const env = setup(raw);
    assert.equal(env.CampusStorage.load().classes.length, 0);
    assert.ok(env.CampusStorage.load().notice);
    assert.equal(env.raw(), raw);
    assert.equal(env.writes(), 0);
  }
});

test('유효하지 않은 수업과 중복 ID를 제외하고 정상 수업은 복구한다', () => {
  const env = setup(JSON.stringify({ version:1, classes:[normal(), normal(), null, normal({ id:'bad', building:'E' })] }));
  const result = env.CampusStorage.load();
  assert.equal(result.classes.length, 1);
  assert.ok(result.notice);
  assert.equal(env.writes(), 0);
});

test('읽기 권한 오류가 발생해도 앱이 사용할 빈 배열을 반환한다', () => {
  const env = setup(null, { blockRead:true });
  assert.equal(env.CampusStorage.load().classes.length, 0);
  assert.ok(env.CampusStorage.load().notice);
  assert.equal(env.writes(), 0);
});

test('저장 실패를 성공으로 보고하지 않고 기존 내용을 보존한다', () => {
  const original = JSON.stringify({ version:1, classes:[normal()] });
  const env = setup(original, { blockWrite:true });
  const result = env.CampusStorage.save([]);
  assert.equal(result.ok, false);
  assert.ok(result.message);
  assert.equal(env.raw(), original);
  assert.equal(env.CampusStorage.load().classes.length, 1);
});
