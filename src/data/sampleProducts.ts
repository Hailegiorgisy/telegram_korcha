import { ParsedProduct } from '../types';

export const SAMPLE_PRODUCTS: ParsedProduct[] = [
  // 1. SHEIN (Fashion & Apparel)
  {
    id: 'shein-1',
    marketplace: 'shein',
    url: 'https://www.shein.com/Floral-Print-A-Line-Summer-Maxi-Dress-p-1849201.html',
    title: 'Floral Print A-Line Elegant Summer Maxi Dress',
    titleAmharic: 'የበጋ አበባ ንድፍ የሚያምር የሴቶች ቀሚስ',
    category: 'Fashion & Dresses',
    imageUrl: 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=600&auto=format&fit=crop&q=80',
    originalPriceUsd: 16.50,
    availableSizes: ['S', 'M', 'L', 'XL'],
    availableColors: ['Navy Floral (ሰማያዊ አበባ)', 'Blush Pink (ሮዝ)', 'Olive Green (ወይራ አረንጓዴ)'],
    rating: 4.8,
    reviewsCount: 1420,
  },

  // 2. Amazon (Home & Gadgets)
  {
    id: 'Amazon-1',
    marketplace: 'Amazon',
    url: 'https://www.Amazon.com/Wireless-ANC-Noise-Cancelling-Earbuds-p-g891023.html',
    title: 'Wireless Active Noise Cancelling Earbuds with LED Digital Display',
    titleAmharic: 'የብሉቱዝ ጆሮ ማዳመጫ ከዲጂታል ስክሪን ጋር',
    category: 'Electronics & Audio',
    imageUrl: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&auto=format&fit=crop&q=80',
    originalPriceUsd: 14.99,
    availableSizes: ['One Size (መደበኛ)'],
    availableColors: ['Matte Black (ጥቁር)', 'Pearl White (ነጭ)'],
    rating: 4.8,
    reviewsCount: 2980,
  },

  // 3. ALIEXPRESS (Tech & Accessories)
  {
    id: 'aliexpress-1',
    marketplace: 'aliexpress',
    url: 'https://www.aliexpress.com/item/1005006392019481.html',
    title: 'Mechanical Hot-Swappable RGB Wireless Bluetooth Keyboard',
    titleAmharic: 'ዘመናዊ ሜካኒካል ኪቦርድ ከቀለም መብራት ጋር',
    category: 'Computer & Office',
    imageUrl: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=600&auto=format&fit=crop&q=80',
    originalPriceUsd: 34.20,
    availableSizes: ['75% Compact (84 Keys)', 'Full Size (104 Keys)'],
    availableColors: ['Red Switch (ጸጥ ያለ)', 'Brown Switch (ታክታይል)', 'Blue Switch (ጠቅ ጠቅ)'],
    rating: 4.9,
    reviewsCount: 1840,
  },
];
