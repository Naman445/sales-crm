export type LeadType = 'Hot' | 'Warm' | 'Cold' | 'Dead' | 'Closed';
export type ResponseType =
  | 'Interested'
  | 'Follow Up'
  | 'Deal Closed'
  | 'Not Interested'
  | 'Dead Lead'
  | 'Callback'
  | 'No Response';

export type UserRole = 'Manager' | 'Sales' | 'BD';

// Responses that require a next meeting date
export const RESPONSES_NEEDING_DATE: ResponseType[] = ['Interested', 'Follow Up', 'Callback'];

// Responses that are terminal (no follow-up meeting)
export const RESPONSES_NO_DATE: ResponseType[] = ['Deal Closed', 'Not Interested', 'Dead Lead', 'No Response'];

export interface Product {
  id: string;
  name: string;
  price: number; // unit price in ₹
  category: string;
}

export interface AppUser {
  id: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  createdAt: string;
}

export interface MeetingProof {
  photoBase64: string;       // base64 data URL (local, before upload)
  photoUrl?: string;         // Supabase Storage signed URL (after upload)
  latitude: number;
  longitude: number;
  locationAddress: string;   // reverse geocoded address
  capturedAt: string;        // ISO timestamp
}

export const INDUSTRIES = [
  'Information Technology (IT)',
  'Software Development',
  'E-commerce',
  'Healthcare & Pharma',
  'Banking & Finance',
  'Insurance',
  'Real Estate',
  'Construction',
  'Education & EdTech',
  'Automobile',
  'Manufacturing',
  'FMCG',
  'Retail',
  'Logistics & Supply Chain',
  'Telecom',
  'Media & Entertainment',
  'Hospitality & Hotels',
  'Travel & Tourism',
  'Agriculture',
  'Food & Beverage',
  'Textile & Garments',
  'Chemical & Petrochemical',
  'Steel & Metals',
  'Energy & Power',
  'Oil & Gas',
  'Mining',
  'Aerospace & Defense',
  'Electronics',
  'Consumer Durables',
  'Jewellery & Gems',
  'Packaging',
  'Printing & Publishing',
  'Legal Services',
  'Consulting',
  'Advertising & Marketing',
  'Event Management',
  'Interior Design',
  'Architecture',
  'Sports & Fitness',
  'Beauty & Wellness',
  'NGO & Social',
  'Government & PSU',
  'Import & Export',
  'Shipping & Maritime',
  'Aviation',
  'Waste Management',
  'Renewable Energy',
  'FinTech',
  'Security Services',
  'Other',
] as const;

export type Industry = typeof INDUSTRIES[number];

export interface Meeting {
  id: string;
  // Salesperson info
  salesPersonId: string;
  salesPersonName: string;
  salesPersonRole: UserRole;
  // Client info
  name: string;
  jobTitle: string;
  companyName: string;
  industry: string;
  phone: string;
  email: string;
  response: ResponseType;
  leadType: LeadType;
  city: string;
  address: string;
  meetingDuration: string;
  nextMeetingDate: string;
  // Proof of visit
  proof?: MeetingProof;
  // Deal fields (only when response = 'Deal Closed')
  dealQty?: number;
  dealAmount?: number;
  productSold?: string;
  revenueDate?: string;
  createdAt: string;
}

export type Page = 'entry' | 'dashboard' | 'table' | 'inventory';
