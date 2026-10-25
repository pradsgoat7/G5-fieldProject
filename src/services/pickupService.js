import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as Location from 'expo-location';
import { translate, getLocale } from '../i18n';

// A vendor collects from every society once every 15 days
export const PICKUP_INTERVAL_DAYS = 15;

// Pickup lifecycle: society schedules -> vendor weighs -> BMC official verifies -> society confirms
export const PICKUP_STATUS = {
  SCHEDULED: 'Scheduled',
  WEIGHED: 'Weighed',
  VERIFIED: 'Verified',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled'
};

export const statusLabel = (status) => translate(`status.${status}`);

export const RECYCLABLE_TYPES = [
  { id: 'pet', name: 'PET Bottles' },
  { id: 'hdpe', name: 'HDPE Containers' },
  { id: 'ldpe', name: 'LDPE Bags' },
  { id: 'pp', name: 'PP Containers' },
  { id: 'glass', name: 'Glass Bottles' },
  { id: 'cardboard', name: 'Cardboard / Paper' },
  { id: 'metal', name: 'Metal Cans' }
];

export const NON_RECYCLABLE_TYPES = [
  { id: 'mlp', name: 'MLP Packaging' },
  { id: 'thermocol', name: 'Thermocol / EPS' },
  { id: 'pvc', name: 'PVC Plastic' },
  { id: 'composite', name: 'Composite Packaging' },
  { id: 'cutlery', name: 'Disposable Cutlery' },
  { id: 'thin_film', name: 'Thin Plastic Films' }
];

// Segregation quality, graded by the vendor at pickup and checked by the BMC official
export const GRADES = [
  { id: 'A', multiplier: 1.0 },
  { id: 'B', multiplier: 0.75 },
  { id: 'C', multiplier: 0.5 }
];

export const gradeLabel = (id) => translate(`grade.${id}.label`);
export const gradeDesc = (id) => translate(`grade.${id}.desc`);

const ALL_TYPES = [...RECYCLABLE_TYPES, ...NON_RECYCLABLE_TYPES];

// Plastic names are stored in English; translate by id for display
export const plasticName = (id, fallback) => {
  const key = `plastic.${id}`;
  const text = translate(key);
  return text === key ? (fallback || id) : text;
};

// Older records store a comma-separated list of English names
export const translatePlasticList = (text) => {
  if (!text) return '';
  return text.split(', ').map(name => {
    const type = ALL_TYPES.find(t => t.name === name);
    return type ? plasticName(type.id, name) : name;
  }).join(', ');
};

// Stored in English on the pickup; shown translated
export const TIME_SLOTS = [
  { id: 'morning', value: 'Morning (8am-12pm)' },
  { id: 'afternoon', value: 'Afternoon (12pm-4pm)' },
  { id: 'evening', value: 'Evening (4pm-7pm)' }
];

export const timeSlotLabel = (value) => {
  const slot = TIME_SLOTS.find(s => s.value === value);
  return slot ? translate(`timeSlot.${slot.id}`) : (value || '');
};

export const IMPACT_FACTOR = 10;
export const RECYCLABLE_MF = 1.5;
// Handing over segregated non-recyclables keeps them out of mixed waste, so it still earns (less)
export const NON_RECYCLABLE_MF = 0.5;

export const getGrade = (id) => GRADES.find(g => g.id === id) || GRADES[0];

export const sumKg = (items, category) =>
  items.filter(i => !category || i.category === category).reduce((acc, i) => acc + (i.kg || 0), 0);

export const computeCategoryPoints = (kg, category, gradeId) => {
  const mf = category === 'recyclable' ? RECYCLABLE_MF : NON_RECYCLABLE_MF;
  return Math.round(kg * IMPACT_FACTOR * mf * getGrade(gradeId).multiplier);
};

export const computePickupPoints = (items, gradeId) =>
  computeCategoryPoints(sumKg(items, 'recyclable'), 'recyclable', gradeId) +
  computeCategoryPoints(sumKg(items, 'non_recyclable'), 'non_recyclable', gradeId);

// Dates are stored as 'YYYY-MM-DD' strings in local time
export const toDateString = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const addDays = (dateString, days) => {
  const [y, m, d] = dateString.split('-').map(Number);
  return toDateString(new Date(y, m - 1, d + days));
};

export const daysUntil = (dateString) => {
  const [y, m, d] = dateString.split('-').map(Number);
  const today = new Date();
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((new Date(y, m - 1, d) - todayMidnight) / (24 * 60 * 60 * 1000));
};

export const formatDate = (dateString) => {
  if (!dateString) return '-';
  const [y, m, d] = dateString.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(getLocale(), { day: 'numeric', month: 'short', year: 'numeric' });
};

export const formatTimestamp = (ts) => {
  if (!ts) return '-';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  return date.toLocaleString(getLocale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

export const describeCountdown = (dateString) => {
  const days = daysUntil(dateString);
  if (days > 1) return translate('countdown.inDays', { count: days });
  if (days === 1) return translate('countdown.tomorrow');
  if (days === 0) return translate('countdown.today');
  return translate('countdown.overdue', { count: -days });
};

// Firestore documents are capped at 1 MB, so photos are shrunk to a small JPEG before saving
const MAX_PHOTO_CHARS = 700000;

const compressPhoto = async (uri) => {
  for (const [width, compress] of [[900, 0.5], [700, 0.4], [500, 0.3]]) {
    const context = ImageManipulator.manipulate(uri);
    context.resize({ width });
    const image = await context.renderAsync();
    const result = await image.saveAsync({ compress, format: SaveFormat.JPEG, base64: true });
    const dataUri = `data:image/jpeg;base64,${result.base64}`;
    if (dataUri.length <= MAX_PHOTO_CHARS) return dataUri;
  }
  throw new Error(translate('weigh.photoTooLarge'));
};

// Returns a compressed data URI, or null if the vendor cancelled
export const captureScalePhoto = async () => {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new Error(translate('weigh.cameraPermission'));
  }
  const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
  if (result.canceled || !result.assets?.length) return null;
  return compressPhoto(result.assets[0].uri);
};

// Best effort: a missing location is shown to the BMC official instead of blocking the pickup
export const getCurrentLocation = async () => {
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) return null;
    const position = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise((resolve) => setTimeout(() => resolve(null), 10000))
    ]);
    if (!position) return null;
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy ?? null
    };
  } catch (e) {
    console.error("getCurrentLocation error:", e);
    return null;
  }
};
