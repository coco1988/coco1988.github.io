const DATA_URL = './data/shifts.json';
const ORIGINAL_TITLE = document.title;
const EVENT_YEAR = new Date().getFullYear();
const EMBEDDED_DATA = window.SHIFTBOARD_DATA || null;

let RAW = [];
let PHOTOGRAPHERS = [];
let titleBlinkTimer = null;

let notifiedIds = new Set(JSON.parse(localStorage.getItem('sb_notified_ids') || '[]'));

const urlParams = new URLSearchParams(window.location.search);
const urlPhotographer = urlParams.get('photographer') || urlParams.get('photog') || '';

let state = {
  view: localStorage.getItem('sb_view') || 'cards',
  person: urlPhotographer || localStorage.getItem('sb_person') || '',
  date: localStorage.getItem('sb_date') || '',
  cat: localStorage.getItem('sb_cat') || '',
  rel: localStorage.getItem('sb_rel') || '',
  search: '',
  sort: 'date',
  sortDir: 1,
  refreshSeconds: Number(localStorage.getItem('sb_refresh_seconds') || '30'),
  showPast: localStorage.getItem('sb_show_past') === '1', // default false = faded
};

const els = {
  catFilter: document.getElementById('catFilter'),
  personSelect: document.getElementById('personSelect'),
  dateChips: document.getElementById('dateChips'),
  relFilter: document.getElementById('relFilter'),
  heroSection: document.getElementById('heroSection'),
  cardList: document.getElementById('cardList'),
  cardsEmpty: document.getElementById('cardsEmpty'),
  tableBody: document.getElementById('tableBody'),
  tableEmpty: document.getElementById('tableEmpty'),
  timelineBody: document.getElementById('timelineBody'),
  timelineHead: document.getElementById('timelineHead'),
  timelineEmpty: document.getElementById('timelineEmpty'),
  timelineWrap: document.getElementById('timelineWrap'),
  timelineInfoRail: document.getElementById('timelineInfoRail'),
  resultLabel: document.getElementById('resultLabel'),
  searchInput: document.getElementById('searchInput'),
  refreshSelect: document.getElementById('refreshSelect'),
  loadingMsg: document.getElementById('loadingMsg'),
  lastLoaded: document.getElementById('lastLoaded'),
  cardsView: document.getElementById('cardsView'),
  tableView: document.getElementById('tableView'),
  timelineView: document.getElementById('timelineView'),
  btnCards: document.getElementById('btnCards'),
  btnTable: document.getElementById('btnTable'),
  btnTimeline: document.getElementById('btnTimeline'),
  themeToggle: document.getElementById('themeToggle'),
  logoBtn: document.getElementById('logoBtn'),
  logoIcon: document.getElementById('logoIcon'),
  chickenCursor: document.getElementById('chickenCursor'),
  togglePast: document.getElementById('togglePast'),
};

function save() {
  localStorage.setItem('sb_view', state.view);
  localStorage.setItem('sb_person', state.person);
  localStorage.setItem('sb_date', state.date);
  localStorage.setItem('sb_cat', state.cat);
  localStorage.setItem('sb_rel', state.rel);
  localStorage.setItem('sb_refresh_seconds', String(state.refreshSeconds));
  localStorage.setItem('sb_notified_ids', JSON.stringify([...notifiedIds]));
  localStorage.setItem('sb_show_past', state.showPast ? '1' : '0');
}

function formatMinutes(minutes) {
  if (minutes === null || Number.isNaN(minutes)) return '—';
  if (minutes < 0) return `${minutes} min`;
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins === 0 ? `${hours}h` : `${hours}h ${mins}min`;
}

function parseShiftDateParts(dateText) {
  const base = (dateText || '').split(' ')[0] || '';
  const [month, day] = base.split('-').map(Number);
  if (!month || !day) return null;
  return { month, day };
}

function isXShift(shift) {
  return shift.from === 'X' || shift.till === 'X';
}

function parseTimeToParts(timeText) {
  if (timeText === 'X' || timeText === 'todo') return null;
  const [hour, minute] = String(timeText || '').split(':').map(Number);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  return { hour, minute };
}

function shiftRange(shift) {
  const dateParts = parseShiftDateParts(shift?.date);
  const fromParts = parseTimeToParts(shift?.from);
  const tillParts = parseTimeToParts(shift?.till);
  if (!dateParts || !fromParts || !tillParts) return null;

  const start = new Date(EVENT_YEAR, dateParts.month - 1, dateParts.day, fromParts.hour, fromParts.minute, 0, 0);
  let end = new Date(EVENT_YEAR, dateParts.month - 1, dateParts.day, tillParts.hour, tillParts.minute, 0, 0);
  if (end < start) end = new Date(end.getTime() + 24 * 60 * 60000);
  return { start, end };
}

function parseSlotRange(shift, personName) {
  if (!personName) return null;
  const assignment = (shift.assigned || []).find(a => a.name === personName);
  const baseRange = shiftRange(shift);
  if (!assignment || !baseRange) return null;

  const match = String(assignment.slot || '').match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
  if (!match) return null;

  const [sh, sm] = match[1].split(':').map(Number);
  const [eh, em] = match[2].split(':').map(Number);

  const start = new Date(baseRange.start.getFullYear(), baseRange.start.getMonth(), baseRange.start.getDate(), sh, sm, 0, 0);
  let end = new Date(baseRange.start.getFullYear(), baseRange.start.getMonth(), baseRange.start.getDate(), eh, em, 0, 0);
  if (end < start) end = new Date(end.getTime() + 24 * 60 * 60000);

  return { start, end, label: assignment.slot };
}

function effectiveRange(shift) {
  return state.person ? (parseSlotRange(shift, state.person) || shiftRange(shift)) : shiftRange(shift);
}

function weekdayLabel(dateText) {
  const parts = parseShiftDateParts(dateText);
  if (!parts) return (dateText || '').split(' ')[1] || '';
  const dt = new Date(EVENT_YEAR, parts.month - 1, parts.day, 0, 0, 0, 0);
  return dt.toLocaleDateString(undefined, { weekday: 'short' });
}

function fullDateLabel(dateText) {
  const raw = (dateText || '').split(' ')[0] || dateText;
  return `${raw} ${weekdayLabel(dateText)}`;
}

function statusForShift(shift) {
  if (isXShift(shift)) return { level: '', label: '', ongoing: false, minutes: null };
  const range = effectiveRange(shift);
  if (!range) return { level: '', label: '', ongoing: false, minutes: null };

  const now = Date.now();
  const minutes = Math.round((range.start.getTime() - now) / 60000);

  if (now >= range.start.getTime() && now <= range.end.getTime()) {
    return { level: 'now', label: 'Ongoing now', ongoing: true, minutes };
  }
  if (minutes <= 5 && minutes > 0) {
    return { level: '5', label: `Starts in ${formatMinutes(minutes)}`, ongoing: false, minutes };
  }
  if (minutes <= 10 && minutes > 5) {
    return { level: '10', label: `Starts in ${formatMinutes(minutes)}`, ongoing: false, minutes };
  }
  if (minutes <= 15 && minutes > 10) {
    return { level: '15', label: `Starts in ${formatMinutes(minutes)}`, ongoing: false, minutes };
  }
  return { level: '', label: '', ongoing: false, minutes };
}

function isPastToday(shift) {
  const range = effectiveRange(shift);
  if (!range) return false;
  const now = new Date();
  const sameDay = range.start.toDateString() === now.toDateString();
  return sameDay && range.end.getTime() < now.getTime();
}

function urgencyClassFromStatus(status) {
  if (status.level === '15') return 'upcoming-15';
  if (status.level === '10') return 'upcoming-10';
  if (status.level === '5') return 'upcoming-5';
  if (status.level === 'now') return 'upcoming-now';
  return '';
}

const categoryClassCache = new Map();
function categoryClass(name) {
  const key = name || '';
  if (categoryClassCache.has(key)) return categoryClassCache.get(key);
  const norm = String(key)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[+]/g, '-')
    .replace(/[＋]/g, '-')
    .replace(/-+/g, '-');
  const result = `cat-${norm}`;
  categoryClassCache.set(key, result);
  return result;
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function linkify(text) {
  const escaped = escapeHtml(text || '');
  return escaped.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
}

function populateFilters() {
  const cats = [...new Set(RAW.map(s => s.category).filter(Boolean))].sort();
  els.catFilter.innerHTML =
    '<option value="">All categories</option>' +
    cats.map(c => `<option ${c === state.cat ? 'selected' : ''}>${c}</option>`).join('');

  els.personSelect.innerHTML =
    '<option value="">All photographers</option>' +
    PHOTOGRAPHERS.map(p => `<option ${p === state.person ? 'selected' : ''}>${p}</option>`).join('');

  const dates = [...new Set(RAW.map(s => s.date))];
  els.dateChips.innerHTML =
    '<button class="chip' + (state.date === '' ? ' active' : '') + '" data-date="">All days</button>' +
    dates.map(d => `<button class="chip${state.date === d ? ' active' : ''}" data-date="${d}">${fullDateLabel(d)}</button>`).join('');

  els.dateChips.querySelectorAll('[data-date]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.date = btn.dataset.date;
      els.dateChips.querySelectorAll('[data-date]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      render();
    });
  });

  els.relFilter.value = state.rel;
}

function filtered() {
  const base = RAW.filter(s => {
    if (state.person && s.relevant !== 'info' && !s.assigned.some(a => a.name === state.person)) return false;
    if (state.date && s.date !== state.date) return false;
    if (state.cat && s.category !== state.cat) return false;
    if (state.rel && s.relevant !== state.rel) return false;

    if (state.search) {
      const q = state.search.toLowerCase();
      const hay = [
        s.what,
        s.where,
        s.category,
        s.comment,
        s.notes,
        s.assigned.map(a => `${a.name} ${a.slot}`).join(' '),
      ].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }

    return true;
  });

  return base
    .map(s => ({ s, t: effectiveRange(s)?.start?.getTime() || 0 }))
    .sort((a, b) => a.t - b.t)
    .map(x => x.s);
}

function nextShift() {
  const pool = (state.person ? RAW.filter(s => s.assigned.some(a => a.name === state.person)) : RAW)
    .filter(s => !isXShift(s));
  const now = Date.now();

  const candidates = pool.map(shift => {
    const range = effectiveRange(shift);
    return { shift, range };
  }).filter(item => item.range);

  const current = candidates
    .filter(item => now >= item.range.start.getTime() && now <= item.range.end.getTime())
    .sort((a, b) => a.range.start - b.range.start)[0];

  if (current) return current;

  return candidates
    .filter(item => item.range.start.getTime() >= now)
    .sort((a, b) => a.range.start - b.range.start)[0] || null;
}

function assignedHtml(shift, tableMode = false) {
  if (!shift.assigned.length) return tableMode ? '<span class="nobody">–</span>' : '<span class="nobody">Unassigned</span>';
  if (isXShift(shift)) {
    return shift.assigned
      .map(a => `<span class="person-chip${a.name === state.person ? ' mine' : ''}">${a.name}</span>`)
      .join('');
  }
  return shift.assigned
    .map(a => `<span class="person-chip${a.name === state.person ? ' mine' : ''}">${a.name}: <span class="slot-time">${a.slot}</span></span>`)
    .join('');
}

function displayTimeText(shift) {
  if (isXShift(shift)) return 'To Do / Anytime';
  const slot = state.person ? (shift.assigned || []).find(a => a.name === state.person) : null;
  return slot?.slot || `${shift.from} – ${shift.till}`;
}

function renderHero() {
  const next = nextShift();

  if (!next) {
    els.heroSection.innerHTML = '';
    stopTitleBlink();
    return;
  }

  const hero = next.shift;
  const status = statusForShift(hero);
  const levelClass = urgencyClassFromStatus(status);

  els.heroSection.innerHTML = `
    <div class="section-label ${levelClass ? 'blink-text' : ''}">Next shift${state.person ? ' · ' + state.person : ''}</div>
    <div class="hero-card ${levelClass}">
      <div>
        <div class="hero-what">${hero.what}</div>
        <div class="hero-where">📍 ${hero.where || '—'}</div>
        <div style="color:var(--muted);font-size:.9rem;margin-top:.5rem">${fullDateLabel(hero.date)} · <span class="tag category ${categoryClass(hero.category)}">${hero.category || '—'}</span></div>
      </div>
      <div class="hero-side">
        <div>
          <div style="font-size:.75rem;color:var(--muted);text-transform:uppercase;letter-spacing:.08em">Status</div>
          <div style="font-size:2rem;font-weight:800;line-height:1.1">${status.label || displayTimeText(hero)}</div>
        </div>
        <div class="assigned-row">${assignedHtml(hero)}</div>
      </div>
    </div>`;

  if (levelClass) {
    startTitleBlink(hero, status.label || 'soon');
    maybeAlert(hero, status.level, status.label);
  } else {
    stopTitleBlink();
  }

}

function renderCards(data) {
  if (!data.length) {
    els.cardList.innerHTML = '';
    els.cardsEmpty.style.display = 'block';
    return;
  }

  els.cardsEmpty.style.display = 'none';

  const renderCardHtml = (s) => {
    const noteText = [s.notes, s.comment].filter(Boolean).join('\n');
    const status = statusForShift(s);
    const levelClass = urgencyClassFromStatus(status);
    const isInfo = s.relevant === 'info';
    const isPast = !state.showPast && isPastToday(s);

  return `
    <article class="card ${isInfo ? 'card-info' : ''} ${levelClass} ${isPast ? 'shift-past' : ''}">
        <div class="card-top">
          <div>
            <div class="card-what">${s.what}</div>
            <div class="card-where">📍 ${s.where || '—'}</div>
          </div>
          <div class="time-pill">${displayTimeText(s)}</div>
        </div>
        <div class="card-meta">
          <span class="tag category ${categoryClass(s.category)}">${s.category || '—'}</span>
          ${s.relevant && s.relevant !== 'yes' ? `<span class="tag">${s.relevant}</span>` : ''}
        </div>
        ${isInfo ? '' : `<div class="assigned-row">${assignedHtml(s)}</div>`}
        ${noteText ? `<div class="card-note">💬 ${linkify(noteText)}</div>` : ''}
      </article>`;
  };

  const days = [...new Set(data.map(s => s.date))];
  let html = '';

  days.forEach(day => {
    const dayShifts = data.filter(s => s.date === day);
    const todos = dayShifts.filter(isXShift);
    const shifts = dayShifts.filter(s => !isXShift(s));

    html += `<div class="day-header">${fullDateLabel(day)}</div>`;

    if (todos.length > 0) {
      html += `<div class="section-title">📌 To Do / Anytime Today</div>`;
      html += todos.map(renderCardHtml).join('');
      if (shifts.length > 0) {
        html += `<div class="section-title">📅 Scheduled Shifts</div>`;
      }
    }

    html += shifts.map(renderCardHtml).join('');
  });

  els.cardList.innerHTML = html;
}

function minutesBetween(a, b) {
  return Math.round((b.getTime() - a.getTime()) / 60000);
}

function assignmentRangeFor(shift, assignment) {
  const bySlot = parseSlotRange(shift, assignment.name);
  if (bySlot) return bySlot;
  return shiftRange(shift);
}

function filteredForTimeline() {
  return RAW.filter(s => {
    if (state.date && s.date !== state.date) return false;
    if (state.cat && s.category !== state.cat) return false;
    if (state.rel && s.relevant !== state.rel) return false;
    if (state.search) {
      const q = state.search.toLowerCase();
      const hay = [s.what, s.where, s.category, s.comment, s.notes, s.assigned.map(a => `${a.name} ${a.slot}`).join(' ')].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function dateLabelFromDate(date) {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const wd = date.toLocaleDateString(undefined, { weekday: 'short' });
  return `${mm}-${dd} ${wd}`;
}

function timeLabelFromDate(date) {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function now0() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate(), 0, 0, 0, 0);
}

function renderTimeline() {
  const body = els.timelineBody;
  const head = els.timelineHead;
  const empty = els.timelineEmpty;
  const wrap = els.timelineWrap;
  const infoRail = els.timelineInfoRail;
  const source = filteredForTimeline();
  const allDates = [...new Set(RAW.map(s => s.date))].sort((a, b) => {
    const pa = parseShiftDateParts(a);
    const pb = parseShiftDateParts(b);
    if (!pa || !pb) return 0;
    return (pa.month - pb.month) || (pa.day - pb.day);
  });
  const overviewMode = !state.date;
  const activeDate = state.date || allDates[0] || '';
  const dayShifts = overviewMode ? source : source.filter(s => s.date === activeDate);
  const infoShifts = dayShifts.filter(s => s.relevant === 'info');
  const peopleShifts = dayShifts.filter(s => s.relevant !== 'info');
  const people = state.person ? [state.person] : PHOTOGRAPHERS.slice();

  const hourCount = 24;
  const normalHourWidth = 88;
  const compressedHourWidth = 24;
  const dayWidth = 200;

  let rangeStart, rangeEnd;
  if (overviewMode && allDates.length) {
    const firstParts = parseShiftDateParts(allDates[0]);
    const lastParts = parseShiftDateParts(allDates[allDates.length - 1]);
    rangeStart = firstParts ? new Date(EVENT_YEAR, firstParts.month - 1, firstParts.day, 0, 0, 0, 0) : now0();
    rangeEnd = lastParts
      ? new Date(EVENT_YEAR, lastParts.month - 1, lastParts.day + 1, 0, 0, 0, 0)
      : new Date(rangeStart.getTime() + 24 * 60 * 60000);
  } else {
    const parts = parseShiftDateParts(activeDate);
    rangeStart = parts ? new Date(EVENT_YEAR, parts.month - 1, parts.day, 0, 0, 0, 0) : now0();
    rangeEnd = new Date(rangeStart.getTime() + 24 * 60 * 60000);
  }
  const totalSpanMinutes = minutesBetween(rangeStart, rangeEnd);

  const items = [];
  peopleShifts.filter(s => !isXShift(s)).forEach(shift => {
    (shift.assigned || []).forEach(assignment => {
      if (state.person && assignment.name !== state.person) return;
      const range = assignmentRangeFor(shift, assignment);
      if (!range) return;
      items.push({ name: assignment.name, shift, assignment, start: range.start, end: range.end });
    });
  });

  const infoItems = infoShifts
    .filter(s => !isXShift(s))
    .map(shift => {
      const range = shiftRange(shift);
      if (!range) return null;
      return { shift, start: range.start, end: range.end };
    })
    .filter(Boolean);

  if ((!items.length && !infoItems.length) || !people.length) {
    head.innerHTML = '';
    body.innerHTML = '';
    if (infoRail) infoRail.innerHTML = '';
    empty.style.display = 'block';
    wrap.style.display = 'none';
    return;
  }

  empty.style.display = 'none';
  wrap.style.display = 'block';

  const now = new Date();
  const todayKey = dateLabelFromDate(now);
  const showNow = overviewMode ? (now >= rangeStart && now <= rangeEnd) : activeDate === todayKey;

  let hourWidths = null;
  let hourOffs = null;
  let laneWidth;

  if (overviewMode) {
    laneWidth = allDates.length * dayWidth;
  } else {
    const occupiedHours = new Set();
    [...items, ...infoItems].forEach(item => {
      let h = item.start.getHours();
      const sameDay = item.end.toDateString() === item.start.toDateString();
      const endH = item.end.getHours() + (sameDay ? 0 : 24);
      for (let x = h; x <= endH; x++) occupiedHours.add(((x % 24) + 24) % 24);
    });

    hourWidths = [];
    for (let h = 0; h < hourCount; h++) {
      const isNight = h >= 0 && h < 7;
      const isOccupied = occupiedHours.has(h);
      hourWidths.push(isNight && !isOccupied ? compressedHourWidth : normalHourWidth);
    }

    hourOffs = [0];
    for (let i = 0; i < hourWidths.length - 1; i++) hourOffs.push(hourOffs[i] + hourWidths[i]);

    laneWidth = hourOffs[hourOffs.length - 1] + hourWidths[hourWidths.length - 1];
  }

  function minutesToX(minutesFromStart) {
    if (overviewMode) return (minutesFromStart / totalSpanMinutes) * laneWidth;
    const hourIdx = Math.min(Math.floor(minutesFromStart / 60), hourWidths.length - 1);
    const fracIntoHour = (minutesFromStart - hourIdx * 60) / 60;
    return hourOffs[hourIdx] + fracIntoHour * hourWidths[hourIdx];
  }

  const nowLeft = showNow ? minutesToX(minutesBetween(rangeStart, now)) : null;

  if (overviewMode) {
    wrap.style.setProperty('--hour-width', `${dayWidth}px`);
    const ticks = allDates.map((d) => `<div class="timeline-hour" style="width:${dayWidth}px">${fullDateLabel(d)}</div>`).join('');
    head.innerHTML = `
      <div class="timeline-corner">All days</div>
      <div class="timeline-hours" style="grid-template-columns:repeat(${allDates.length}, ${dayWidth}px)">${ticks}</div>
    `;
  } else {
    const hours = hourWidths.map((w, i) => {
      const hour = new Date(rangeStart.getTime() + i * 60 * 60000);
      const isCompressed = w === compressedHourWidth;
      const prevCompressed = i > 0 && hourWidths[i - 1] === compressedHourWidth;
      const nextCompressed = i < hourWidths.length - 1 && hourWidths[i + 1] === compressedHourWidth;
      const showLabel = !isCompressed || !prevCompressed || !nextCompressed;
      return `<div class="timeline-hour${isCompressed ? ' compressed' : ''}" style="width:${w}px">${showLabel ? timeLabelFromDate(hour) : ''}</div>`;
    });
    head.innerHTML = `
      <div class="timeline-corner">${fullDateLabel(activeDate)}</div>
      <div class="timeline-hours" style="grid-template-columns:${hourWidths.map(w => w + 'px').join(' ')}">${hours.join('')}</div>
    `;
  }

  const blockLabel = (name) => overviewMode ? '' : `<div class="tb-what">${escapeHtml(name)}</div>`;

  if (infoRail) {
    const infoBlocks = infoItems.map(item => {
      const left = Math.max(0, minutesToX(minutesBetween(rangeStart, item.start)));
      const right = minutesToX(minutesBetween(rangeStart, item.end));
      const width = Math.max(overviewMode ? 6 : 56, right - left);
      const isPast = !state.showPast && isPastToday(item.shift);
      return `<div class="timeline-block ${categoryClass(item.shift.category)}${overviewMode ? ' compact' : ''}${isPast ? ' shift-past' : ''}" style="left:${left}px;width:${width}px" title="${escapeHtml(item.shift.what)} · ${fullDateLabel(item.shift.date)} · ${item.shift.from}–${item.shift.till} · ${escapeHtml(item.shift.where || '')}${item.shift.notes ? ' · ' + escapeHtml(item.shift.notes) : ''}">
          ${blockLabel(item.shift.what)}
        </div>`;
    }).join('');

    infoRail.innerHTML = `
      <div class="timeline-row timeline-info-row">
        <div class="timeline-name"><strong>Event info</strong><span>${infoItems.length} item${infoItems.length === 1 ? '' : 's'}</span></div>
        <div class="timeline-lane" style="width:${laneWidth}px">${showNow ? `<div class="timeline-now" style="left:${nowLeft}px"></div>` : ''}${infoBlocks}</div>
      </div>`;
  }

  body.innerHTML = people.map(name => {
    const rowItems = items.filter(item => item.name === name).sort((a, b) => a.start - b.start);

    const blocks = rowItems.map(item => {
      const left = minutesToX(minutesBetween(rangeStart, item.start));
      const right = minutesToX(minutesBetween(rangeStart, item.end));
      const width = Math.max(overviewMode ? 6 : 56, right - left);
      const isPast = !state.showPast && isPastToday(item.shift);
      return `<div class="timeline-block ${categoryClass(item.shift.category)}${name === state.person ? ' mine' : ''}${overviewMode ? ' compact' : ''}${isPast ? ' shift-past' : ''}" style="left:${left}px;width:${width}px" title="${escapeHtml(item.shift.what)} · ${fullDateLabel(item.shift.date)} · ${item.shift.from}–${item.shift.till} · ${escapeHtml(item.shift.where || '')}${item.shift.notes ? ' · ' + escapeHtml(item.shift.notes) : ''}">
         ${blockLabel(item.shift.what)}
        </div>`;
    }).join('');

    return `
      <div class="timeline-row${rowItems.length ? '' : ' timeline-row-empty'}">
        <div class="timeline-name"><strong>${escapeHtml(name)}</strong><span>${rowItems.length} assignment${rowItems.length === 1 ? '' : 's'}</span></div>
        <div class="timeline-lane" style="width:${laneWidth}px">${showNow ? `<div class="timeline-now" style="left:${nowLeft}px"></div>` : ''}${blocks}</div>
      </div>`;
  }).join('');
}

function renderTable(data) {
  if (!data.length) {
    els.tableBody.innerHTML = '';
    els.tableEmpty.style.display = 'block';
    return;
  }

  els.tableEmpty.style.display = 'none';
  els.tableBody.innerHTML = data.map(s => {
    const status = statusForShift(s);
    const levelClass = urgencyClassFromStatus(status);
    const isPast = !state.showPast && isPastToday(s);
    return `<tr class="${levelClass} ${isPast ? 'shift-past' : ''}">
        <td>${fullDateLabel(s.date)}</td>
        <td>${displayTimeText(s)}</td>
        <td>${s.what}</td>
        <td>${s.where || '—'}</td>
        <td><span class="tag category ${categoryClass(s.category)}">${s.category || '—'}</span></td>
        <td><div class="assigned-row">${assignedHtml(s, true)}</div></td>
        <td>${linkify([s.notes, s.comment].filter(Boolean).join(' • '))}${status.label ? `<div style="margin-top:.35rem"><span class="tag blink-text">${status.label}</span></div>` : ''}</td>
      </tr>`;
  }).join('');
}

function render() {
  const data = filtered();
  renderHero();
  els.resultLabel.textContent =
    data.length + ' shift' + (data.length !== 1 ? 's' : '') + ' shown' + (state.person ? ' · ' + state.person : '');
  renderCards(data);
  renderTable(data);
  renderTimeline();
  save();
}

function setView(v) {
  state.view = v;
  els.cardsView.classList.toggle('active', v === 'cards');
  els.tableView.classList.toggle('active', v === 'table');
  els.timelineView.classList.toggle('active', v === 'timeline');
  els.btnCards.classList.toggle('active', v === 'cards');
  els.btnTable.classList.toggle('active', v === 'table');
  els.btnTimeline.classList.toggle('active', v === 'timeline');
}

function toggleView() {
  const order = ['cards', 'table', 'timeline'];
  const idx = order.indexOf(state.view);
  setView(order[(idx + 1) % order.length]);
  render();
}

function setPersonFilter(p) {
  state.person = p;
  els.personSelect.value = p;
  render();
}

function setMyShifts() {
  const p = els.personSelect.value || PHOTOGRAPHERS[0];
  setPersonFilter(p);
}

function startTitleBlink(hero, label) {
  if (titleBlinkTimer) return;
  let on = false;
  titleBlinkTimer = setInterval(() => {
    on = !on;
    document.title = on ? `🔔 ${hero.what} · ${label}` : ORIGINAL_TITLE;
  }, 900);
}

function stopTitleBlink() {
  if (titleBlinkTimer) clearInterval(titleBlinkTimer);
  titleBlinkTimer = null;
  document.title = ORIGINAL_TITLE;
}

let audioUnlocked = false;
let sharedAudioCtx = null;

function unlockAudio() {
  if (audioUnlocked) return;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  sharedAudioCtx = new Ctx();
  sharedAudioCtx.resume();
  audioUnlocked = true;
}

document.addEventListener('click', unlockAudio, { once: true });
document.addEventListener('keydown', unlockAudio, { once: true });
document.addEventListener('touchstart', unlockAudio, { once: true });

function beep() {
  if (!audioUnlocked || !sharedAudioCtx) return;
  if (chickenModeActive) {
    playChickenSound();
    return;
  }
  const ctx = sharedAudioCtx;
  if (ctx.state === 'suspended') ctx.resume();

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = 880;
  gain.gain.value = 0.05;
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.18);
}

function playChickenSound() {
  const ctx = sharedAudioCtx;
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume();

  const now = ctx.currentTime;
  const clucks = [0, 0.11];

  clucks.forEach((offset) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    const start = now + offset;
    osc.frequency.setValueAtTime(480, start);
    osc.frequency.exponentialRampToValueAtTime(220, start + 0.09);
    osc.frequency.exponentialRampToValueAtTime(340, start + 0.13);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.09, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.14);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.16);
  });
}

let continuousBeepTimer = null;

function stopContinuousBeep() {
  if (continuousBeepTimer) clearInterval(continuousBeepTimer);
  continuousBeepTimer = null;
}

function maybeAlert(shift, level) {
  if (!level) {
    stopContinuousBeep();
    return;
  }

  const personKey = state.person || 'all';

  if (level === '15' || level === '10') {
    const key = `${shift.id}-${personKey}-${level}`;
    if (!notifiedIds.has(key)) {
      notifiedIds.add(key);
      beep();
      save();
    }
    stopContinuousBeep();
    return;
  }

  if (level === '5') {
    if (!continuousBeepTimer) {
      beep();
      continuousBeepTimer = setInterval(beep, 4000);
    }
    return;
  }
  // level === 'now' (shift has actually started) or anything else: the alarm stops.
  stopContinuousBeep();
}

let refreshTimer = null;

function applyRefreshInterval() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = null;
  const seconds = Number(state.refreshSeconds || 0);
  if (els.refreshSelect) els.refreshSelect.value = String(seconds);
  if (seconds > 0) refreshTimer = setInterval(loadData, seconds * 1000);
}

let logoClickCount = 0;
let logoClickTimer = null;
let chickenModeActive = false;

function triggerChickenMode() {
  if (chickenModeActive) return;
  chickenModeActive = true;
  if (els.logoIcon) els.logoIcon.textContent = '🐔';
  document.body.classList.add('chicken-mode');
  if (els.chickenCursor) {
    els.chickenCursor.style.display = 'block';
    els.chickenCursor.style.left = '50vw';
    els.chickenCursor.style.top = '50vh';
  }
}

if (els.logoBtn) {
  els.logoBtn.addEventListener('click', () => {
    logoClickCount++;
    clearTimeout(logoClickTimer);
    logoClickTimer = setTimeout(() => { logoClickCount = 0; }, 1500);
    if (logoClickCount >= 10) {
      logoClickCount = 0;
      triggerChickenMode();
    }
  });
}

// Dynamic "leaning" chicken cursor: leans opposite to movement direction.
let lastCursorX = null;
let lastCursorY = null;
let lastMoveTime = null;
let lastDirX = 0;
let shakeScore = 0;
let lastFeatherTime = 0;

function spawnFeather(x, y, dirX, dirY) {
  const feather = document.createElement('div');
  const swayVariants = ['sway-a', 'sway-b', 'sway-c', 'sway-d'];
  const swayClass = swayVariants[Math.floor(Math.random() * swayVariants.length)];
  feather.className = `feather ${swayClass}`;
  feather.textContent = '🪶';
  feather.style.left = `${x}px`;
  feather.style.top = `${y}px`;

  const kickX = dirX * (15 + Math.random() * 20);
  const kickY = -(18 + Math.random() * 15);
  const driftX = (kickX + (Math.random() * 80 - 40)).toFixed(0);
  const popUp = kickY.toFixed(0);
  const fallDuration = 4 + Math.random() * 3.5;
  const spin = (Math.random() * 180 - 90).toFixed(0);

  feather.style.setProperty('--drift-x', `${driftX}px`);
  feather.style.setProperty('--pop-up', `${popUp}px`);
  feather.style.setProperty('--spin', `${spin}deg`);
  feather.style.setProperty('--fall-duration', `${fallDuration}s`);

  document.body.appendChild(feather);
  setTimeout(() => feather.remove(), fallDuration * 1000 + 100);
}

document.addEventListener('mousemove', (e) => {
  if (!chickenModeActive || !els.chickenCursor) return;
  els.chickenCursor.style.left = `${e.clientX}px`;
  els.chickenCursor.style.top = `${e.clientY}px`;

  const now = performance.now();

  if (lastCursorX !== null) {
    const dx = e.clientX - lastCursorX;
    const dy = e.clientY - lastCursorY;

    const lean = Math.max(-25, Math.min(25, -dx * 20));
    const tilt = Math.max(-15, Math.min(15, -dy * 20));
    els.chickenCursor.style.transform = `translate(-50%,-50%) rotate(${lean + tilt}deg)`;

    const dirX = dx > 2 ? 1 : dx < -2 ? -1 : 0;
    if (dirX !== 0) {
      if (lastDirX !== 0 && dirX !== lastDirX) {
        shakeScore = Math.min(10, shakeScore + 2);
      }
      lastDirX = dirX;
    }
    shakeScore = Math.max(0, shakeScore - 0.15);

    if (shakeScore >= 2 && now - lastFeatherTime > 120) {
      lastFeatherTime = now;
      const featherCount = 1 + Math.floor(Math.random() * 2);
      for (let i = 0; i < featherCount; i++) {
        spawnFeather(e.clientX, e.clientY, dirX, dy > 0 ? 1 : -1);
      }
    }
  }

  lastCursorX = e.clientX;
  lastCursorY = e.clientY;
});

async function loadData() {
  els.loadingMsg.style.display = 'block';
  try {
    let data = null;

    if (location.protocol !== 'file:') {
      const res = await fetch(DATA_URL + '?t=' + Date.now(), { cache: 'no-store' });
      data = await res.json();
      els.lastLoaded.textContent = 'JSON loaded · ' + new Date().toLocaleTimeString();
    } else if (EMBEDDED_DATA) {
      data = EMBEDDED_DATA;
      els.lastLoaded.textContent = 'Embedded test data loaded · ' + new Date().toLocaleTimeString();
    } else {
      throw new Error('Local file mode cannot fetch JSON. Use a local web server or embed test data.');
    }

    RAW = data.shifts || [];
    PHOTOGRAPHERS = [...new Set(RAW.flatMap(s => s.assigned.map(a => a.name)))].sort();
    categoryClassCache.clear();
    populateFilters();

    if (urlPhotographer && !state.person) {
      const match = PHOTOGRAPHERS.find(p => p.toLowerCase() === urlPhotographer.toLowerCase());
      if (match) state.person = match;
    }
    if (state.person) els.personSelect.value = state.person;

    render();
  } catch (e) {
    els.lastLoaded.textContent = 'Failed to load JSON';
    console.error(e);
  } finally {
    els.loadingMsg.style.display = 'none';
  }
}

let searchDebounceTimer = null;
els.searchInput.addEventListener('input', e => {
  state.search = e.target.value;
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(render, 150);
});

els.personSelect.addEventListener('change', e => {
  state.person = e.target.value;
  render();
});

els.catFilter.addEventListener('change', e => {
  state.cat = e.target.value;
  render();
});

els.relFilter.addEventListener('change', e => {
  state.rel = e.target.value;
  render();
});

els.refreshSelect.addEventListener('change', e => {
  state.refreshSeconds = Number(e.target.value || '0');
  applyRefreshInterval();
  save();
});

if (els.togglePast) {
  els.togglePast.textContent = state.showPast ? '👁️ Showing past' : '🌙 Fading past';
  els.togglePast.classList.toggle('active', state.showPast);
  els.togglePast.addEventListener('click', () => {
    state.showPast = !state.showPast;
    els.togglePast.textContent = state.showPast ? '👁️ Showing past' : '🌙 Fading past';
    els.togglePast.classList.toggle('active', state.showPast);
    save();
    render();
  });
}

els.btnCards.addEventListener('click', () => { setView('cards'); render(); });
els.btnTable.addEventListener('click', () => { setView('table'); render(); });
els.btnTimeline.addEventListener('click', () => { setView('timeline'); render(); });

document.querySelectorAll('th[data-col]').forEach(th => {
  th.addEventListener('click', () => {
    if (state.sort === th.dataset.col) state.sortDir *= -1;
    else {
      state.sort = th.dataset.col;
      state.sortDir = 1;
    }
    render();
  });
});

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) stopTitleBlink();
  else renderHero();
});

const themeBtn = els.themeToggle;
let theme = localStorage.getItem('sb_theme') || (matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light');
document.documentElement.setAttribute('data-theme', theme);
themeBtn.textContent = theme === 'dark' ? '☀︎' : '◐';

themeBtn.addEventListener('click', () => {
  theme = theme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('sb_theme', theme);
  themeBtn.textContent = theme === 'dark' ? '☀︎' : '◐';
});

setView(['cards', 'table', 'timeline'].includes(state.view) ? state.view : 'cards');
applyRefreshInterval();
loadData();

setInterval(renderHero, 1000);
setInterval(render, 30000);