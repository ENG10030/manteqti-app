export interface Apartment {
  id: string;
  title: string;
  price: number;
  area: string;
  bedrooms: number;
  bathrooms: number;
  description: string;
  ownerPhone: string;
  mapLink: string;
  imageUrl?: string;
  images?: string[];
  amenities?: string[];
  featured?: boolean;
  type: 'rent' | 'sale';
  available: boolean;
  paymentRef?: string;
  agreementStatus?: 'Agreement Reached' | 'Contract Signed';
  createdAt: string;
}

export interface Inquiry {
  id: string;
  apartmentId: string;
  userId?: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  lifecycleStatus: 'New' | 'Contacted' | 'Converted' | 'Lost';
  paymentId?: string;
  paymentStatus?: 'Paid' | 'Pending' | 'Failed';
  method?: string;
  amount?: number;
  transactionRef?: string;
  paymentLink?: string;
  inquiryStatus?: string;
  createdAt: string;
}

export interface ApartmentDetails extends Apartment {
  inquiries: Inquiry[];
}

export interface Payment {
  id: string;
  inquiryId: string;
  method: string;
  status: 'Paid' | 'Pending' | 'Failed';
  inquiryStatus: string;
  amount: number;
  transactionRef?: string;
  paymentLink?: string;
  createdAt: string;
}

export interface User {
  id: string;
  identifier: string;
  name: string;
}
