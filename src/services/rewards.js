import { translate } from '../i18n';

// Redemptions store the English title, so history can be translated back by matching it
export const REWARDS = [
  { id: 'water_bill', title: 'Water Bill Discount', points: 500, icon: 'water-percent' },
  { id: 'property_tax', title: 'Property Tax Reduction', points: 1000, icon: 'home-city-outline' },
  { id: 'certificate', title: 'Sustainability Certificate', points: 300, icon: 'certificate-outline' },
  { id: 'badge', title: 'Recognition Badge', points: 200, icon: 'medal-outline' },
  { id: 'free_pickup', title: 'Free Recycling Pickup', points: 150, icon: 'recycle' }
];

export const rewardTitle = (reward) => translate(`rewards.items.${reward.id}.title`);
export const rewardDesc = (reward) => translate(`rewards.items.${reward.id}.desc`);

export const translateRewardName = (storedName) => {
  const reward = REWARDS.find(r => r.title === storedName);
  return reward ? rewardTitle(reward) : storedName;
};
