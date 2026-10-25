import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as Location from 'expo-location';

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

export const STATUS_LABELS = {
  Scheduled: 'Scheduled',
  Weighed: 'Awaiting BMC verification',
  Verified: 'Awaiting society confirmation',
  Completed: 'Completed',
  Cancelled: 'Cancelled'
};

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
  { id: 'A', label: 'A - Well segregated', desc: 'Clean, sorted by type', multiplier: 1.0 },
  { id: 'B', label: 'B - Partly mixed', desc: 'Some mixing or dirty items', multiplier: 0.75 },
  { id: 'C', label: 'C - Mostly mixed', desc: 'Poorly segregated', multiplier: 0.5 }
];

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
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

export const formatTimestamp = (ts) => {
  if (!ts) return '-';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  return date.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

export const describeCountdown = (dateString) => {
  const days = daysUntil(dateString);
  if (days > 1) return `in ${days} days`;
  if (days === 1) return 'tomorrow';
  if (days === 0) return 'today';
  return `overdue by ${-days} day${days === -1 ? '' : 's'}`;
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
  throw new Error('Photo is too large even after compression. Please retake it.');
};

// Returns a compressed data URI, or null if the vendor cancelled
export const captureScalePhoto = async () => {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Camera permission is needed to photograph the weighing scale.');
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
