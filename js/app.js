(() => {
  'use strict';
  const { DAYS, BUILDINGS, WALK_TIMES } = window.CampusData;
  const { validateClass, classesForDay, analyzeDay, tightest } = window.CampusCalculator;
  const storage = window.CampusStorage;
  const initial = storage.load();
  const state = { classes: initial.classes, day: 'mon', editing: null };
  const $ = selector => document.querySelector(selector);
  const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const dayInfo = () => DAYS.find(day => day.id === state.day);
  const url = (view, day = state.day) => `#${view}?day=${day}`;
  let toastTimer;

  const icons = {
    walk: '<circle cx="14" cy="4" r="2"/><path d="m7 10 5-3 4 4 4 1M12 7l-2 7-4 6m4-6 5 2 2 5"/>',
    arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
    edit: '<path d="m14 5 5 5M4 20l5-1L20 8a2 2 0 0 0-5-5L4 14Z"/>',
    trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    alert: '<path d="M12 8v5m0 4h.01M10 3 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L14 3a2.3 2.3 0 0 0-4 0Z"/>',
    book: '<path d="M12 5v16M12 5C8 2 4 3 2 4v15c3-1 6-1 10 2 4-3 7-3 10-2V4c-3-1-6-2-10 1Z"/>'
  };
  const icon = name => `<svg aria-hidden="true" class="icon" viewBox="0 0 24 24">${icons[name]}</svg>`;
  const isWarning = segment => segment.status === 'overlap' || segment.status === 'shortage';
  function spareLabel(segment) {
    return segment.spare < 0 ? `${Math.abs(segment.spare)}분 부족` : `여유 ${segment.spare}분`;
  }
  function statusLabel(segment) {
    return { safe: '이동 가능', tight: '여유 없음', shortage: '이동 시간 부족', overlap: '수업 시간 중복' }[segment.status];
  }

  function notify(message) {
    clearTimeout(toastTimer);
    $('#toast').textContent = message;
    $('#toast').classList.add('visible');
    toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 3500);
  }

  function showStorageNotice(message) {
    $('#storage-notice').textContent = message;
    $('#storage-notice').hidden = !message;
    $('#save-state').classList.toggle('save-warning', Boolean(message));
    $('#save-state').innerHTML = `<span aria-hidden="true"></span>${message ? '저장 상태 확인 필요' : '이 브라우저에 저장됨'}`;
  }

  function commit(classes) {
    const result = storage.save(classes);
    if (!result.ok) {
      showStorageNotice(result.message);
      return result;
    }
    state.classes = classes;
    showStorageNotice('');
    return result;
  }

  function dayPicker(view) {
    return DAYS.map(day => {
      const count = classesForDay(state.classes, day.id).length;
      const warning = analyzeDay(state.classes, day.id).some(isWarning);
      return `<button type="button" class="day-button${day.id === state.day ? ' selected' : ''}" data-day="${day.id}" data-view="${view}" aria-pressed="${day.id === state.day}"><span class="day-en" aria-hidden="true">${day.en}</span><span class="day-name">${day.label}</span><span class="sr-only">, 수업 ${count}개${warning ? ', 주의 구간 있음' : ''}</span><span class="day-count${warning ? ' has-warning' : ''}" aria-hidden="true">${count}</span></button>`;
    }).join('');
  }

  function renderSummary(segments) {
    const worst = tightest(segments);
    if (!worst) {
      $('#tightest-summary').innerHTML = `<div class="summary-card neutral"><div class="summary-top"><span>${dayInfo().label} 이동 체크</span>${icon('walk')}</div><span class="status-pill blue-pill">${state.classes.some(item => item.day === state.day) ? '수업 1개' : '수업 없음'}</span><h2>수업 사이의 여유를<br>확인해 보세요.</h2><p class="summary-description">같은 요일에 수업을 2개 이상 등록하면<br>이동 시간을 계산해 드려요.</p><div class="summary-bottom">나의 하루를 차근차근 채워봐요 ${icon('arrow')}</div></div>`;
      return;
    }
    const warning = isWarning(worst);
    const heading = worst.status === 'overlap' ? '수업 시간이 겹쳐요.' : worst.spare < 0
      ? `<strong>${Math.abs(worst.spare)}분</strong>이 부족해요.` : worst.spare === 0
        ? '<strong>여유 0분</strong>, 바로 출발해요.' : `<strong>${worst.spare}분</strong>의 여유가 있어요.`;
    $('#tightest-summary').innerHTML = `<div class="summary-card ${warning ? 'warning' : 'comfortable'}"><div class="summary-top"><span>${dayInfo().label}, 가장 빠듯한 이동</span>${icon('walk')}</div><span class="status-pill ${warning ? 'coral-pill' : 'blue-pill'}">${icon(warning ? 'alert' : 'check')}${statusLabel(worst)}</span><h2>${heading}</h2><p class="summary-description">${worst.status === 'overlap' ? `두 수업이 ${Math.abs(worst.gap)}분 겹쳐요.<br>수업 시간을 다시 확인해 주세요.` : worst.spare < 0 ? '다음 수업에 늦을 수 있어요.<br>수업 시간과 건물을 확인해 주세요.' : worst.spare === 0 ? '공백 시간과 이동 시간이 같아요.<br>수업이 끝나면 바로 이동해 주세요.' : '다음 수업까지 이동할 시간이 충분해요.<br>조금 더 편안하게 이동하세요.'}</p><div class="summary-route"><span>${worst.previous.building}관</span><span class="route-dash"></span>${icon('walk')}<small>${worst.walking}분</small><span class="route-dash"></span><span>${worst.next.building}관</span></div><div class="summary-course-names"><span>${escape(worst.previous.name)}</span><span>${escape(worst.next.name)}</span></div><a class="summary-bottom" href="${url('check')}">구간 자세히 보기 ${icon('arrow')}</a></div>`;
  }

  function emptyState(type) {
    const isHome = type === 'home';
    const count = classesForDay(state.classes, state.day).length;
    return `<div class="empty-state"><span class="empty-icon">${icon(isHome ? 'book' : 'walk')}</span><h3>${isHome ? '아직 등록된 수업이 없어요' : count ? '오늘은 이동할 구간이 없어요' : '점검할 수업이 아직 없어요'}</h3><p>${isHome ? `${dayInfo().label}의 첫 수업을 추가하고<br>이동 시간을 확인해 보세요.` : '같은 요일에 수업을 2개 이상 등록하면<br>수업 사이의 이동을 점검할 수 있어요.'}</p><a class="button primary" href="${url('class/new')}"><span aria-hidden="true">＋</span> 수업 추가</a></div>`;
  }

  function renderHome() {
    const classes = classesForDay(state.classes, state.day);
    const segments = analyzeDay(state.classes, state.day);
    renderSummary(segments);
    $('#home-days').innerHTML = dayPicker('home');
    $('#class-count').textContent = classes.length;
    $('#schedule-day').textContent = `${dayInfo().label}의 수업`;
    $('#schedule-range').textContent = classes.length ? `${classes[0].start} — ${classes.reduce((last, item) => item.end > last ? item.end : last, classes[0].end)}` : '가벼운 하루의 시작';
    $('#class-list').innerHTML = classes.length ? classes.map((item, index) => {
      const segment = segments[index];
      return `<article class="class-row" data-class-id="${escape(item.id)}"><div class="class-time"><strong>${item.start}</strong><span>${item.end}</span></div><div class="timeline-mark"><span></span></div><div class="class-card"><div class="class-card-top"><span class="building-tag building-${item.building.toLowerCase()}">${item.building}관</span><div class="class-actions"><a class="icon-button" href="${url(`class/${encodeURIComponent(item.id)}`)}" aria-label="${escape(item.name)} 수정">${icon('edit')}</a><button type="button" class="icon-button delete-button" data-delete="${escape(item.id)}" aria-label="${escape(item.name)} 삭제">${icon('trash')}</button></div></div><h3>${escape(item.name)}</h3><p>${icon('clock')}${item.start} – ${item.end}<span class="card-location">${item.building}관</span></p></div></article>${segment ? `<div class="transfer-row ${isWarning(segment) ? 'warning' : 'safe'}" data-status="${segment.status}"><span class="transfer-line"></span><div>${icon('walk')}<span>이동 ${segment.walking}분</span><span class="transfer-divider" aria-hidden="true">·</span><strong>${segment.status === 'overlap' ? `수업 시간 ${Math.abs(segment.gap)}분 중복` : spareLabel(segment)}</strong>${icon(isWarning(segment) ? 'alert' : 'check')}</div></div>` : ''}`;
    }).join('') : emptyState('home');
    $('#list-add').hidden = classes.length === 0;
    $('#home-add').href = $('#list-add').href = url('class/new');
    $('#home-check').href = url('check');
  }

  function clearErrors() {
    $('#form-message').hidden = true;
    document.querySelectorAll('.field-error').forEach(element => { element.hidden = true; element.textContent = ''; });
    document.querySelectorAll('#class-form [aria-invalid]').forEach(element => element.removeAttribute('aria-invalid'));
  }

  function renderForm(id) {
    const existing = id === 'new' ? null : state.classes.find(item => item.id === id);
    if (id !== 'new' && !existing) {
      history.replaceState(null, '', url('home'));
      notify('해당 수업을 찾을 수 없어요. 시간표를 확인해 주세요.');
      render(true);
      return false;
    }
    state.editing = existing ? existing.id : null;
    clearErrors();
    $('#class-form').reset();
    $('#form-title').textContent = existing ? '수업 정보 수정' : '새로운 수업 추가';
    $('#save-class').innerHTML = `${existing ? '수정 내용 저장하기' : '수업 저장하기'} <span aria-hidden="true">↗</span>`;
    $('#form-days').innerHTML = DAYS.map(day => `<label class="weekday-option"><input type="radio" name="day" value="${day.id}" required aria-describedby="error-day" ${(existing?.day || state.day) === day.id ? 'checked' : ''}><span>${day.short}</span></label>`).join('');
    for (const field of ['name', 'start', 'end', 'building']) $('#class-form').elements[field].value = existing?.[field] || '';
    $('#form-back').href = $('#form-cancel').href = url('home');
    return true;
  }

  function renderCheck() {
    const segments = analyzeDay(state.classes, state.day);
    const warnings = segments.filter(isWarning);
    $('#check-days').innerHTML = dayPicker('check');
    $('#check-back').href = url('home');
    $('#check-day-title').textContent = `${dayInfo().label}의 이동 구간`;
    $('#check-overview').innerHTML = `<div class="check-overview"><div class="overview-message"><span class="overview-icon ${warnings.length ? 'coral-text' : 'blue-text'}">${icon(warnings.length ? 'alert' : 'check')}</span><div><h2>${!segments.length ? '수업을 추가하고 이동을 점검해요' : warnings.length ? `주의가 필요한 구간이 ${warnings.length}개 있어요` : '모든 구간을 이동할 수 있어요'}</h2><p>${segments.some(segment => segment.status === 'overlap') ? '겹치는 수업이 있어요. 시간표를 다시 확인해 주세요.' : segments.some(segment => segment.status === 'tight') ? '여유 0분인 구간은 수업 후 바로 출발해 주세요.' : '이동 시간을 미리 알면 하루가 조금 더 편안해져요.'}</p></div></div><div class="overview-numbers"><div><strong>${segments.length}</strong><span>전체 구간</span></div><div><strong class="${warnings.length ? 'coral-text' : ''}">${warnings.length}</strong><span>주의 구간</span></div></div></div>`;
    $('#segment-list').innerHTML = segments.length ? segments.map((segment, index) => {
      const warning = isWarning(segment);
      return `<article class="segment-card ${warning ? 'warning' : 'safe'}" data-status="${segment.status}"><div class="segment-header"><span class="segment-number">구간 ${String(index + 1).padStart(2, '0')}</span><span class="status-pill ${warning ? 'coral-pill' : 'blue-pill'}">${icon(warning ? 'alert' : 'check')}${statusLabel(segment)}</span></div><div class="segment-route"><div><span class="building-tag">${segment.previous.building}관</span><h3>${escape(segment.previous.name)}</h3><p>${segment.previous.end} 종료</p></div><span class="segment-arrow">${icon('arrow')}</span><div><span class="building-tag">${segment.next.building}관</span><h3>${escape(segment.next.name)}</h3><p>${segment.next.start} 시작</p></div></div><dl class="segment-metrics"><div><dt>수업 사이 공백</dt><dd>${segment.gap}<small>분</small></dd></div><div><dt>예상 이동 시간</dt><dd>${segment.walking}<small>분</small></dd></div><div class="spare-metric"><dt>실제 여유 시간</dt><dd>${segment.spare > 0 ? '+' : ''}${segment.spare}<small>분</small></dd></div></dl><p class="segment-result">${icon(warning ? 'alert' : 'check')}${segment.status === 'overlap' ? `수업 시간 중복 · 두 수업이 ${Math.abs(segment.gap)}분 겹쳐요.` : segment.spare < 0 ? `이동 시간이 ${Math.abs(segment.spare)}분 부족해요. 수업 정보를 확인해 주세요.` : segment.spare === 0 ? '여유 0분 · 수업이 끝나면 바로 출발해야 해요.' : `이동 가능 · 도착 후 ${segment.spare}분의 여유가 있어요.`}</p></article>`;
    }).join('') : emptyState('check');
  }

  function render(shouldFocus = false) {
    const [path, query = ''] = location.hash.slice(1).split('?');
    const params = new URLSearchParams(query);
    const requestedDay = params.get('day');
    if (DAYS.some(day => day.id === requestedDay)) state.day = requestedDay;
    const isForm = /^class\/[^/]+$/.test(path);
    const view = path === 'check' ? 'check' : isForm ? 'class' : 'home';
    if (path !== 'home' && path !== 'check' && !isForm) history.replaceState(null, '', url('home'));
    document.querySelectorAll('.screen').forEach(screen => { screen.hidden = screen.id !== `screen-${view}`; });
    for (const item of ['home', 'check']) {
      $(`#nav-${item}`).href = url(item);
      if (item === (view === 'class' ? 'home' : view)) $(`#nav-${item}`).setAttribute('aria-current', 'page');
      else $(`#nav-${item}`).removeAttribute('aria-current');
    }
    $('.brand').href = url('home');
    if (view === 'home') renderHome();
    else if (view === 'check') renderCheck();
    else {
      let id;
      try { id = decodeURIComponent(path.slice(6)); } catch { id = ''; }
      if (!renderForm(id)) return;
    }
    const title = $(`#screen-${view} h1`);
    document.title = `${title.textContent} · 연강 이동 시간 점검`;
    if (shouldFocus && !$(`#screen-${view}`).hidden) {
      window.scrollTo(0, 0);
      title.focus({ preventScroll: true });
    }
  }

  document.addEventListener('click', event => {
    if (event.target.closest('.skip-link')) {
      event.preventDefault();
      $('#main-content').focus();
      $('#main-content').scrollIntoView();
      return;
    }
    const dayButton = event.target.closest('[data-day]');
    if (dayButton) {
      if (dayButton.dataset.day !== state.day) location.hash = url(dayButton.dataset.view, dayButton.dataset.day);
      return;
    }
    const deleteButton = event.target.closest('[data-delete]');
    if (!deleteButton) return;
    const item = state.classes.find(item => item.id === deleteButton.dataset.delete);
    if (!item || !window.confirm(`“${item.name}” 수업을 삭제할까요?`)) return;
    const result = commit(state.classes.filter(candidate => candidate.id !== item.id));
    if (!result.ok) { notify('삭제 내용을 저장하지 못했어요. 다시 시도해 주세요.'); return; }
    renderHome();
    $('#schedule-title').focus({ preventScroll: true });
    notify('수업을 삭제했어요.');
  });

  $('#class-form').addEventListener('submit', event => {
    event.preventDefault();
    clearErrors();
    const data = new FormData(event.currentTarget);
    const value = Object.fromEntries(['name', 'day', 'start', 'end', 'building'].map(key => [key, String(data.get(key) || '').trim()]));
    const errors = validateClass(value);
    if (Object.keys(errors).length) {
      for (const [field, message] of Object.entries(errors)) {
        $(`#error-${field}`).textContent = message;
        $(`#error-${field}`).hidden = false;
        if (field === 'day') document.querySelectorAll('[name="day"]').forEach(element => element.setAttribute('aria-invalid', 'true'));
        else $(`#class-${field}`).setAttribute('aria-invalid', 'true');
      }
      const firstField = Object.keys(errors)[0];
      (firstField === 'day' ? $('[name="day"]') : $(`#class-${firstField}`)).focus();
      return;
    }
    const editing = state.editing;
    const id = editing || (window.crypto?.randomUUID ? window.crypto.randomUUID() : `class-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const next = { id, ...value };
    const classes = editing ? state.classes.map(item => item.id === editing ? next : item) : [...state.classes, next];
    const result = commit(classes);
    if (!result.ok) { $('#form-message').textContent = result.message; $('#form-message').hidden = false; return; }
    location.hash = url('home', value.day);
    notify(editing ? '수업을 수정했어요. 이동 점검도 업데이트했어요.' : '수업을 추가했어요.');
  });

  $('#walk-matrix').innerHTML = `<table class="walk-matrix"><caption class="sr-only">가상 건물 간 예상 이동 시간, 단위 분</caption><thead><tr><th scope="col">건물</th>${BUILDINGS.map(building => `<th scope="col">${building}관</th>`).join('')}</tr></thead><tbody>${BUILDINGS.map(from => `<tr><th scope="row">${from}관</th>${BUILDINGS.map(to => `<td class="${from === to ? 'same-building' : ''}">${WALK_TIMES[from][to]}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  showStorageNotice(initial.notice);
  window.addEventListener('hashchange', () => render(true));
  render();
})();
