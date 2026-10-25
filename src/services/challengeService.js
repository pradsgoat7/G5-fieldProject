// One challenge per ISO week (Monday to Sunday), rotating through this list.
// Text lives in the translation files under community.challenges.<id>
export const CHALLENGES = ['bag_free', 'no_straws', 'own_bottle', 'no_cutlery', 'segregate', 'refill', 'no_wrappers'];

export const getWeekInfo = (date = new Date()) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const isoDay = d.getUTCDay() || 7;
  // The ISO week belongs to the year of its Thursday
  d.setUTCDate(d.getUTCDate() + 4 - isoDay);
  const year = d.getUTCFullYear();
  const week = Math.ceil(((d - Date.UTC(year, 0, 1)) / 86400000 + 1) / 7);
  return {
    weekId: `${year}-W${String(week).padStart(2, '0')}`,
    challengeId: CHALLENGES[(year * 53 + week) % CHALLENGES.length],
    daysLeft: 7 - ((date.getDay() || 7))
  };
};

// One document per member per week, so joining twice is impossible
export const joinDocId = (weekId, uid) => `${weekId}_${uid}`;

export const participationShare = (joinedCount, memberCount) =>
  memberCount > 0 ? Math.min(joinedCount / memberCount, 1) : 0;
