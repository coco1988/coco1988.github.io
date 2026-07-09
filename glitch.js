/* ============================================================
   Time-based UI Glitch System
   Phases: 0 (off) / 1 (00:00-00:29) / 2 (00:30-00:59) / 3 (01:00-05:59)
   Glitches fully stop at 06:00.
   Within each phase, intensity ramps 0 -> 1 over the first 10 minutes
   of that phase, then holds at max until the phase changes.
   At full ramp in phase 3, the UI becomes deliberately unusable
   (heavy shake / strobe / overlay) as the climax state.
   ============================================================ */

(function () {
  'use strict';

  const RAMP_MINUTES = 10;

  function getGlitchPhase(now = new Date()) {
    const h = now.getHours();
    const m = now.getMinutes();
    if (h === 0 && m < 30) return 1;
    if (h === 0 && m >= 30) return 2;
    if (h >= 1 && h < 6) return 3;
    return 0; // hard stop at 06:00 and outside 00:00-06:00
  }

  function minutesIntoPhase(now = new Date()) {
    const h = now.getHours();
    const m = now.getMinutes();
    const phase = getGlitchPhase(now);
    if (phase === 0) return 0;
    if (phase === 1) return m;
    if (phase === 2) return m - 30;
    if (phase === 3) return (h - 1) * 60 + m;
    return 0;
  }

  function getProgressState(now = new Date()) {
    const phase = getGlitchPhase(now);
    if (phase === 0) return { phase, progress: 0 };
    const elapsed = minutesIntoPhase(now);
    const progress = Math.max(0, Math.min(1, elapsed / RAMP_MINUTES));
    return { phase, progress };
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function rand(min, max) {
    return Math.random() * (max - min) + min;
  }

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  let currentPhase = 0;
  const activeLoops = new Map();

  function applyPhaseClass(phase) {
    document.body.classList.remove('phase-0', 'phase-1', 'phase-2', 'phase-3');
    document.body.classList.add(`phase-${phase}`);
  }

  function applyMaxoutState(isMaxed) {
    document.body.classList.toggle('glitch-maxout', isMaxed);
  }

  const RANGES = {
    rgb: {
      delay: { 1: [[8000, 16000], [5000, 10000]], 2: [[5000, 11000], [2500, 6000]], 3: [[3000, 8000], [700, 2200]] },
      duration: { 1: [[70, 140], [140, 260]], 2: [[110, 220], [220, 420]], 3: [[160, 340], [400, 900]] },
    },
    cursor: {
      delay: { 1: [[10000, 20000], [6000, 12000]], 2: [[7000, 15000], [3000, 7000]], 3: [[4000, 10000], [900, 2600]] },
      lag: { 1: [[2, 5], [6, 12]], 2: [[4, 10], [12, 22]], 3: [[8, 18], [22, 46]] },
    },
    mirror: {
      delay: { 1: [[16000, 32000], [10000, 20000]], 2: [[10000, 22000], [4500, 10000]], 3: [[6000, 15000], [1200, 3500]] },
      duration: { 1: [[110, 230], [220, 420]], 2: [[180, 400], [360, 700]], 3: [[260, 620], [600, 1200]] },
    },
    glyph: {
      delay: { 2: [[15000, 28000], [7000, 15000]], 3: [[8000, 18000], [1500, 4200]] },
      duration: { 2: [[140, 300], [280, 520]], 3: [[220, 480], [500, 950]] },
    },
    corrupt: {
      delay: { 2: [[17000, 30000], [8000, 16000]], 3: [[9000, 20000], [1800, 4800]] },
      intensity: { 2: [0.14, 0.32], 3: [0.28, 0.65] },
      duration: { 2: [[110, 240], [220, 420]], 3: [[180, 400], [420, 850]] },
    },
    smear: {
      delay: { 2: [[19000, 34000], [9000, 18000]], 3: [[10000, 22000], [2000, 5500]] },
      duration: { 2: [[170, 340], [320, 600]], 3: [[280, 560], [560, 1100]] },
    },
    slip: {
      delay: { 2: [[21000, 38000], [10000, 20000]], 3: [[11000, 24000], [2500, 6500]] },
      duration: { 2: [[60, 140], [140, 280]], 3: [[110, 250], [260, 700]] },
    },
    vhs: {
      delay: { 2: [[18000, 32000], [8500, 17000]], 3: [[9000, 19000], [1800, 5000]] },
      height: { 2: [[6, 16], [14, 32]], 3: [[12, 30], [30, 70]] },
      duration: { 2: [[140, 290], [280, 520]], 3: [[240, 480], [480, 950]] },
    },
    bars: {
      delay: { 3: [[12000, 24000], [3000, 8000]] },
      duration: { 3: [[80, 200], [200, 420]] },
    },
  };

  function interp(range2, progress) {
    const [base, peak] = range2;
    return [lerp(base[0], peak[0], progress), lerp(base[1], peak[1], progress)];
  }

  function liveDelay(effectKey) {
    const { phase, progress } = getProgressState();
    const table = RANGES[effectKey].delay[phase];
    if (!table) return null;
    const [min, max] = interp(table, progress);
    return rand(min, max);
  }

  function scheduleRgbSplit() {
    clearTimeout(activeLoops.get('rgb'));
    if (currentPhase === 0) return;

    const delay = liveDelay('rgb');
    if (delay === null) return;

    const id = setTimeout(() => {
      const { phase, progress } = getProgressState();
      const durTable = RANGES.rgb.duration[phase];
      const [durMin, durMax] = durTable ? interp(durTable, progress) : [100, 200];
      document.body.classList.add('glitch-rgb-active');
      setTimeout(() => document.body.classList.remove('glitch-rgb-active'), rand(durMin, durMax));
      scheduleRgbSplit();
    }, delay);

    activeLoops.set('rgb', id);
  }

  let ghostLayer = null;
  function ensureGhostLayer() {
    if (ghostLayer) return ghostLayer;
    ghostLayer = document.createElement('div');
    ghostLayer.className = 'glitch-cursor-ghost';
    document.body.appendChild(ghostLayer);
    return ghostLayer;
  }

  let lastMouseX = null;
  let lastMouseY = null;
  function trackMouse(e) {
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
  }

  function scheduleCursorGhost() {
    clearTimeout(activeLoops.get('cursor'));
    if (currentPhase === 0) return;

    const delay = liveDelay('cursor');
    if (delay === null) return;

    const id = setTimeout(() => {
      if (lastMouseX !== null) {
        const { phase, progress } = getProgressState();
        const lagTable = RANGES.cursor.lag[phase];
        const [lagMin, lagMax] = lagTable ? interp(lagTable, progress) : [2, 6];
        const lag = rand(lagMin, lagMax);
        const ghost = ensureGhostLayer();
        ghost.style.left = `${lastMouseX + rand(-lag, lag)}px`;
        ghost.style.top = `${lastMouseY + rand(-lag, lag)}px`;
        ghost.classList.add('active');
        setTimeout(() => ghost.classList.remove('active'), rand(250, 600));
      }
      scheduleCursorGhost();
    }, delay);

    activeLoops.set('cursor', id);
  }

  function scheduleMirrorSlice() {
    clearTimeout(activeLoops.get('mirror'));
    if (currentPhase === 0) return;

    const delay = liveDelay('mirror');
    if (delay === null) return;

    const id = setTimeout(() => {
      const candidates = document.querySelectorAll('.card-what, .hero-what, .title, td, .tag');
      if (candidates.length) {
        const el = pick(Array.from(candidates));
        if (el && !el.classList.contains('glitch-lock')) {
          const { phase, progress } = getProgressState();
          const durTable = RANGES.mirror.duration[phase];
          const [durMin, durMax] = durTable ? interp(durTable, progress) : [120, 260];
          el.classList.add('glitch-lock', 'glitch-mirror-slice');
          setTimeout(() => el.classList.remove('glitch-mirror-slice', 'glitch-lock'), rand(durMin, durMax));
        }
      }
      scheduleMirrorSlice();
    }, delay);

    activeLoops.set('mirror', id);
  }

  function scheduleGlyphFlip() {
    clearTimeout(activeLoops.get('glyph'));
    if (currentPhase < 2) return;

    const delay = liveDelay('glyph');
    if (delay === null) return;

    const id = setTimeout(() => {
      const candidates = document.querySelectorAll('.card-what, .hero-what, td');
      if (candidates.length) {
        const el = pick(Array.from(candidates));
        if (el && !el.classList.contains('glitch-lock')) {
          const { phase, progress } = getProgressState();
          const durTable = RANGES.glyph.duration[phase];
          const [durMin, durMax] = durTable ? interp(durTable, progress) : [150, 300];
          el.classList.add('glitch-lock', 'glitch-glyph-flip');
          setTimeout(() => el.classList.remove('glitch-glyph-flip', 'glitch-lock'), rand(durMin, durMax));
        }
      }
      scheduleGlyphFlip();
    }, delay);

    activeLoops.set('glyph', id);
  }

  const corruptChars = ['#', '%', '¤', '§', '¥', '±', '‡', '¬'];
  function corruptText(str, intensity) {
    const chars = str.split('');
    const swaps = Math.max(1, Math.floor(chars.length * intensity));
    for (let i = 0; i < swaps; i++) {
      const idx = Math.floor(Math.random() * chars.length);
      if (chars[idx].trim()) chars[idx] = pick(corruptChars);
    }
    return chars.join('');
  }

  function scheduleWordCorruption() {
    clearTimeout(activeLoops.get('corrupt'));
    if (currentPhase < 2) return;

    const delay = liveDelay('corrupt');
    if (delay === null) return;

    const id = setTimeout(() => {
      const candidates = document.querySelectorAll('.tag, .sl, .card-where');
      if (candidates.length) {
        const el = pick(Array.from(candidates));
        if (el && !el.classList.contains('glitch-lock') && el.textContent.trim()) {
          const { phase, progress } = getProgressState();
          const intTable = RANGES.corrupt.intensity[phase];
          const intensity = intTable ? lerp(intTable[0], intTable[1], progress) : 0.15;
          const durTable = RANGES.corrupt.duration[phase];
          const [durMin, durMax] = durTable ? interp(durTable, progress) : [120, 260];
          el.classList.add('glitch-lock');
          const original = el.textContent;
          el.textContent = corruptText(original, intensity);
          setTimeout(() => {
            el.textContent = original;
            el.classList.remove('glitch-lock');
          }, rand(durMin, durMax));
        }
      }
      scheduleWordCorruption();
    }, delay);

    activeLoops.set('corrupt', id);
  }

  function scheduleGlitchBars() {
    clearTimeout(activeLoops.get('bars'));
    if (currentPhase < 3) return;

    const delay = liveDelay('bars');
    if (delay === null) return;

    const id = setTimeout(() => {
      const { phase, progress } = getProgressState();
      const durTable = RANGES.bars.duration[phase];
      const [durMin, durMax] = durTable ? interp(durTable, progress) : [90, 220];
      const count = progress > 0.7 ? Math.round(lerp(1, 4, (progress - 0.7) / 0.3)) : 1;
      for (let i = 0; i < count; i++) {
        const bar = document.createElement('div');
        bar.className = 'glitch-bar';
        bar.style.top = `${rand(0, 100)}vh`;
        bar.style.height = `${rand(2, 10)}px`;
        document.body.appendChild(bar);
        setTimeout(() => bar.remove(), rand(durMin, durMax));
      }
      scheduleGlitchBars();
    }, delay);

    activeLoops.set('bars', id);
  }

  function scheduleSmear() {
    clearTimeout(activeLoops.get('smear'));
    if (currentPhase < 2) return;

    const delay = liveDelay('smear');
    if (delay === null) return;

    const id = setTimeout(() => {
      const candidates = document.querySelectorAll('.card, .hero-card, .logo, .icon-btn');
      if (candidates.length) {
        const el = pick(Array.from(candidates));
        if (el && !el.classList.contains('glitch-lock')) {
          const { phase, progress } = getProgressState();
          const durTable = RANGES.smear.duration[phase];
          const [durMin, durMax] = durTable ? interp(durTable, progress) : [180, 350];
          el.classList.add('glitch-lock', 'glitch-smear');
          setTimeout(() => el.classList.remove('glitch-smear', 'glitch-lock'), rand(durMin, durMax));
        }
      }
      scheduleSmear();
    }, delay);

    activeLoops.set('smear', id);
  }

  function scheduleLayoutSlip() {
    clearTimeout(activeLoops.get('slip'));
    if (currentPhase < 2) return;

    const delay = liveDelay('slip');
    if (delay === null) return;

    const id = setTimeout(() => {
      const { phase, progress } = getProgressState();
      const durTable = RANGES.slip.duration[phase];
      const [durMin, durMax] = durTable ? interp(durTable, progress) : [70, 150];
      document.body.classList.add('glitch-layout-slip');
      setTimeout(() => document.body.classList.remove('glitch-layout-slip'), rand(durMin, durMax));
      scheduleLayoutSlip();
    }, delay);

    activeLoops.set('slip', id);
  }

  let vhsLayer = null;
  function ensureVhsLayer() {
    if (vhsLayer) return vhsLayer;
    vhsLayer = document.createElement('div');
    vhsLayer.className = 'glitch-vhs-tear';
    document.body.appendChild(vhsLayer);
    return vhsLayer;
  }

  function scheduleVhsTear() {
    clearTimeout(activeLoops.get('vhs'));
    if (currentPhase < 2) return;

    const delay = liveDelay('vhs');
    if (delay === null) return;

    const id = setTimeout(() => {
      const { phase, progress } = getProgressState();
      const heightTable = RANGES.vhs.height[phase];
      const [hMin, hMax] = heightTable ? interp(heightTable, progress) : [6, 16];
      const durTable = RANGES.vhs.duration[phase];
      const [durMin, durMax] = durTable ? interp(durTable, progress) : [150, 300];
      const layer = ensureVhsLayer();
      layer.style.height = `${rand(hMin, hMax)}px`;
      layer.classList.add('active');
      setTimeout(() => layer.classList.remove('active'), rand(durMin, durMax));
      scheduleVhsTear();
    }, delay);

    activeLoops.set('vhs', id);
  }

  let maxoutTimer = null;
  function scheduleMaxoutWatch() {
    clearTimeout(maxoutTimer);
    if (currentPhase === 0) {
      applyMaxoutState(false);
      return;
    }
    const { phase, progress } = getProgressState();
    applyMaxoutState(phase === 3 && progress >= 1);
    maxoutTimer = setTimeout(scheduleMaxoutWatch, rand(2000, 4000));
  }

  function stopAllLoops() {
    activeLoops.forEach(id => clearTimeout(id));
    activeLoops.clear();
    clearTimeout(maxoutTimer);
    applyMaxoutState(false);
  }

  function startLoopsForPhase(phase) {
    stopAllLoops();
    if (phase === 0) return;

    scheduleRgbSplit();
    scheduleCursorGhost();
    scheduleMirrorSlice();

    if (phase >= 2) {
      scheduleGlyphFlip();
      scheduleWordCorruption();
      scheduleSmear();
      scheduleLayoutSlip();
      scheduleVhsTear();
    }

    if (phase >= 3) {
      scheduleGlitchBars();
    }

    scheduleMaxoutWatch();
  }

  function checkPhase() {
    const phase = getGlitchPhase();
    if (phase !== currentPhase) {
      currentPhase = phase;
      applyPhaseClass(phase);
      startLoopsForPhase(phase);
    }
  }

  function initGlitchSystem() {
    document.addEventListener('mousemove', trackMouse, { passive: true });
    currentPhase = getGlitchPhase();
    applyPhaseClass(currentPhase);
    startLoopsForPhase(currentPhase);

    const nextCheckDelay = () => rand(15000, 30000);
    function loop() {
      checkPhase();
      setTimeout(loop, nextCheckDelay());
    }
    setTimeout(loop, nextCheckDelay());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGlitchSystem);
  } else {
    initGlitchSystem();
  }

  window.__glitchSystem = { getGlitchPhase, getProgressState };
})();