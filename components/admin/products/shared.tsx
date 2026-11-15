export const LABELS: any = [
  ["trending", "Trending"],
  ["new-arrival", "New Arrival"],
  ["best-seller", "Best Seller"],
  ["limited-edition", "Limited Edition"],
  ["sale", "Sale"],
] as const;

export const OFFERS = [
  ["offer1Pair", "1 Pair"],
  ["offer2Pair", "2 Pair"],
  ["offer3Pair", "3 Pair"],
] as const;

export const DEFAULT_SIZES = [6, 7, 8, 9, 10];

export interface Shoe {
  _id: string;
  orderNumber: number;
  productName: string;
  price: number;
  isDisabled: boolean;
  img?: string | null; // CDN thumb URL, built on the server
  productLabel?: string[];
  sizes?: number[];
  disabledSizes?: number[];
  offer1Pair?: boolean;
  offer2Pair?: boolean;
  offer3Pair?: boolean;
  hasVideo?: boolean; // list only
  videoUrl?: string; // single-doc fetch only
  posterUrl?: string; // single-doc fetch only
}