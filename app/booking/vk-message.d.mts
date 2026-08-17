export const VK_COMMUNITY_ID: string;

export type VkBookingData = {
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

export function buildVkBookingMessage(data: VkBookingData): string;
export function buildVkMessageUrl(message: string): string;
