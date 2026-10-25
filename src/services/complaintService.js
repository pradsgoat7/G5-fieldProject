import { collection, doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { translate } from '../i18n';

// Category text lives in the translation files under complaints.categories.<id>
export const COMPLAINT_CATEGORIES = [
  { id: 'dumping', icon: 'delete-alert' },
  { id: 'banned_plastic', icon: 'shopping-outline' },
  { id: 'burning', icon: 'fire' },
  { id: 'missed_collection', icon: 'truck-remove' },
  { id: 'other', icon: 'alert-circle-outline' }
];

// Open -> InProgress -> Resolved | Rejected, all moves made by the ward's BMC official
export const COMPLAINT_STATUS = {
  OPEN: 'Open',
  IN_PROGRESS: 'InProgress',
  RESOLVED: 'Resolved',
  REJECTED: 'Rejected'
};

export const isComplaintOpen = (c) => c.status === COMPLAINT_STATUS.OPEN || c.status === COMPLAINT_STATUS.IN_PROGRESS;

export const complaintStatusLabel = (status) => translate(`complaints.status.${status}`);
export const complaintCategoryLabel = (id) => translate(`complaints.categories.${id}`);
export const complaintCategoryIcon = (id) => (COMPLAINT_CATEGORIES.find(c => c.id === id) || COMPLAINT_CATEGORIES[4]).icon;

// The photo is stored separately so complaint lists stay light
export const submitComplaint = async ({ user, ward, category, description, photo, location }) => {
  const complaintRef = doc(collection(db, "complaints"));
  const batch = writeBatch(db);
  batch.set(complaintRef, {
    reporterUid: user.uid,
    reporterName: user.name,
    societyCode: user.societyCode || null,
    societyName: user.societyName || null,
    ward,
    category,
    description,
    hasPhoto: true,
    location,
    status: COMPLAINT_STATUS.OPEN,
    createdAt: serverTimestamp()
  });
  batch.set(doc(db, "complaint_photos", complaintRef.id), {
    complaintId: complaintRef.id,
    dataUri: photo,
    uploadedBy: user.uid,
    createdAt: serverTimestamp()
  });
  await batch.commit();
  return complaintRef.id;
};
