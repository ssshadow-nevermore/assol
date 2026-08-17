export type BookingData = {
  category: string;
  service: string;
  price: string;
  master: string;
  date: string;
  time: string;
  name: string;
  phone: string;
  comment?: string;
};

export function buildBookingMessage(data: BookingData): string;
