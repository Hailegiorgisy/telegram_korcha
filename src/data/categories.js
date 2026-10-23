// src/data/categories.js: The 6 Shelf Categories & Product Definitions
export interface ProductItem {
  id: string;
  categoryId: 'womens' | 'kids' | 'beauty' | 'electronics' | 'home' | 'miscellaneous';
  name: string;
  size?: string;
  priceEtb: number;
  photoUrl: string;
  isBestseller?: boolean;
}

export interface CategoryDefinition {
  id: 'womens' | 'kids' | 'beauty' | 'electronics' | 'home' | 'miscellaneous';
  nameAm: string;
  nameEn: string;
  icon: string;
  color: string;
}

export const SHELF_CATEGORIES: CategoryDefinition[] = [
  {
    id: 'womens',
    nameAm: 'የሴቶች አልባሳት',
    nameEn: "Women's Clothing",
    icon: '👗',
    color: 'from-pink-500 to-rose-600',
  },
  {
    id: 'kids',
    nameAm: 'የህጻናት',
    nameEn: 'Kids & Babies',
    icon: '🧸',
    color: 'from-amber-400 to-orange-500',
  },
  {
    id: 'beauty',
    nameAm: 'የመዋቢያ ዕቃዎች',
    nameEn: 'Beauty & Skin Care',
    icon: '💄',
    color: 'from-fuchsia-500 to-purple-600',
  },
  {
    id: 'electronics',
    nameAm: 'ኤሌክትሮኒክስ',
    nameEn: 'Electronics',
    icon: '📱',
    color: 'from-blue-500 to-indigo-600',
  },
  {
    id: 'home',
    nameAm: 'የቤት ውስጥ መገልገያዎች',
    nameEn: 'Home & Kitchen',
    icon: '🍳',
    color: 'from-stone-600 to-stone-800',
  },
  {
    id: 'miscellaneous',
    nameAm: 'Miscellaneous (ሌሎች)',
    nameEn: 'Miscellaneous (Other)',
    icon: '✨',
    color: 'from-emerald-500 to-teal-700',
  },
];

// Curated Initial Best Sellers showcase ("በብዛት የተሸጡ") at the top of the shelf
export const INITIAL_BESTSELLERS: ProductItem[] = [
  {
    id: 'bs-1',
    categoryId: 'womens',
    name: 'Shein Floral Summer Maxi Dress',
    size: 'S, M, L, XL',
    priceEtb: 2850,
    photoUrl: 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=500&auto=format&fit=crop&q=80',
    isBestseller: true,
  },
  {
    id: 'bs-2',
    categoryId: 'electronics',
    name: 'Wireless Bluetooth Earbuds Pro (Active Noise Cancelling)',
    size: 'One Size',
    priceEtb: 3400,
    photoUrl: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=500&auto=format&fit=crop&q=80',
    isBestseller: true,
  },
  {
    id: 'bs-3',
    categoryId: 'beauty',
    name: 'Hydrating Face Serum & Vitamin C Glow Complex',
    size: '50ml',
    priceEtb: 1950,
    photoUrl: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=500&auto=format&fit=crop&q=80',
    isBestseller: true,
  },
  {
    id: 'bs-4',
    categoryId: 'home',
    name: 'Electric Portable Coffee & Spice Grinder',
    size: '300ml',
    priceEtb: 2200,
    photoUrl: 'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=500&auto=format&fit=crop&q=80',
    isBestseller: true,
  },
];

export const CATEGORIES = SHELF_CATEGORIES;
