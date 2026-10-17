(() => {
  'use strict';
  const KEY = 'campus-transfer-check:v1';
  const { validateClass } = window.CampusCalculator;

  function save(classes) {
    try {
      window.localStorage.setItem(KEY, JSON.stringify({ version: 1, classes }));
      return { ok: true };
    } catch {
      return { ok: false, message: '저장하지 못했어요. 브라우저의 저장 공간과 사이트 저장 권한을 확인한 뒤 다시 시도해 주세요.' };
    }
  }

  function load() {
    let raw;
    try {
      raw = window.localStorage.getItem(KEY);
    } catch {
      return { classes: [], notice: '브라우저 저장 공간에 접근할 수 없어요. 사이트 저장 권한을 확인해 주세요.', writable: false };
    }
    // 키가 없는 최초 실행만 예시를 생성합니다. 빈 배열도 저장된 시간표입니다.
    if (raw === null) {
      const examples = window.CampusData.EXAMPLE_CLASSES.map(item => ({ ...item }));
      const result = save(examples);
      return result.ok
        ? { classes: examples, notice: '', writable: true }
        : { classes: [], notice: result.message, writable: false };
    }
    try {
      const document = JSON.parse(raw);
      if (!document || document.version !== 1 || !Array.isArray(document.classes)) throw new Error('Invalid schema');
      const seen = new Set();
      const classes = document.classes.filter(item => {
        if (!item || typeof item !== 'object' || typeof item.id !== 'string' || !item.id || item.id.length > 100 ||
            seen.has(item.id) || Object.keys(validateClass(item)).length) return false;
        seen.add(item.id);
        return true;
      }).map(({ id, name, day, start, end, building }) => ({ id, name: name.trim(), day, start, end, building }));
      const notice = classes.length !== document.classes.length
        ? '읽을 수 없는 수업을 제외했어요. 표시된 시간표를 확인해 주세요. 다음 변경을 저장하면 정리된 시간표가 저장됩니다.' : '';
      return { classes, notice, writable: true };
    } catch {
      // 손상된 원본은 자동으로 덮어쓰지 않습니다. 사용자가 저장할 때 교체합니다.
      return { classes: [], notice: '저장된 시간표를 읽을 수 없어 빈 시간표로 열었어요. 새 수업을 저장하면 기존 저장 내용을 교체합니다.', writable: true };
    }
  }

  window.CampusStorage = Object.freeze({ KEY, load, save });
})();
