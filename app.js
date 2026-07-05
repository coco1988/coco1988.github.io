const DATA_URL = './data/shifts.json';
const ORIGINAL_TITLE = document.title;
const EVENT_YEAR = new Date().getFullYear();
const EMBEDDED_DATA = window.SHIFTBOARD_DATA || null;

let RAW = [];
let PHOTOGRAPHERS = [];
let titleBlinkTimer = null;
let audioUnlocked = false;
let notifiedIds = new Set(JSON.parse(localStorage.getItem('sb_notified_ids') || '[]'));

let state = {
  view: localStorage.getItem('sb_view') || 'cards',
  person: localStorage.getItem('sb_person') || '',
  date: localStorage.getItem('sb_date') || '',
  cat: localStorage.getItem('sb_cat') || '',
  rel: localStorage.getItem('sb_rel') || '',
  search: '',
  sort: 'date',
  sortDir: 1,
  refreshSeconds: Number(localStorage.getItem('sb_refresh_seconds') || '30'),
};

function save() {
  localStorage.setItem('sb_view', state.view);
  localStorage.setItem('sb_person', state.person);
  localStorage.setItem('sb_date', state.date);
  localStorage.setItem('sb_cat', state.cat);
  localStorage.setItem('sb_rel', state.rel);
  localStorage.setItem('sb_refresh_seconds', String(state.refreshSeconds));
  localStorage.setItem('sb_notified_ids', JSON.stringify([...notifiedIds]));
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

function parseTimeToParts(timeText) {
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
  if (minutes <= 15 && minutes > 5) {
    return { level: '15', label: `Starts in ${formatMinutes(minutes)}`, ongoing: false, minutes };
  }
  return { level: '', label: '', ongoing: false, minutes };
}

function urgencyClass(shift) {
  const level = statusForShift(shift).level;
  if (level === '15') return 'upcoming-15';
  if (level === '5') return 'upcoming-5';
  if (level === 'now') return 'upcoming-now';
  return '';
}

function categoryClass(name) {
  const norm = String(name || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[+]/g, '-')
    .replace(/[＋]/g, '-')
    .replace(/-+/g, '-');
  return `cat-${norm}`;
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
  const catSel = document.getElementById('catFilter');
  const cats = [...new Set(RAW.map(s => s.category).filter(Boolean))].sort();
  catSel.innerHTML =
    '<option value="">All categories</option>' +
    cats.map(c => `<option ${c === state.cat ? 'selected' : ''}>${c}</option>`).join('');

  const personSel = document.getElementById('personSelect');
  personSel.innerHTML =
    '<option value="">All photographers</option>' +
    PHOTOGRAPHERS.map(p => `<option ${p === state.person ? 'selected' : ''}>${p}</option>`).join('');

  const dates = [...new Set(RAW.map(s => s.date))];
  const dateChips = document.getElementById('dateChips');
  dateChips.innerHTML =
    '<button class="chip' + (state.date === '' ? ' active' : '') + '" data-date="">All days</button>' +
    dates.map(d => `<button class="chip${state.date === d ? ' active' : ''}" data-date="${d}">${fullDateLabel(d)}</button>`).join('');

  dateChips.querySelectorAll('[data-date]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.date = btn.dataset.date;
      dateChips.querySelectorAll('[data-date]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      render();
    });
  });

  document.getElementById('relFilter').value = state.rel;
}

function filtered() {
  return RAW.filter(s => {
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
  }).sort((a, b) => {
    const aRange = effectiveRange(a);
    const bRange = effectiveRange(b);
    const ta = aRange?.start?.getTime() || 0;
    const tb = bRange?.start?.getTime() || 0;
    return ta - tb;
  });
}

function nextShift() {
  const pool = state.person ? RAW.filter(s => s.assigned.some(a => a.name === state.person)) : RAW;
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
  return shift.assigned
    .map(a => `<span class="person-chip${a.name === state.person ? ' mine' : ''}">${a.name}: ${a.slot}</span>`)
    .join('');
}

function displayTimeText(shift) {
  const slot = state.person ? (shift.assigned || []).find(a => a.name === state.person) : null;
  return slot?.slot || `${shift.from} – ${shift.till}`;
}

function renderHero() {
  const next = nextShift();
  const sec = document.getElementById('heroSection');

  if (!next) {
    sec.innerHTML = '';
    stopTitleBlink();
    return;
  }

  const hero = next.shift;
  const status = statusForShift(hero);
  const levelClass = urgencyClass(hero);

  sec.innerHTML = `
    <div class="section-label ${levelClass ? 'blink-text' : ''}">Next shift${state.person ? ' · ' + state.person : ''}</div>
    <div class="hero-card ${levelClass}">
      <div>
        <div class="hero-time">${displayTimeText(hero)}</div>
        <div class="hero-what">${hero.what}</div>
        <div class="hero-where">📍 ${hero.where || '—'}</div>
        <div style="color:var(--muted);font-size:.9rem;margin-top:.5rem">${fullDateLabel(hero.date)} · <span class="tag category ${categoryClass(hero.category)}">${hero.category || '—'}</span></div>
      </div>
      <div class="hero-side">
        <div>
          <div style="font-size:.75rem;color:var(--muted);text-transform:uppercase;letter-spacing:.08em">Status</div>
          <div style="font-size:2rem;font-weight:800;line-height:1.1">${status.label || formatMinutes(status.minutes)}</div>
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

function renderStats(data) {
  const total = data.length;
  const assigned = data.filter(s => s.assigned.length > 0).length;
  const days = [...new Set(data.map(s => s.date))].length;
  const cats = [...new Set(data.map(s => s.category))].filter(Boolean).length;

  document.getElementById('statsBar').innerHTML = `
    <div class="stat"><div class="sn">${total}</div><div class="sl">Shifts</div></div>
    <div class="stat"><div class="sn">${assigned}</div><div class="sl">Assigned</div></div>
    <div class="stat"><div class="sn">${total - assigned}</div><div class="sl">Open</div></div>
    <div class="stat"><div class="sn">${days}</div><div class="sl">Days</div></div>
    <div class="stat"><div class="sn">${cats}</div><div class="sl">Categories</div></div>`;
}

function renderCards(data) {
  const list = document.getElementById('cardList');
  const empty = document.getElementById('cardsEmpty');

  if (!data.length) {
    list.innerHTML = '';
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';
  list.innerHTML = data.map(s => {
    const noteText = [s.notes, s.comment].filter(Boolean).join('\n');
    const status = statusForShift(s);
    const levelClass = urgencyClass(s);
    const isInfo = s.relevant === 'info';

    return `
      <article class="card ${isInfo ? 'card-info' : ''} ${levelClass}">
        <div class="card-top">
          <div>
            <div class="card-what">${s.what}</div>
            <div class="card-where">📍 ${s.where || '—'}</div>
          </div>
          <div class="time-pill">${fullDateLabel(s.date)} · ${displayTimeText(s)}</div>
        </div>
        <div class="card-meta">
          <span class="tag category ${categoryClass(s.category)}">${s.category || '—'}</span>
          ${s.relevant && s.relevant !== 'yes' ? `<span class="tag">${s.relevant}</span>` : ''}
          ${status.label ? `<span class="tag blink-text">${status.label}</span>` : ''}
        </div>
        ${isInfo ? '' : `<div class="assigned-row">${assignedHtml(s)}</div>`}
        ${noteText ? `<div class="card-note">💬 ${linkify(noteText)}</div>` : ''}
      </article>`;
  }).join('');
}

function minutesBetween(a, b) {
  return Math.round((b.getTime() - a.getTime()) / 60000);
}

function floorHour(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), 0, 0, 0);
}

function ceilHour(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), 0, 0, 0);
  if (date.getMinutes() || date.getSeconds() || date.getMilliseconds()) d.setHours(d.getHours() + 1);
  return d;
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

function renderTimeline() {
  const body = document.getElementById('timelineBody');
  const head = document.getElementById('timelineHead');
  const empty = document.getElementById('timelineEmpty');
  const wrap = document.getElementById('timelineWrap');
  const infoRail = document.getElementById('timelineInfoRail');
  const source = filteredForTimeline();
  const activeDate = state.date || [...new Set(RAW.map(s => s.date))][0] || '';
  const dayShifts = source.filter(s => s.date === activeDate);
  const infoShifts = dayShifts.filter(s => s.relevant === 'info');
  const peopleShifts = dayShifts.filter(s => s.relevant !== 'info');
  const people = state.person ? [state.person] : PHOTOGRAPHERS.slice();

  const items = [];
  peopleShifts.forEach(shift => {
    (shift.assigned || []).forEach(assignment => {
      if (state.person && assignment.name !== state.person) return;
      const range = assignmentRangeFor(shift, assignment);
      if (!range) return;
      items.push({
        name: assignment.name,
        shift,
        assignment,
        start: range.start,
        end: range.end,
      });
    });
  });

  const infoItems = infoShifts
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

  const dayStart = new Date(activeDate ? parseShiftDateParts(activeDate) ? new Date(EVENT_YEAR, parseShiftDateParts(activeDate).month - 1, parseShiftDateParts(activeDate).day, 0, 0, 0, 0) : now0() : now0());
  const start = dayStart;
  const end = new Date(start.getTime() + 24 * 60 * 60000);
  const totalMinutes = 24 * 60;
  const hourCount = 24;
  const hourWidth = 88;
  const laneWidth = hourCount * hourWidth;

  wrap.style.setProperty('--hour-width', `${hourWidth}px`);

  const hours = [];
  for (let i = 0; i < hourCount; i++) {
    const hour = new Date(start.getTime() + i * 60 * 60000);
    hours.push(`<div class="timeline-hour">${timeLabelFromDate(hour)}</div>`);
  }

  head.innerHTML = `
    <div class="timeline-corner">${fullDateLabel(activeDate)}</div>
    <div class="timeline-hours" style="grid-template-columns:repeat(${hourCount}, ${hourWidth}px)">${hours.join('')}</div>
  `;

  const now = new Date();
  const todayKey = dateLabelFromDate(now);
  const showNow = activeDate === todayKey;
  const nowLeft = showNow ? (minutesBetween(start, now) / totalMinutes) * laneWidth : null;

  if (infoRail) {
    const infoBlocks = infoItems.map(item => {
      const left = Math.max(0, (minutesBetween(start, item.start) / totalMinutes) * laneWidth);
      const rawWidth = (minutesBetween(item.start, item.end) / totalMinutes) * laneWidth;
      const width = Math.max(56, rawWidth);
      return `
        <div class="timeline-block info-block ${categoryClass(item.shift.category)}" style="left:${left}px;width:${width}px" title="${escapeHtml(item.shift.what)} · ${item.shift.from}–${item.shift.till} · ${escapeHtml(item.shift.where || '')}${item.shift.notes ? ' · ' + escapeHtml(item.shift.notes) : ''}">
          <div class="tb-what">${escapeHtml(item.shift.what)}</div>
        </div>`;
    }).join('');

    infoRail.innerHTML = `
      <div class="timeline-row timeline-info-row">
        <div class="timeline-name"><strong>Event info</strong><span>${infoItems.length} item${infoItems.length === 1 ? '' : 's'}</span></div>
        <div class="timeline-lane" style="width:${laneWidth}px">${showNow ? `<div class="timeline-now" style="left:${nowLeft}px"></div>` : ''}${infoBlocks}</div>
      </div>`;
  }

  body.innerHTML = people.map(name => {
    const rowItems = items
      .filter(item => item.name === name)
      .sort((a, b) => a.start - b.start);

    const blocks = rowItems.map(item => {
      const left = (minutesBetween(start, item.start) / totalMinutes) * laneWidth;
      const width = Math.max(56, (minutesBetween(item.start, item.end) / totalMinutes) * laneWidth);
      return `
        <div class="timeline-block ${categoryClass(item.shift.category)}${name === state.person ? ' mine' : ''}" style="left:${left}px;width:${width}px" title="${escapeHtml(item.shift.what)} · ${item.assignment.slot} · ${escapeHtml(item.shift.where || '')}${item.shift.notes ? ' · ' + escapeHtml(item.shift.notes) : ''}">
          <div class="tb-what">${escapeHtml(item.shift.what)}</div>
        </div>`;
    }).join('');

    return `
      <div class="timeline-row${rowItems.length ? '' : ' timeline-row-empty'}">
        <div class="timeline-name"><strong>${escapeHtml(name)}</strong><span>${rowItems.length} assignment${rowItems.length === 1 ? '' : 's'}</span></div>
        <div class="timeline-lane" style="width:${laneWidth}px">${showNow ? `<div class="timeline-now" style="left:${nowLeft}px"></div>` : ''}${blocks}</div>
      </div>`;
  }).join('');
}

function now0() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate(), 0, 0, 0, 0);
}

function renderTable(data) {
  const body = document.getElementById('tableBody');
  const empty = document.getElementById('tableEmpty');

  if (!data.length) {
    body.innerHTML = '';
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';
  body.innerHTML = data.map(s => {
    const status = statusForShift(s);
    return `
      <tr class="${urgencyClass(s)}">
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
  renderStats(data);
  document.getElementById('resultLabel').textContent =
    data.length + ' shift' + (data.length !== 1 ? 's' : '') + ' shown' + (state.person ? ' · ' + state.person : '');
  renderCards(data);
  renderTable(data);
  renderTimeline();
  updateNotifyButton();
  save();
}

function setView(v) {
  state.view = v;
  document.getElementById('cardsView').classList.toggle('active', v === 'cards');
  document.getElementById('tableView').classList.toggle('active', v === 'table');
  document.getElementById('timelineView').classList.toggle('active', v === 'timeline');
  document.getElementById('btnCards').classList.toggle('active', v === 'cards');
  document.getElementById('btnTable').classList.toggle('active', v === 'table');
  document.getElementById('btnTimeline').classList.toggle('active', v === 'timeline');
}

function toggleView() {
  const order = ['cards', 'table', 'timeline'];
  const idx = order.indexOf(state.view);
  setView(order[(idx + 1) % order.length]);
  render();
}

function setPersonFilter(p) {
  state.person = p;
  document.getElementById('personSelect').value = p;
  render();
}

function setMyShifts() {
  const p = document.getElementById('personSelect').value || PHOTOGRAPHERS[0];
  setPersonFilter(p);
}

function startTitleBlink(hero, label) {
  if (!document.hidden) return;
  if (titleBlinkTimer) return;
  let on = false;
  titleBlinkTimer = setInterval(() => {
    on = !on;
    document.title = on ? `⏰ ${hero.what} · ${label}` : ORIGINAL_TITLE;
  }, 900);
}

function stopTitleBlink() {
  if (titleBlinkTimer) clearInterval(titleBlinkTimer);
  titleBlinkTimer = null;
  document.title = ORIGINAL_TITLE;
}

function beep(level) {
  if (!audioUnlocked) return;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  const ctx = new Ctx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = level === 'now' ? 1046 : level === '5' ? 988 : 880;
  gain.gain.value = 0.025;
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.2);
}

function notify(shift, label) {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  const body = `${label || 'Upcoming shift'} • ${shift.what} • ${shift.where || 'No location'}`;
  new Notification('ShiftBoard alert', {
    body,
    tag: `shift-${shift.id}-${label}`,
    renotify: true,
  });
}

function maybeAlert(shift, level, label) {
  if (!level) return;
  const key = `${shift.id}-${state.person || 'all'}-${level}`;
  if (notifiedIds.has(key)) return;
  notifiedIds.add(key);
  beep(level);
  if (document.hidden) notify(shift, label);
  save();
}

async function requestNotifications() {
  if (!('Notification' in window)) return;
  const permission = await Notification.requestPermission();
  updateNotifyButton(permission);
}

let refreshTimer = null;

function applyRefreshInterval() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = null;
  const seconds = Number(state.refreshSeconds || 0);
  const sel = document.getElementById('refreshSelect');
  if (sel) sel.value = String(seconds);
  if (seconds > 0) refreshTimer = setInterval(loadData, seconds * 1000);
}

function updateNotifyButton(permissionOverride) {
  const btn = document.getElementById('notifyBtn');
  if (!btn) return;
  if (!('Notification' in window)) {
    btn.textContent = '🔕';
    btn.title = 'Notifications not supported';
    return;
  }
  const p = permissionOverride || Notification.permission;
  btn.textContent = p === 'granted' ? '🔔' : p === 'denied' ? '🔕' : '🛎️';
  btn.title = p === 'granted' ? 'Notifications enabled' : p === 'denied' ? 'Notifications blocked' : 'Enable browser notifications';
}

async function loadData() {
  document.getElementById('loadingMsg').style.display = 'block';
  try {
    let data = null;

    if (location.protocol !== 'file:') {
      const res = await fetch(DATA_URL + '?t=' + Date.now(), { cache: 'no-store' });
      data = await res.json();
      document.getElementById('lastLoaded').textContent = 'JSON loaded · ' + new Date().toLocaleTimeString();
    } else if (EMBEDDED_DATA) {
      data = EMBEDDED_DATA;
      document.getElementById('lastLoaded').textContent = 'Embedded test data loaded · ' + new Date().toLocaleTimeString();
    } else {
      throw new Error('Local file mode cannot fetch JSON. Use a local web server or embed test data.');
    }

    RAW = data.shifts || [];
    PHOTOGRAPHERS = [...new Set(RAW.flatMap(s => s.assigned.map(a => a.name)))].sort();
    populateFilters();
    render();
  } catch (e) {
    document.getElementById('lastLoaded').textContent = 'Failed to load JSON';
    console.error(e);
  } finally {
    document.getElementById('loadingMsg').style.display = 'none';
  }
}

document.getElementById('searchInput').addEventListener('input', e => {
  state.search = e.target.value;
  render();
});

document.getElementById('personSelect').addEventListener('change', e => {
  state.person = e.target.value;
  render();
});

document.getElementById('catFilter').addEventListener('change', e => {
  state.cat = e.target.value;
  render();
});

document.getElementById('relFilter').addEventListener('change', e => {
  state.rel = e.target.value;
  render();
});

document.getElementById('refreshSelect').addEventListener('change', e => {
  state.refreshSeconds = Number(e.target.value || '0');
  applyRefreshInterval();
  save();
});

document.getElementById('btnCards').addEventListener('click', () => {
  setView('cards');
  render();
});

document.getElementById('btnTable').addEventListener('click', () => {
  setView('table');
  render();
});

document.getElementById('btnTimeline').addEventListener('click', () => {
  setView('timeline');
  render();
});

document.getElementById('notifyBtn').addEventListener('click', requestNotifications);

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

document.addEventListener('click', () => {
  audioUnlocked = true;
}, { once: true });

document.addEventListener('keydown', () => {
  audioUnlocked = true;
}, { once: true });

const themeBtn = document.getElementById('themeToggle');
let theme = localStorage.getItem('sb_theme') || (matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light');
document.documentElement.setAttribute('data-theme', theme);
themeBtn.textContent = theme === 'dark' ? '☀︎' : '◐';

themeBtn.addEventListener('click', () => {
  theme = theme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('sb_theme', theme);
  themeBtn.textContent = theme === 'dark' ? '☀︎' : '◐';
});

setView(['cards','table','timeline'].includes(state.view) ? state.view : 'cards');
updateNotifyButton();
applyRefreshInterval();
loadData();
setInterval(render, 30000);