(function () {
  function pad(n) { return String(n).padStart(2, '0'); }

  function dateLabel(date) {
    const mm = pad(date.getMonth() + 1);
    const dd = pad(date.getDate());
    const wd = date.toLocaleDateString(undefined, { weekday: 'short' });
    return `${mm}-${dd} ${wd}`;
  }

  function timeLabel(date) { return `${pad(date.getHours())}:${pad(date.getMinutes())}`; }

  function addMinutes(date, minutes) { return new Date(date.getTime() + minutes * 60000); }

  function shift(id, start, end, what, where, category, relevant, notes, comment, assigned) {
    return { id, date: dateLabel(start), from: timeLabel(start), till: timeLabel(end), what, where, category, relevant, notes, comment, assigned };
  }

  // X-marked shift: no fixed timespan, done "anytime" that day. from/till are literal 'X'.
  function xShift(id, day, what, where, category, relevant, notes, comment, assigned) {
    return { id, date: dateLabel(day), from: 'X', till: 'X', what, where, category, relevant, notes, comment, assigned };
  }

  const now = new Date();
  const today0730 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 7, 30, 0, 0);
  const today0800 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0, 0, 0);
  const today0830 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 30, 0, 0);
  const today1030 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 30, 0, 0);
  const today1200 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0);
  const today1330 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 13, 30, 0, 0);
  const today1730 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 17, 30, 0, 0);
  const today1830 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 18, 30, 0, 0);
  const today1930 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 19, 30, 0, 0);

  const in3 = addMinutes(now, 3);
  const in8 = addMinutes(now, 8);
  const in12 = addMinutes(now, 12);
  const in45 = addMinutes(now, 45);
  const in90 = addMinutes(now, 90);
  const in120 = addMinutes(now, 120);
  const in150 = addMinutes(now, 150);
  const in180 = addMinutes(now, 180);
  const in210 = addMinutes(now, 210);
  const in240 = addMinutes(now, 240);
  const in270 = addMinutes(now, 270);
  const in300 = addMinutes(now, 300);
  const in330 = addMinutes(now, 330);
  const in360 = addMinutes(now, 360);

  const ongoingStart = addMinutes(now, -20);
  const ongoingEnd = addMinutes(now, 25);

  const past180Start = addMinutes(now, -180);
  const past180End = addMinutes(now, -150);

  const past120Start = addMinutes(now, -120);
  const past120End = addMinutes(now, -95);

  const past60Start = addMinutes(now, -60);
  const past60End = addMinutes(now, -35);

  const past30Start = addMinutes(now, -30);
  const past30End = addMinutes(now, -22);

  const overnightStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 20, 0, 0);
  const overnightEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 40, 0, 0);

  const tomorrowMorning = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9, 0, 0, 0);
  const tomorrowNoon = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 12, 30, 0, 0);
  const tomorrowAfternoon = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 15, 45, 0, 0);
  const tomorrowEvening = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 20, 0, 0, 0);

  const dayAfter = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2, 15, 0, 0, 0);
  const dayAfterMorning = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2, 9, 30, 0, 0);
  const dayAfterEvening = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2, 19, 0, 0, 0);

  const dayThree = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3, 10, 0, 0, 0);
  const dayThreeAfternoon = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3, 16, 30, 0, 0);

  window.SHIFTBOARD_DATA = {
    shifts: [
      shift('info-opening', today0800, today1730, 'Event site open', 'Whole venue', 'Info', 'info',
        'Venue is open to all staff and press from morning until late afternoon.', '', []),

      shift('info-lunch', today1200, today1330, 'Lunch break', 'Staff Canteen', 'Info', 'info',
        'Lunch is served in the staff canteen. Overlap with your shift is fine, grab food whenever you can.', '', []),

      shift('info-dinner', today1830, today1930, 'Dinner break', 'Staff Canteen', 'Info', 'info',
        'Dinner is served in the staff canteen.', '', []),

      // ---- Past-today shifts: already finished, tests fade-out behavior ----
      shift('test-past-3h', past180Start, past180End, 'Morning Gate Check', 'Main Entrance', 'Officials', 'yes',
        'Finished earlier today. Should appear faded by default.', '', [
          { name: 'photographer1', slot: `${timeLabel(past180Start)} - ${timeLabel(past180End)}` },
        ]),

      shift('test-past-2h', past120Start, past120End, 'Sponsor Walkthrough', 'VIP Lounge', 'Partner', 'yes',
        'Completed without issues. Tests fade-out for a two-person past shift.', '', [
          { name: 'photographer2', slot: `${timeLabel(past120Start)} - ${timeLabel(past120End)}` },
          { name: 'photographer3', slot: `${timeLabel(past120Start)} - ${timeLabel(past120End)}` },
        ]),

      shift('test-past-1h', past60Start, past60End, 'Team Arrival Coverage', 'South Gate', 'Teams', 'yes',
        'Tests fade-out for a shift that ended about an hour ago.', '', [
          { name: 'photographer4', slot: `${timeLabel(past60Start)} - ${timeLabel(past60End)}` },
        ]),

      shift('test-past-recent', past30Start, past30End, 'Warmup Zone Photos', 'Warmup Area', 'Dynamics', 'yes',
        'Tests fade-out for a shift that only just ended.', '', [
          { name: 'photographer5', slot: `${timeLabel(past30Start)} - ${timeLabel(past30End)}` },
        ]),

      shift('test-ongoing-personal', ongoingStart, ongoingEnd, 'Live ongoing shift', 'Main Arena', 'PR Media', 'yes',
        'Should show Ongoing now.\nMultiline note line 2.', 'Runbook: https://example.com/runbook', [
          { name: 'photographer1', slot: `${timeLabel(addMinutes(now, -15))} - ${timeLabel(addMinutes(now, 10))}` },
          { name: 'photographer2', slot: `${timeLabel(addMinutes(now, -10))} - ${timeLabel(addMinutes(now, 20))}` },
        ]),

      shift('test-upcoming-3', in3, addMinutes(in3, 30), 'Media Center Coverage', 'Media Center', 'Statics', 'yes',
        'Tests continuous beep in the last 5 minutes and title flash.', 'Map: https://example.com/map', [
          { name: 'photographer3', slot: `${timeLabel(in3)} - ${timeLabel(addMinutes(in3, 20))}` },
          { name: 'photographer4', slot: `${timeLabel(addMinutes(in3, 5))} - ${timeLabel(addMinutes(in3, 25))}` },
        ]),

      shift('test-upcoming-8', in8, addMinutes(in8, 30), 'Press Box Coverage', 'Press Box', 'Statics', 'yes',
        'Tests the 10-minute single beep threshold.', '', [
          { name: 'photographer2', slot: `${timeLabel(in8)} - ${timeLabel(addMinutes(in8, 20))}` },
        ]),

      shift('test-upcoming-12', in12, addMinutes(in12, 35), 'VIP Tunnel Coverage', 'VIP Tunnel', 'Officials', 'yes',
        'Tests the 15-minute single beep threshold.', 'Notes: https://example.com/officials', [
          { name: 'photographer1', slot: `${timeLabel(in12)} - ${timeLabel(addMinutes(in12, 25))}` },
        ]),

      shift('test-no-assigned', in45, addMinutes(in45, 30), 'Unassigned future shift', 'Warmup Area', 'Inspection', 'yes',
        'No photographer assigned.', '', []),

      shift('test-personal-slot-earlier', today0730, today1200, 'Long shift with early personal slot', 'North Track', 'Dynamics', 'yes',
        'Use this to verify that a personal slot can be finished even while the overall shift is still running.',
        'Reference: https://example.com/dynamics', [
          { name: 'photographer3', slot: `${timeLabel(today0830)} - ${timeLabel(today1030)}` },
          { name: 'photographer4', slot: `${timeLabel(addMinutes(now, 20))} - ${timeLabel(addMinutes(now, 70))}` },
        ]),

      shift('test-info-only', in90, addMinutes(in90, 25), 'Info-only row', 'Volunteer Desk', 'Place', 'info',
        'Tests relevance filter = info.', 'Guide: https://example.com/info', [
          { name: 'photographer5', slot: `${timeLabel(in90)} - ${timeLabel(addMinutes(in90, 20))}` },
        ]),

      shift('test-multi-assigned', in120, addMinutes(in120, 40), 'Multiple assigned lines', 'South Gate', 'Teams', 'yes',
        'Each person should stay on one line, but every person should be on a separate row.',
        'Teams info: https://example.com/teams', [
          { name: 'photographer2', slot: `${timeLabel(in120)} - ${timeLabel(addMinutes(in120, 20))}` },
          { name: 'photographer5', slot: `${timeLabel(addMinutes(in120, 10))} - ${timeLabel(addMinutes(in120, 30))}` },
          { name: 'photographer6', slot: `${timeLabel(addMinutes(in120, 20))} - ${timeLabel(addMinutes(in120, 40))}` },
        ]),

      shift('test-overnight', overnightStart, overnightEnd, 'Overnight shift', 'External Plaza', 'External', 'yes',
        'Tests cross-midnight handling.', 'Night plan: https://example.com/night', [
          { name: 'photographer5', slot: `${timeLabel(overnightStart)} - ${timeLabel(addMinutes(overnightStart, 35))}` },
        ]),

      shift('test-tk', in150, addMinutes(in150, 40), 'TK support slot', 'TK Office', 'TK', 'yes',
        'Tests TK category color.', 'TK notes: https://example.com/tk', [
          { name: 'photographer3', slot: `${timeLabel(in150)} - ${timeLabel(addMinutes(in150, 30))}` },
        ]),

      shift('test-partner', in180, addMinutes(in180, 45), 'Partner meeting coverage', 'Partner Lounge', 'Partner', 'yes',
        'Tests partner color.', 'Partner notes: https://example.com/partner', [
          { name: 'photographer4', slot: `${timeLabel(in180)} - ${timeLabel(addMinutes(in180, 25))}` },
        ]),

      shift('test-podium', in210, addMinutes(in210, 30), 'Podium ceremony', 'Podium Stage', 'PR Media', 'yes',
        'Tests overlapping shifts across photographers.', 'Ceremony sheet: https://example.com/podium', [
          { name: 'photographer1', slot: `${timeLabel(in210)} - ${timeLabel(addMinutes(in210, 20))}` },
          { name: 'photographer6', slot: `${timeLabel(addMinutes(in210, 5))} - ${timeLabel(addMinutes(in210, 30))}` },
        ]),

      shift('test-mixed-zone', in240, addMinutes(in240, 35), 'Mixed zone interviews', 'Mixed Zone', 'PR Media', 'yes',
        'Tests a long descriptive note field for wrapping behavior in cards and table.',
        'Interview list: https://example.com/mixedzone', [
          { name: 'photographer2', slot: `${timeLabel(in240)} - ${timeLabel(addMinutes(in240, 25))}` },
        ]),

      shift('test-broadcast', in270, addMinutes(in270, 40), 'Broadcast compound coverage', 'Broadcast Compound', 'External', 'yes',
        'Tests External category and a third-party access note.', 'Access: https://example.com/broadcast', [
          { name: 'photographer5', slot: `${timeLabel(in270)} - ${timeLabel(addMinutes(in270, 30))}` },
        ]),

      shift('test-warehouse', in300, addMinutes(in300, 20), 'Equipment check', 'Warehouse', 'Inspection', 'yes',
        'Short technical shift.', '', [
          { name: 'photographer6', slot: `${timeLabel(in300)} - ${timeLabel(addMinutes(in300, 20))}` },
        ]),

      shift('test-academy-today', in330, addMinutes(in330, 45), 'Academy afternoon session', 'Academy Hall', 'Academy', 'yes',
        'Tests Academy category later today.', 'Academy: https://example.com/academy-today', [
          { name: 'photographer3', slot: `${timeLabel(in330)} - ${timeLabel(addMinutes(in330, 30))}` },
        ]),

      shift('test-meals-today', in360, addMinutes(in360, 30), 'Evening meals coverage', 'Meals Tent', 'Meals', 'yes',
        'Tests Meals category later today.', '', [
          { name: 'photographer1', slot: `${timeLabel(in360)} - ${timeLabel(addMinutes(in360, 20))}` },
        ]),

      // ---- X-marked ("anytime today") shifts: no fixed timespan ----
      xShift('todo-photo-archive', now, 'Archive yesterday\'s photo selection', 'Media Center', 'IT', 'yes',
        'To be done anytime today, no fixed slot.', 'Archive guide: https://example.com/archive', [
          { name: 'photographer2', slot: '' },
        ]),

      xShift('todo-equipment-return', now, 'Return spare lenses to storage', 'Warehouse', 'Inspection', 'yes',
        'Anytime today before end of shift.', '', [
          { name: 'photographer6', slot: '' },
        ]),

      xShift('todo-briefing-notes', now, 'Submit daily briefing notes', 'Media Center', 'PR Media', 'yes',
        'Flexible task, no fixed time window.', 'Template: https://example.com/briefing', [
          { name: 'photographer4', slot: '' },
        ]),

      xShift('todo-battery-charge', tomorrowMorning, 'Charge all camera batteries', 'Media Center', 'Inspection', 'yes',
        'Do this sometime tomorrow before shifts start.', '', [
          { name: 'photographer3', slot: '' },
          { name: 'photographer5', slot: '' },
        ]),

      // ---- Tomorrow ----
      shift('test-tomorrow-1', tomorrowMorning, addMinutes(tomorrowMorning, 50), 'Tomorrow morning slot', 'Academy Hall', 'Academy', 'yes',
        'Tests date chips and tomorrow filter.', 'Academy: https://example.com/academy', [
          { name: 'photographer6', slot: `${timeLabel(tomorrowMorning)} - ${timeLabel(addMinutes(tomorrowMorning, 25))}` },
        ]),

      shift('test-tomorrow-2', tomorrowNoon, addMinutes(tomorrowNoon, 55), 'Tomorrow lunch coverage', 'Meals Tent', 'Meals', 'yes',
        'Tests another category color and next-day data.', 'Menu: https://example.com/meals', [
          { name: 'photographer1', slot: `${timeLabel(tomorrowNoon)} - ${timeLabel(addMinutes(tomorrowNoon, 30))}` },
        ]),

      shift('test-tomorrow-3', tomorrowAfternoon, addMinutes(tomorrowAfternoon, 60), 'Tomorrow afternoon officials round', 'VIP Tunnel', 'Officials', 'yes',
        'Tests Officials category tomorrow afternoon.', '', [
          { name: 'photographer2', slot: `${timeLabel(tomorrowAfternoon)} - ${timeLabel(addMinutes(tomorrowAfternoon, 30))}` },
          { name: 'photographer4', slot: `${timeLabel(addMinutes(tomorrowAfternoon, 30))} - ${timeLabel(addMinutes(tomorrowAfternoon, 60))}` },
        ]),

      shift('test-tomorrow-4', tomorrowEvening, addMinutes(tomorrowEvening, 90), 'Tomorrow evening ceremony', 'Podium Stage', 'PR Media', 'yes',
        'Tests a longer evening shift tomorrow.', 'Ceremony sheet: https://example.com/tomorrow-podium', [
          { name: 'photographer5', slot: `${timeLabel(tomorrowEvening)} - ${timeLabel(addMinutes(tomorrowEvening, 45))}` },
        ]),

      xShift('todo-tomorrow-inventory', tomorrowMorning, 'Full equipment inventory check', 'Warehouse', 'Inspection', 'yes',
        'Anytime tomorrow.', '', [
          { name: 'photographer1', slot: '' },
        ]),

      // ---- Day after ----
      shift('test-day-after', dayAfter, addMinutes(dayAfter, 45), 'Later future slot', 'Tech Hub', 'IT', 'yes',
        'Tests another date and category.', 'IT page: https://example.com/it', [
          { name: 'photographer2', slot: `${timeLabel(dayAfter)} - ${timeLabel(addMinutes(dayAfter, 30))}` },
        ]),

      shift('test-day-after-morning', dayAfterMorning, addMinutes(dayAfterMorning, 40), 'Day-after morning arena setup', 'Main Arena', 'Dynamics', 'yes',
        'Tests morning slot two days out.', '', [
          { name: 'photographer3', slot: `${timeLabel(dayAfterMorning)} - ${timeLabel(addMinutes(dayAfterMorning, 25))}` },
        ]),

      shift('test-day-after-evening', dayAfterEvening, addMinutes(dayAfterEvening, 50), 'Day-after evening broadcast', 'Broadcast Compound', 'External', 'yes',
        'Tests evening slot two days out.', '', [
          { name: 'photographer6', slot: `${timeLabel(dayAfterEvening)} - ${timeLabel(addMinutes(dayAfterEvening, 30))}` },
        ]),

      // ---- Three days out ----
      shift('test-day-three-morning', dayThree, addMinutes(dayThree, 50), 'Closing day morning coverage', 'Main Arena', 'PR Media', 'yes',
        'Tests a third future date.', '', [
          { name: 'photographer4', slot: `${timeLabel(dayThree)} - ${timeLabel(addMinutes(dayThree, 30))}` },
        ]),

      shift('test-day-three-afternoon', dayThreeAfternoon, addMinutes(dayThreeAfternoon, 60), 'Closing ceremony', 'Podium Stage', 'PR Media', 'yes',
        'Tests final closing ceremony shift.', 'Closing sheet: https://example.com/closing', [
          { name: 'photographer1', slot: `${timeLabel(dayThreeAfternoon)} - ${timeLabel(addMinutes(dayThreeAfternoon, 30))}` },
          { name: 'photographer5', slot: `${timeLabel(addMinutes(dayThreeAfternoon, 15))} - ${timeLabel(addMinutes(dayThreeAfternoon, 45))}` },
        ]),

      xShift('todo-day-three-teardown', dayThree, 'Begin equipment teardown', 'Warehouse', 'Inspection', 'yes',
        'Anytime on the closing day.', '', [
          { name: 'photographer2', slot: '' },
          { name: 'photographer6', slot: '' },
        ]),
    ],
  };
})();