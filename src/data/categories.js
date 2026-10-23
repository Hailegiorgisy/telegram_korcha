// src/data/categories.js: Exactly 6 Product Categories with dynamic worker-added products support
export interface ProductItem {
  id: string;
  title: string;
  priceEtb: number;
  image: string;
  productUrl?: string;
  source?: 'Shein' | 'Amazon' | 'AliExpress';
}

export interface CategoryDefinition {
  id: string;
  nameAm: string;
  nameEn: string;
  icon: string;
  image: string;
  color: string;
  products: ProductItem[];
}

export const CATEGORIES: CategoryDefinition[] = [
  {
    id: 'electronics',
    nameAm: 'ኤሌክትሮኒክስ',
    nameEn: 'Electronics',
    icon: '📱',
    image: 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=500&auto=format&fit=crop&q=80',
    color: 'from-blue-500 to-indigo-600',
    products: [], // Empty initially; populated when workers add items
  },
  {
    id: 'womens',
    nameAm: 'የሴቶች ፋሽን',
    nameEn: "Women's Fashion",
    icon: '👗',
    image: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=500&auto=format&fit=crop&q=80',
    color: 'from-pink-500 to-rose-600',
    products: [],
  },
  {
    id: 'mens',
    nameAm: 'የወንዶች ፋሽን',
    nameEn: "Men's Fashion",
    icon: '👔',
    image: 'https://images.unsplash.com/photo-1617137984095-74e4e5e3613f?w=500&auto=format&fit=crop&q=80',
    color: 'from-sky-500 to-blue-700',
    products: [],
  },
  {
    id: 'kids',
    nameAm: 'የህጻናት እቃዎች',
    nameEn: 'Kids & Babies',
    icon: '🧸',
    image: 'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=500&auto=format&fit=crop&q=80',
    color: 'from-yellow-400 to-orange-500',
    products: [],
  },
  {
    id: 'shoes_bags',
    nameAm: 'ጫማና ቦርሳ',
    nameEn: 'Shoes & Bags',
    icon: '👟',
    image: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=500&auto=format&fit=crop&q=80',
    color: 'from-purple-500 to-indigo-700',
    products: [],
  },
  {
    id: 'home',
    nameAm: 'የቤትና ኩሽና እቃዎች',
    nameEn: 'Home & Kitchen',
    icon: '🍳',
    image: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=500&auto=format&fit=crop&q=80',
    color: 'from-amber-600 to-stone-700',
    products: [],
  },
];
