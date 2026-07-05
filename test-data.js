(function () {
  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function dateLabel(date) {
    const mm = pad(date.getMonth() + 1);
    const dd = pad(date.getDate());
    const wd = date.toLocaleDateString(undefined, { weekday: 'short' });
    return `${mm}-${dd} ${wd}`;
  }

  function timeLabel(date) {
    return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function addMinutes(date, minutes) {
    return new Date(date.getTime() + minutes * 60000);
  }

  function shift(id, start, end, what, where, category, relevant, notes, comment, assigned) {
    return {
      id,
      date: dateLabel(start),
      from: timeLabel(start),
      till: timeLabel(end),
      what,
      where,
      category,
      relevant,
      notes,
      comment,
      assigned,
    };
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
  const in12 = addMinutes(now, 12);
  const in45 = addMinutes(now, 45);
  const in120 = addMinutes(now, 120);
  const in180 = addMinutes(now, 180);
  const ongoingStart = addMinutes(now, -20);
  const ongoingEnd = addMinutes(now, 25);
  const overnightStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 20, 0, 0);
  const overnightEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 40, 0, 0);
  const tomorrowMorning = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9, 0, 0, 0);
  const tomorrowNoon = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 12, 30, 0, 0);
  const dayAfter = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2, 15, 0, 0, 0);

  window.SHIFTBOARD_DATA = {
    shifts: [
      shift(
        'info-opening',
        today0800,
        today1730,
        'Event site open',
        'Whole venue',
        'Info',
        'info',
        'Venue is open to all staff and press from morning until late afternoon.',
        '',
        []
      ),
      shift(
        'info-lunch',
        today1200,
        today1330,
        'Lunch break',
        'Staff Canteen',
        'Info',
        'info',
        'Lunch is served in the staff canteen. Overlap with your shift is fine, grab food whenever you can.',
        '',
        []
      ),
      shift(
        'info-dinner',
        today1830,
        today1930,
        'Dinner break',
        'Staff Canteen',
        'Info',
        'info',
        'Dinner is served in the staff canteen.',
        '',
        []
      ),
      shift(
        'test-ongoing-personal',
        ongoingStart,
        ongoingEnd,
        'Live ongoing shift',
        'Main Arena',
        'PR Media',
        'yes',
        'Should show Ongoing now.\nMultiline note line 2.',
        'Runbook: https://example.com/runbook',
        [
          { name: 'photographer1', slot: `${timeLabel(addMinutes(now, -15))} - ${timeLabel(addMinutes(now, 10))}` },
          { name: 'photographer2', slot: `${timeLabel(addMinutes(now, -10))} - ${timeLabel(addMinutes(now, 20))}` },
        ]
      ),
      shift(
        'test-upcoming-3',
        in3,
        addMinutes(in3, 30),
        'Starts in 3 minutes',
        'Media Center',
        'Statics',
        'yes',
        'Tests 5-minute warning and blinking.',
        'Map: https://example.com/map',
        [
          { name: 'photographer3', slot: `${timeLabel(in3)} - ${timeLabel(addMinutes(in3, 20))}` },
          { name: 'photographer4', slot: `${timeLabel(addMinutes(in3, 5))} - ${timeLabel(addMinutes(in3, 25))}` },
        ]
      ),
      shift(
        'test-upcoming-12',
        in12,
        addMinutes(in12, 35),
        'Starts in 12 minutes',
        'VIP Tunnel',
        'Officials',
        'yes',
        'Tests 15-minute warning.',
        'Notes: https://example.com/officials',
        [
          { name: 'photographer1', slot: `${timeLabel(in12)} - ${timeLabel(addMinutes(in12, 25))}` },
        ]
      ),
      shift(
        'test-no-assigned',
        in45,
        addMinutes(in45, 30),
        'Unassigned future shift',
        'Warmup Area',
        'Inspection',
        'yes',
        'No photographer assigned.',
        '',
        []
      ),
      shift(
        'test-personal-slot-earlier',
        today0730,
        today1200,
        'Long shift with early personal slot',
        'North Track',
        'Dynamics',
        'yes',
        'Use this to verify that a personal slot can be finished even while the overall shift is still running.',
        'Reference: https://example.com/dynamics',
        [
          { name: 'photographer3', slot: `${timeLabel(today0830)} - ${timeLabel(today1030)}` },
          { name: 'photographer4', slot: `${timeLabel(addMinutes(now, 20))} - ${timeLabel(addMinutes(now, 70))}` },
        ]
      ),
      shift(
        'test-info-only',
        in120,
        addMinutes(in120, 25),
        'Info-only row',
        'Volunteer Desk',
        'Place',
        'info',
        'Tests relevance filter = info.',
        'Guide: https://example.com/info',
        [
          { name: 'photographer5', slot: `${timeLabel(in120)} - ${timeLabel(addMinutes(in120, 20))}` },
        ]
      ),
      shift(
        'test-multi-assigned',
        in180,
        addMinutes(in180, 40),
        'Multiple assigned lines',
        'South Gate',
        'Teams',
        'yes',
        'Each person should stay on one line, but every person should be on a separate row.',
        'Teams info: https://example.com/teams',
        [
          { name: 'photographer2', slot: `${timeLabel(in180)} - ${timeLabel(addMinutes(in180, 20))}` },
          { name: 'photographer5', slot: `${timeLabel(addMinutes(in180, 10))} - ${timeLabel(addMinutes(in180, 30))}` },
          { name: 'photographer6', slot: `${timeLabel(addMinutes(in180, 20))} - ${timeLabel(addMinutes(in180, 40))}` },
        ]
      ),
      shift(
        'test-overnight',
        overnightStart,
        overnightEnd,
        'Overnight shift',
        'External Plaza',
        'External',
        'yes',
        'Tests cross-midnight handling.',
        'Night plan: https://example.com/night',
        [
          { name: 'photographer5', slot: `${timeLabel(overnightStart)} - ${timeLabel(addMinutes(overnightStart, 35))}` },
        ]
      ),
      shift(
        'test-tomorrow-1',
        tomorrowMorning,
        addMinutes(tomorrowMorning, 50),
        'Tomorrow morning slot',
        'Academy Hall',
        'Academy',
        'yes',
        'Tests date chips and tomorrow filter.',
        'Academy: https://example.com/academy',
        [
          { name: 'photographer6', slot: `${timeLabel(tomorrowMorning)} - ${timeLabel(addMinutes(tomorrowMorning, 25))}` },
        ]
      ),
      shift(
        'test-tomorrow-2',
        tomorrowNoon,
        addMinutes(tomorrowNoon, 55),
        'Tomorrow lunch coverage',
        'Meals Tent',
        'Meals',
        'yes',
        'Tests another category color and next-day data.',
        'Menu: https://example.com/meals',
        [
          { name: 'photographer1', slot: `${timeLabel(tomorrowNoon)} - ${timeLabel(addMinutes(tomorrowNoon, 30))}` },
        ]
      ),
      shift(
        'test-day-after',
        dayAfter,
        addMinutes(dayAfter, 45),
        'Later future slot',
        'Tech Hub',
        'IT',
        'yes',
        'Tests another date and category.',
        'IT page: https://example.com/it',
        [
          { name: 'photographer2', slot: `${timeLabel(dayAfter)} - ${timeLabel(addMinutes(dayAfter, 30))}` },
        ]
      ),
      shift(
        'test-tk',
        addMinutes(now, 240),
        addMinutes(now, 300),
        'TK support slot',
        'TK Office',
        'TK',
        'yes',
        'Tests TK category color.',
        'TK notes: https://example.com/tk',
        [
          { name: 'photographer3', slot: `${timeLabel(addMinutes(now, 240))} - ${timeLabel(addMinutes(now, 280))}` },
        ]
      ),
      shift(
        'test-partner',
        addMinutes(now, 320),
        addMinutes(now, 360),
        'Partner meeting coverage',
        'Partner Lounge',
        'Partner',
        'yes',
        'Tests partner color.',
        'Partner notes: https://example.com/partner',
        [
          { name: 'photographer4', slot: `${timeLabel(addMinutes(now, 320))} - ${timeLabel(addMinutes(now, 345))}` },
        ]
      )
    ]
  };
})();