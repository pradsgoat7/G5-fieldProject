import { PICKUP_STATUS, GRADES, sumKg, daysUntil, toDateString } from './pickupService';

const DAY_MS = 24 * 60 * 60 * 1000;

// A society with no BMC-verified collection in this many days is flagged inactive
export const INACTIVE_AFTER_DAYS = 30;

export const PERIODS = [
  { id: '30', label: 'Last 30 days', days: 30 },
  { id: '90', label: 'Last 90 days', days: 90 },
  { id: 'all', label: 'All time', days: null }
];

// Ordered by how urgently the ward officer should follow up
export const SOCIETY_STATUS = {
  OVERDUE: { id: 'overdue', label: 'Overdue', icon: 'alert-circle', order: 0 },
  NOT_STARTED: { id: 'not_started', label: 'No collections yet', icon: 'clock-outline', order: 1 },
  INACTIVE: { id: 'inactive', label: 'Inactive', icon: 'pause-circle', order: 2 },
  ACTIVE: { id: 'active', label: 'Active', icon: 'check-circle', order: 3 }
};

const toMillis = (ts) => {
  if (!ts) return Date.now(); // serverTimestamp() still pending locally
  return ts.toMillis ? ts.toMillis() : Number(ts);
};

// Verified and Completed pickups both carry a BMC official's sign-off
const isBmcVerified = (p) =>
  [PICKUP_STATUS.VERIFIED, PICKUP_STATUS.COMPLETED].includes(p.status) && Array.isArray(p.items);

const summarize = (pickups) => {
  const gradeCounts = Object.fromEntries(GRADES.map(g => [g.id, 0]));
  const typeKg = {};
  pickups.forEach(p => {
    if (gradeCounts[p.grade] !== undefined) gradeCounts[p.grade] += 1;
    p.items.forEach(item => {
      const key = item.name;
      typeKg[key] = typeKg[key] || { name: item.name, category: item.category, kg: 0 };
      typeKg[key].kg += item.kg;
    });
  });
  const allItems = pickups.flatMap(p => p.items);
  return {
    collections: pickups.length,
    totalKg: sumKg(allItems),
    recyclableKg: sumKg(allItems, 'recyclable'),
    nonRecyclableKg: sumKg(allItems, 'non_recyclable'),
    gradeCounts,
    materials: Object.values(typeKg).sort((a, b) => b.kg - a.kg)
  };
};

export const buildWardReport = (pickups, societies, periodDays, now = Date.now()) => {
  const periodStart = periodDays ? now - periodDays * DAY_MS : 0;
  const verified = pickups.filter(isBmcVerified);
  const inPeriod = verified.filter(p => toMillis(p.verifiedAt) >= periodStart);
  const summary = summarize(inPeriod);

  const societyRows = societies.map(soc => {
    const code = soc.societyCode;
    const mine = verified.filter(p => p.societyCode === code);
    const minePeriod = inPeriod.filter(p => p.societyCode === code);
    const lastVerifiedMs = mine.length ? Math.max(...mine.map(p => toMillis(p.verifiedAt))) : null;
    const upcoming = pickups
      .filter(p => p.societyCode === code && p.status === PICKUP_STATUS.SCHEDULED && p.vendorUid && p.scheduledDate)
      .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))[0];
    const rowSummary = summarize(minePeriod);
    const members = soc.memberCount || 1;

    let status;
    if (upcoming && daysUntil(upcoming.scheduledDate) < 0) status = SOCIETY_STATUS.OVERDUE;
    else if (!lastVerifiedMs) status = SOCIETY_STATUS.NOT_STARTED;
    else if (now - lastVerifiedMs > INACTIVE_AFTER_DAYS * DAY_MS) status = SOCIETY_STATUS.INACTIVE;
    else status = SOCIETY_STATUS.ACTIVE;

    return {
      societyCode: code,
      societyName: soc.societyName || code,
      members,
      status,
      collections: rowSummary.collections,
      totalKg: rowSummary.totalKg,
      recyclableKg: rowSummary.recyclableKg,
      nonRecyclableKg: rowSummary.nonRecyclableKg,
      kgPerMember: rowSummary.totalKg / members,
      gradeAShare: rowSummary.collections ? rowSummary.gradeCounts.A / rowSummary.collections : null,
      lastVerified: lastVerifiedMs ? toDateString(new Date(lastVerifiedMs)) : null,
      nextPickup: upcoming ? upcoming.scheduledDate : null
    };
  }).sort((a, b) => a.status.order - b.status.order || b.totalKg - a.totalKg);

  return {
    ...summary,
    recyclableShare: summary.totalKg ? summary.recyclableKg / summary.totalKg : null,
    gradeAShare: summary.collections ? summary.gradeCounts.A / summary.collections : null,
    totalSocieties: societies.length,
    activeSocieties: societyRows.filter(r => r.status === SOCIETY_STATUS.ACTIVE).length,
    overdueSocieties: societyRows.filter(r => r.status === SOCIETY_STATUS.OVERDUE).length,
    awaitingVerification: pickups.filter(p => p.status === PICKUP_STATUS.WEIGHED).length,
    noPickupScheduled: societyRows.filter(r => !r.nextPickup).length,
    societies: societyRows
  };
};

// kg of BMC-verified plastic per calendar month, oldest first, ending with the current month
export const buildMonthlyTrend = (pickups, months = 6, now = new Date()) => {
  const buckets = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: d.toLocaleDateString(undefined, { month: 'short' }),
      fullLabel: d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
      kg: 0
    });
  }
  pickups.filter(isBmcVerified).forEach(p => {
    const d = new Date(toMillis(p.verifiedAt));
    const bucket = buckets.find(b => b.key === `${d.getFullYear()}-${d.getMonth()}`);
    if (bucket) bucket.kg += p.totalKg || sumKg(p.items);
  });
  return buckets;
};

const csvCell = (value) => {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export const buildWardCsv = (report, periodLabel, wardName) => {
  const rows = [
    ['PlasticTrack Ward Report'],
    ['Ward', wardName],
    ['Period', periodLabel],
    ['Generated', new Date().toLocaleString()],
    [],
    ['BMC-verified plastic collected (kg)', report.totalKg.toFixed(2)],
    ['Recyclable (kg)', report.recyclableKg.toFixed(2)],
    ['Non-recyclable (kg)', report.nonRecyclableKg.toFixed(2)],
    ['Verified collections', report.collections],
    ['Grade A / B / C collections', `${report.gradeCounts.A} / ${report.gradeCounts.B} / ${report.gradeCounts.C}`],
    ['Active societies', `${report.activeSocieties} of ${report.totalSocieties}`],
    [],
    ['Society', 'Society Code', 'Members', 'Status', 'Verified Collections', 'Total kg', 'Recyclable kg',
      'Non-recyclable kg', 'kg per Member', 'Grade A %', 'Last Verified Collection', 'Next Pickup'],
    ...report.societies.map(r => [
      r.societyName, r.societyCode, r.members, r.status.label, r.collections, r.totalKg.toFixed(2),
      r.recyclableKg.toFixed(2), r.nonRecyclableKg.toFixed(2), r.kgPerMember.toFixed(2),
      r.gradeAShare === null ? '' : Math.round(r.gradeAShare * 100), r.lastVerified || '', r.nextPickup || ''
    ])
  ];
  return rows.map(row => row.map(csvCell).join(',')).join('\n');
};
