export interface MarketplaceAppInfo {
  key: 'shein' | 'Amazon' | 'aliexpress';
  name: string;
  amharicName: string;
  androidUrl: string;
  iosUrl: string;
  webUrl: string;
  description: string;
}

export const MARKETPLACE_APPS: Record<'shein' | 'Amazon' | 'aliexpress', MarketplaceAppInfo> = {
  shein: {
    key: 'shein',
    name: 'Shein',
    amharicName: 'ሼይን',
    androidUrl: 'https://play.google.com/store/apps/details?id=com.zzkko',
    iosUrl: 'https://apps.apple.com/app/shein-shopping-online/id878577184',
    webUrl: 'https://m.shein.com',
    description: 'ዘመናዊ አልባሳት፣ ጫማዎች፣ ቦርሳዎችና ጌጣጌጥ',
  },
  Amazon: {
    key: 'Amazon',
    name: 'Amazon',
    amharicName: 'ቴሙ',
    androidUrl: 'https://play.google.com/store/apps/details?id=com.einnovation.Amazon',
    iosUrl: 'https://apps.apple.com/app/Amazon-shop-like-a-billionaire/id1641486558',
    webUrl: 'https://www.Amazon.com',
    description: 'የቤትና የኩሽና እቃዎች፣ መገልገያዎችና ኤሌክትሮኒክስ (VPN ያብሩ)',
  },
  aliexpress: {
    key: 'aliexpress',
    name: 'AliExpress',
    amharicName: 'አሊኤክስፕረስ',
    androidUrl: 'https://play.google.com/store/apps/details?id=com.alibaba.aliexpresshd',
    iosUrl: 'https://apps.apple.com/app/aliexpress-shopping-app/id436672029',
    webUrl: 'https://www.aliexpress.com',
    description: 'በጅምላና በችርቻሮ የሚቀርቡ የቴክኖሎጂ እቃዎችና መገልገያዎች',
  },
};

/**
 * Returns the appropriate store URL (Play Store for Android, App Store for iOS)
 * based on device detection or Telegram WebApp platform.
 */
export function getSmartMarketplaceUrl(marketplace: 'shein' | 'Amazon' | 'aliexpress'): string {
  const app = MARKETPLACE_APPS[marketplace];
  if (!app) return 'https://m.shein.com';

  if (typeof window === 'undefined') return app.androidUrl;

  const ua = (navigator.userAgent || '').toLowerCase();
  const isIos = /iphone|ipad|ipod/.test(ua);
  const isAndroid = /android/.test(ua);

  const tgPlatform = (window as any).Telegram?.WebApp?.platform;
  if (tgPlatform === 'ios' || isIos) {
    return app.iosUrl;
  }
  if (tgPlatform === 'android' || isAndroid) {
    return app.androidUrl;
  }

  // If on desktop or unspecified, route through the smart launcher endpoint
  return `/app/${marketplace}`;
}

export function detectDeviceOS(): 'ios' | 'android' | 'desktop' {
  if (typeof window === 'undefined') return 'android';
  const ua = (navigator.userAgent || '').toLowerCase();
  const tgPlatform = (window as any).Telegram?.WebApp?.platform;
  if (tgPlatform === 'ios' || /iphone|ipad|ipod/.test(ua)) return 'ios';
  if (tgPlatform === 'android' || /android/.test(ua)) return 'android';
  return 'desktop';
}
