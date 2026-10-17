(() => {
  'use strict';
  const { DAYS, BUILDINGS, WALK_TIMES } = window.CampusData;

  function toMinutes(time) {
    if (typeof time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return NaN;
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  function validateClass(value) {
    const errors = {};
    if (typeof value.name !== 'string' || !value.name.trim()) errors.name = '수업명을 입력해 주세요.';
    else if (value.name.trim().length > 40) errors.name = '수업명은 40자 이내로 입력해 주세요.';
    if (!DAYS.some(day => day.id === value.day)) errors.day = '요일을 선택해 주세요.';
    if (!Number.isFinite(toMinutes(value.start))) errors.start = '시작 시각을 입력해 주세요.';
    if (!Number.isFinite(toMinutes(value.end))) errors.end = '종료 시각을 입력해 주세요.';
    else if (Number.isFinite(toMinutes(value.start)) && toMinutes(value.end) <= toMinutes(value.start)) {
      errors.end = '종료 시각은 시작 시각보다 늦어야 해요.';
    }
    if (!BUILDINGS.includes(value.building)) errors.building = '건물을 선택해 주세요.';
    return errors;
  }

  function classesForDay(classes, day) {
    return classes.filter(item => item.day === day).sort((a, b) =>
      toMinutes(a.start) - toMinutes(b.start) || toMinutes(a.end) - toMinutes(b.end) || a.id.localeCompare(b.id));
  }

  function analyzeDay(classes, day) {
    const sorted = classesForDay(classes, day);
    return sorted.slice(1).map((next, index) => {
      const previous = sorted[index];
      const gap = toMinutes(next.start) - toMinutes(previous.end);
      const walking = WALK_TIMES[previous.building][next.building];
      const spare = gap - walking;
      const status = gap < 0 ? 'overlap' : spare < 0 ? 'shortage' : spare === 0 ? 'tight' : 'safe';
      return { previous, next, gap, walking, spare, status };
    });
  }

  function tightest(segments) {
    return segments.reduce((worst, segment) => !worst || segment.spare < worst.spare ? segment : worst, null);
  }

  window.CampusCalculator = Object.freeze({ toMinutes, validateClass, classesForDay, analyzeDay, tightest });
})();
