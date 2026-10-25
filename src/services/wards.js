import { translate } from '../i18n';

// BMC's 24 administrative wards (A to T). Update here if BMC splits or renames a ward.
export const BMC_WARDS = [
  { id: 'A', areas: 'Colaba, Fort, Churchgate' },
  { id: 'B', areas: 'Dongri, Masjid Bunder, Sandhurst Road' },
  { id: 'C', areas: 'Marine Lines, Kalbadevi, Bhuleshwar' },
  { id: 'D', areas: 'Grant Road, Malabar Hill, Tardeo' },
  { id: 'E', areas: 'Byculla, Mazgaon, Nagpada' },
  { id: 'F/N', areas: 'Matunga, Sion, Wadala' },
  { id: 'F/S', areas: 'Parel, Sewri, Naigaon' },
  { id: 'G/N', areas: 'Dadar, Mahim, Dharavi' },
  { id: 'G/S', areas: 'Worli, Prabhadevi, Lower Parel' },
  { id: 'H/E', areas: 'Bandra East, Khar East, Santacruz East' },
  { id: 'H/W', areas: 'Bandra West, Khar West, Santacruz West' },
  { id: 'K/E', areas: 'Andheri East, Vile Parle East, Jogeshwari East' },
  { id: 'K/W', areas: 'Andheri West, Juhu, Vile Parle West' },
  { id: 'L', areas: 'Kurla, Sakinaka, Chandivali' },
  { id: 'M/E', areas: 'Govandi, Mankhurd, Deonar, Trombay' },
  { id: 'M/W', areas: 'Chembur, Tilak Nagar' },
  { id: 'N', areas: 'Ghatkopar, Vikhroli' },
  { id: 'P/N', areas: 'Malad, Marve' },
  { id: 'P/S', areas: 'Goregaon' },
  { id: 'R/C', areas: 'Borivali' },
  { id: 'R/N', areas: 'Dahisar' },
  { id: 'R/S', areas: 'Kandivali' },
  { id: 'S', areas: 'Bhandup, Powai, Kanjurmarg' },
  { id: 'T', areas: 'Mulund' }
];

export const getWardLabel = (id) => (id ? translate('ward.label', { id }) : translate('ward.notSet'));
