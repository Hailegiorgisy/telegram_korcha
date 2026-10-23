import { Marketplace, ParsedProduct } from '../types';
import { SAMPLE_PRODUCTS } from '../data/sampleProducts';

export function detectMarketplace(urlOrText: string): Marketplace {
  const lower = urlOrText.toLowerCase();
  if (lower.includes('Amazon.') || lower.includes('/Amazon') || lower.includes('Amazon')) {
    return 'Amazon';
  }
  if (lower.includes('aliexpress.') || lower.includes('ali') || lower.includes('aliexpress')) {
    return 'aliexpress';
  }
  return 'shein'; // default fallback or matches shein
}

export function parseMarketplaceLink(input: string, customPrice?: number): ParsedProduct {
  const cleanInput = input.trim();
  const marketplace = detectMarketplace(cleanInput);

  // Extract explicit price from input if present (e.g. $19.99, 19.99$, $19.99 USD)
  const explicitPriceMatch = cleanInput.match(/(?:\$|USD\s*)\s*(\d+(?:\.\d{1,2})?)|(\d+(?:\.\d{1,2})?)\s*(?:\$|USD)/i);
  let detectedExplicitPrice = customPrice;
  if (!detectedExplicitPrice && explicitPriceMatch) {
    const parsedVal = parseFloat(explicitPriceMatch[1] || explicitPriceMatch[2]);
    if (!isNaN(parsedVal) && parsedVal > 0) {
      detectedExplicitPrice = parsedVal;
    }
  }

  // Check if it matches an existing sample product
  const matchedSample = SAMPLE_PRODUCTS.find(
    (p) =>
      cleanInput.includes(p.id) ||
      (cleanInput.length > 15 && (cleanInput.includes(p.url) || p.url.includes(cleanInput)))
  );

  if (matchedSample) {
    if (detectedExplicitPrice && detectedExplicitPrice > 0) {
      return { ...matchedSample, originalPriceUsd: detectedExplicitPrice };
    }
    return matchedSample;
  }

  // Generate realistic product parsing based on URL slug or keywords
  let title = 'Imported Chinese Marketplace Item';
  let titleAmharic = 'ከውጭ ሀገር የሚመጣ እቃ';
  let category = 'General Merchandise';
  let fallbackPrice = 18.50;
  let imageUrl = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80';
  let availableSizes = ['S', 'M', 'L', 'XL'];
  let availableColors = ['Standard (እንደ ፎቶው)', 'Black (ጥቁር)', 'White (ነጭ)'];

  try {
    const url = new URL(cleanInput.startsWith('http') ? cleanInput : `https://${cleanInput}`);
    const pathname = url.pathname;
    const segments = pathname.split('/').filter(Boolean);
    const lastSegment = segments[segments.length - 1] || '';

    const cleanTitle = decodeURIComponent(lastSegment)
      .replace(/-p-\d+.*$/i, '')
      .replace(/\.html?$/i, '')
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim();

    if (cleanTitle && cleanTitle.length > 3) {
      title = cleanTitle;
    }
  } catch {
    if (cleanInput.length > 5 && !cleanInput.startsWith('http')) {
      title = cleanInput.replace(/\b\w/g, (c) => c.toUpperCase());
    }
  }

  const lowerTitle = title.toLowerCase();

  if (marketplace === 'shein') {
    if (lowerTitle.includes('dress') || lowerTitle.includes('skirt') || lowerTitle.includes('kemis')) {
      titleAmharic = 'የሴቶች ቀሚስ (Shein Dress)';
      category = 'Women Fashion';
      fallbackPrice = 17.00;
      imageUrl = 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=600&auto=format&fit=crop&q=80';
    } else if (lowerTitle.includes('hoodie') || lowerTitle.includes('jacket') || lowerTitle.includes('shirt')) {
      titleAmharic = 'የወንዶች ሁዲ/ሸሚዝ (Shein Men)';
      category = 'Streetwear';
      fallbackPrice = 21.50;
      imageUrl = 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=600&auto=format&fit=crop&q=80';
    } else if (lowerTitle.includes('bag') || lowerTitle.includes('wallet')) {
      titleAmharic = 'የሴቶች ቦርሳ (Shein Bag)';
      category = 'Bags & Accessories';
      fallbackPrice = 14.00;
      imageUrl = 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600&auto=format&fit=crop&q=80';
    } else {
      titleAmharic = 'የሼይን ፋሽን እቃ';
      category = 'Shein Fashion';
      fallbackPrice = 15.50;
      imageUrl = 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=600&auto=format&fit=crop&q=80';
    }
  } else if (marketplace === 'Amazon') {
    if (lowerTitle.includes('earbuds') || lowerTitle.includes('headphone') || lowerTitle.includes('audio')) {
      titleAmharic = 'የቴሙ የብሉቱዝ ጆሮ ማዳመጫ';
      category = 'Electronics';
      fallbackPrice = 14.50;
      imageUrl = 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&auto=format&fit=crop&q=80';
      availableSizes = ['Standard'];
    } else if (lowerTitle.includes('kitchen') || lowerTitle.includes('chopper') || lowerTitle.includes('cup')) {
      titleAmharic = 'የቴሙ የቤትና ኩሽና እቃ';
      category = 'Kitchen & Home';
      fallbackPrice = 12.00;
      imageUrl = 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=600&auto=format&fit=crop&q=80';
      availableSizes = ['1 Set'];
    } else {
      titleAmharic = 'የቴሙ ምርት';
      category = 'Amazon Gadgets & Home';
      fallbackPrice = 16.00;
      imageUrl = 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=600&auto=format&fit=crop&q=80';
      availableSizes = ['Standard'];
    }
  } else {
    // aliexpress
    if (lowerTitle.includes('watch')) {
      titleAmharic = 'የአሊኤክስፕረስ የእጅ ሰዓት';
      category = 'Watches';
      fallbackPrice = 24.00;
      imageUrl = 'https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=600&auto=format&fit=crop&q=80';
    } else if (lowerTitle.includes('keyboard') || lowerTitle.includes('mouse') || lowerTitle.includes('tech')) {
      titleAmharic = 'የኮምፒውተር መለዋወጫ (Tech)';
      category = 'Electronics';
      fallbackPrice = 32.00;
      imageUrl = 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=600&auto=format&fit=crop&q=80';
    } else {
      titleAmharic = 'የአሊኤክስፕረስ ምርት';
      category = 'AliExpress Gadgets';
      fallbackPrice = 19.50;
      imageUrl = 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=600&auto=format&fit=crop&q=80';
    }
  }

  const finalPrice = detectedExplicitPrice && detectedExplicitPrice > 0 ? detectedExplicitPrice : fallbackPrice;

  return {
    id: `${marketplace}-${Date.now()}`,
    marketplace,
    url: cleanInput.startsWith('http') ? cleanInput : `https://www.${marketplace}.com/item/${encodeURIComponent(cleanInput)}`,
    title,
    titleAmharic,
    category,
    imageUrl,
    originalPriceUsd: finalPrice,
    availableSizes,
    availableColors,
    rating: 4.8,
    reviewsCount: 350,
  };
}
