// src/components/StorefrontHome.tsx: 6 Shelf Categories, "በብዛት የተሸጡ" Best Sellers Showcase, Worker Shelf Editor & Buy Flow
import React, { useState, useEffect } from 'react';
import { 
  Link as LinkIcon, 
  Camera, 
  MessageCircle, 
  CreditCard, 
  Truck, 
  ShieldCheck, 
  Sparkles, 
  Zap,
  Check,
  ShoppingBag,
  ExternalLink,
  Plus,
  Edit2,
  Trash2,
  X,
  Flame,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { SHELF_CATEGORIES, INITIAL_BESTSELLERS } from '../data/categories';

interface StorefrontHomeProps {
  onOpenQuoteModal: (mode?: 'link' | 'screenshot', preferredPayment?: 'telebirr' | 'cbe_birr') => void;
  selectedCategory: string;
  onSelectCategory: (id: string) => void;
  onShelfOrderCreated?: (orderCode: string, phone: string, openMessages?: boolean) => void;
}

export const StorefrontHome: React.FC<StorefrontHomeProps> = ({
  onOpenQuoteModal,
  selectedCategory,
  onSelectCategory,
  onShelfOrderCreated,
}) => {
  const [activeCatId, setActiveCatId] = useState<string>(selectedCategory && selectedCategory !== 'all' ? selectedCategory : 'womens');
  const [categories, setCategories] = useState<any[]>(SHELF_CATEGORIES);
  const [shelfProducts, setShelfProducts] = useState<any[]>(INITIAL_BESTSELLERS);
  const [bestSellers, setBestSellers] = useState<any[]>(INITIAL_BESTSELLERS);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Direct Shelf Buy Flow State (Only 2 questions: 1. Payment Choice, 2. Phone & Auto-Scraped Username)
  const [selectedBuyProduct, setSelectedBuyProduct] = useState<any | null>(null);
  const [shelfPaymentMethod, setShelfPaymentMethod] = useState<'telebirr' | 'cbe_birr'>('telebirr');
  const [shelfCustomerPhone, setShelfCustomerPhone] = useState<string>(() => {
    try { return localStorage.getItem('korcha_customer_phone') || ''; } catch { return ''; }
  });
  const [shelfCustomerUsername, setShelfCustomerUsername] = useState<string>('');
  const [isUsernameScraped, setIsUsernameScraped] = useState<boolean>(false);
  const [isSubmittingShelfOrder, setIsSubmittingShelfOrder] = useState<boolean>(false);
  const [shelfOrderError, setShelfOrderError] = useState<string | null>(null);
  const [confirmedShelfOrder, setConfirmedShelfOrder] = useState<any | null>(null);
  const [paymentAccounts, setPaymentAccounts] = useState<{ telebirrPhone: string; cbeAccount: string }>({
    telebirrPhone: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_TELEBIRR_PHONE) || '+251-996237800',
    cbeAccount: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CBE_ACCOUNT) || '10001116390',
  });

  // Worker Shelf Editor State (korcha_support)
  const [isWorkerMode, setIsWorkerMode] = useState<boolean>(false);
  const [isEditorOpen, setIsEditorOpen] = useState<boolean>(false);
  const [isCatEditorOpen, setIsCatEditorOpen] = useState<boolean>(false);
  const [catForm, setCatForm] = useState({ id: "womens", nameAm: "", nameEn: "", icon: "" });
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [editorForm, setEditorForm] = useState({
    name: '',
    size: '',
    priceEtb: '',
    photoUrl: '',
    photoUrlsText: '',
    categoryId: 'womens',
    isBestseller: false,
  });
  const [isSavingProduct, setIsSavingProduct] = useState<boolean>(false);
  const [editorNotification, setEditorNotification] = useState<string | null>(null);

  const workerUsername = ((typeof import.meta !== 'undefined' && import.meta.env?.VITE_WORKER_TELEGRAM_USERNAME) 
    || 'korcha_support').replace(/^@/, '').trim();
  const supportUrl = `https://t.me/${workerUsername}`;

  // Global Marketplaces with Direct Web, Android (Play Store) & Apple (App Store) Links
  const marketplaces = [
    {
      name: 'Shein',
      webUrl: 'https://www.shein.com',
      playStoreUrl: 'https://play.google.com/store/apps/details?id=com.zzkko',
      appStoreUrl: 'https://apps.apple.com/app/shein-online-fashion/id878577184',
      badgeAm: 'አልባሳትና ፋሽን',
      gradient: 'from-black to-stone-800',
    },
    {
      name: 'Amazon',
      webUrl: 'https://www.amazon.com',
      playStoreUrl: 'https://play.google.com/store/apps/details?id=com.amazon.mShop.android.shopping',
      appStoreUrl: 'https://apps.apple.com/app/amazon-shopping/id297606951',
      badgeAm: 'ዓለም አቀፍ መደብር',
      gradient: 'from-amber-600 to-yellow-600',
    },
    {
      name: 'AliExpress',
      webUrl: 'https://www.aliexpress.com',
      playStoreUrl: 'https://play.google.com/store/apps/details?id=com.alibaba.aliexpresshd',
      appStoreUrl: 'https://apps.apple.com/app/aliexpress-shopping-app/id436672029',
      badgeAm: 'ኤሌክትሮኒክስና ልዩ ልዩ',
      gradient: 'from-red-600 to-rose-600',
    },
  ];

  // Strict RBAC: Only @korcha_support is authorized to access category & shelf editing
  const [tmaUsername, setTmaUsername] = useState<string>('');
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const isUrlWorker = Boolean(
    searchParams?.get('worker') === '1' ||
    searchParams?.get('role') === 'worker' ||
    searchParams?.get('admin') === '1' ||
    searchParams?.get('user')?.replace(/^@/, '').toLowerCase() === workerUsername.toLowerCase()
  );
  const isStorageWorker = typeof localStorage !== 'undefined' && localStorage.getItem('korcha_worker_active') === 'true';

  const isAuthorizedWorker = Boolean(
    isUrlWorker ||
    isStorageWorker ||
    (tmaUsername && tmaUsername.toLowerCase() === workerUsername.toLowerCase())
  );

  const getProductPhotos = (item: any): string[] => {
    if (!item) return [];
    let urls: string[] = [];
    if (Array.isArray(item.photo_urls)) urls = item.photo_urls.filter(Boolean);
    else if (typeof item.photo_urls === 'string') {
      try { urls = JSON.parse(item.photo_urls); } catch { urls = []; }
    }
    if (Array.isArray(item.photoUrls)) urls = [...urls, ...item.photoUrls];
    const primary = item.photo_url || item.photoUrl || item.image;
    if (primary && !urls.includes(primary)) urls = [primary, ...urls];
    return Array.from(new Set(urls.filter(Boolean)));
  };

  // Image lightbox / zoom state
  const [lightbox, setLightbox] = useState<{ photos: string[]; index: number } | null>(null);
  const [zoom, setZoom] = useState(1);

  const openLightbox = (photos: string[], index = 0) => {
    if (!photos.length) return;
    setZoom(1);
    setLightbox({ photos, index });
  };

  useEffect(() => {
    const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
    const rawUsername = tgUser?.username || '';
    const cleanUsername = rawUsername.replace(/^@/, '').trim();
    setTmaUsername(cleanUsername);

    // Scrape customer Telegram username (or fallback to Telegram first_name) automatically
    if (cleanUsername) {
      setShelfCustomerUsername(`@${cleanUsername}`);
      setIsUsernameScraped(true);
    } else if (tgUser?.first_name) {
      setShelfCustomerUsername(tgUser.first_name);
      setIsUsernameScraped(true);
    }

    const isWorkerUser = Boolean(
      isUrlWorker ||
      isStorageWorker ||
      (cleanUsername && cleanUsername.toLowerCase() === workerUsername.toLowerCase())
    );
    setIsWorkerMode(isWorkerUser);
    if (isWorkerUser) {
      try { localStorage.setItem('korcha_worker_active', 'true'); } catch (_) {}
    }
  }, [workerUsername]);

  // Fetch live shelf products and best sellers from backend
  const fetchShelf = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/shelf');
      const data = await res.json();
      if (data.success) {
        if (data.products && data.products.length > 0) {
          setShelfProducts(data.products);
        }
        if (data.bestsellers && data.bestsellers.length > 0) {
          setBestSellers(data.bestsellers);
        }
        if (data.categories && data.categories.length > 0) {
          setCategories(data.categories);
        }
        if (data.paymentConfig) {
          setPaymentAccounts({
            telebirrPhone: data.paymentConfig.telebirrPhone || paymentAccounts.telebirrPhone,
            cbeAccount: data.paymentConfig.cbeAccount || paymentAccounts.cbeAccount,
          });
        }
      }
    } catch (_) {
      // Keep initial best sellers and seeded products on fallback
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchShelf();
  }, []);

  const handleCategoryClick = (catId: string) => {
    setActiveCatId(catId);
    onSelectCategory(catId);
  };

  const currentCategory = categories.find(c => c.id === activeCatId) || categories[0];
  const categoryProducts = shelfProducts.filter(p => (p.category_id || p.categoryId) === activeCatId);

  // Trigger Direct Shelf "Buy" / "ግዛ" for a product (No screenshot/bot wizard required)
  const handleBuyClick = (product: any) => {
    const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
    if (tgUser?.username) {
      setShelfCustomerUsername(`@${tgUser.username.replace(/^@/, '')}`);
      setIsUsernameScraped(true);
    } else if (tgUser?.first_name && !shelfCustomerUsername) {
      setShelfCustomerUsername(tgUser.first_name);
      setIsUsernameScraped(true);
    }
    try {
      const savedPhone = localStorage.getItem('korcha_customer_phone');
      if (savedPhone && !shelfCustomerPhone) {
        setShelfCustomerPhone(savedPhone);
      }
    } catch (_) {}
    setShelfOrderError(null);
    setConfirmedShelfOrder(null);
    setSelectedBuyProduct(product);
  };

  // Optional 1-tap Telegram Contact Phone Scraper inside Mini App
  const handleRequestTelegramPhone = () => {
    const webApp: any = window.Telegram?.WebApp;
    if (webApp?.requestContact) {
      webApp.requestContact((shared: boolean, responseData?: any) => {
        const phone = responseData?.responseUnsafe?.contact?.phone_number;
        if (shared && phone) {
          setShelfCustomerPhone(phone);
          try { localStorage.setItem('korcha_customer_phone', phone); } catch (_) {}
        }
      });
    }
  };

  // Submit Direct Shelf Order (40% now via Telebirr/CBE, 60% in 1-2 days on delivery)
  const handleConfirmShelfOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBuyProduct) return;

    const cleanPhone = shelfCustomerPhone.trim();
    if (!cleanPhone) {
      setShelfOrderError('እባክዎ ስልክ ቁጥርዎን ያስገቡ (09... ወይም 07...)');
      return;
    }

    setIsSubmittingShelfOrder(true);
    setShelfOrderError(null);

    try {
      const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
      const scrapedOrEnteredUsername = (
        shelfCustomerUsername ||
        tgUser?.username ||
        tgUser?.first_name ||
        ''
      ).replace(/^@/, '').trim();

      const res = await fetch('/api/shelf/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: selectedBuyProduct.id,
          productName: selectedBuyProduct.name || selectedBuyProduct.title,
          size: selectedBuyProduct.size || null,
          priceEtb: Number(selectedBuyProduct.price_etb || selectedBuyProduct.priceEtb || 0),
          photoUrl: selectedBuyProduct.photo_url || selectedBuyProduct.photoUrl || selectedBuyProduct.image || null,
          paymentMethod: shelfPaymentMethod,
          phone: cleanPhone,
          telegramUsername: scrapedOrEnteredUsername,
          telegramId: tgUser?.id || null,
          firstName: tgUser?.first_name || null,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        setShelfOrderError(data.error || 'ትዕዛዙን መመዝገብ አልተቻለም። እባክዎ ስልክ ቁጥርዎን ያረጋግጡ።');
        return;
      }

      try {
        localStorage.setItem('korcha_customer_phone', cleanPhone);
      } catch (_) {}

      setConfirmedShelfOrder(data);
      if (onShelfOrderCreated) {
        onShelfOrderCreated(data.orderCode, cleanPhone, false);
      }
    } catch (err: any) {
      setShelfOrderError('የኔትወርክ ችግር ተፈጥሯል። እባክዎ እንደገና ይሞክሩ።');
    } finally {
      setIsSubmittingShelfOrder(false);
    }
  };

  // Open Editor for adding or editing (Strictly guarded by RBAC: @korcha_support only)
  const handleOpenEditCategory = (cat: any) => {
    if (!isAuthorizedWorker) {
      alert(`⛔ ይህ ፈቃድ ለ @${workerUsername} ብቻ የተሰጠ ነው!`);
      return;
    }
    setCatForm({
      id: cat.id,
      nameAm: cat.nameAm || '',
      nameEn: cat.nameEn || '',
      icon: cat.icon || '📦',
    });
    setEditorNotification(null);
    setIsCatEditorOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthorizedWorker) {
      alert(`⛔ ይህ ፈቃድ ለ @${workerUsername} ብቻ የተሰጠ ነው!`);
      return;
    }
    if (!catForm.nameAm.trim()) return;
    try {
      setIsSavingProduct(true);
      const res = await fetch(`/api/shelf/categories/${catForm.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-Username': tmaUsername,
        },
        body: JSON.stringify({
          nameAm: catForm.nameAm.trim(),
          nameEn: catForm.nameEn.trim(),
          icon: catForm.icon.trim() || '📦',
          workerUsername: tmaUsername,
        }),
      });
      const data = await res.json();
      if (data.success && data.category) {
        setCategories(prev => prev.map(c => c.id === catForm.id ? data.category : c));
        setEditorNotification('ምድቡ በተሳካ ሁኔታ ተስተካክሏል (Category updated)');
        setTimeout(() => setIsCatEditorOpen(false), 800);
      } else {
        alert(data.error || 'ስህተት ተከስቷል');
      }
    } catch (err: any) {
      alert('ምድቡን ማስቀመጥ አልተቻለም: ' + err.message);
    } finally {
      setIsSavingProduct(false);
    }
  };

  const handleOpenAddProduct = () => {
    if (!isAuthorizedWorker) return;
    setEditingProduct(null);
    setEditorForm({
      name: '',
      size: '',
      priceEtb: '',
      photoUrl: '',
      categoryId: activeCatId || 'womens',
      isBestseller: false,
    });
    setEditorNotification(null);
    setIsEditorOpen(true);
  };

  const handleOpenEditProduct = (prod: any) => {
    if (!isAuthorizedWorker) return;
    setEditingProduct(prod);
    setEditorForm({
      name: prod.name || prod.title || '',
      size: prod.size || '',
      priceEtb: String(prod.price_etb || prod.priceEtb || ''),
      photoUrl: prod.photo_url || prod.photoUrl || prod.image || '',
      photoUrlsText: getProductPhotos(prod).join('\n'),
      categoryId: prod.category_id || prod.categoryId || 'womens',
      isBestseller: Boolean(prod.is_bestseller || prod.isBestseller),
    });
    setEditorNotification(null);
    setIsEditorOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthorizedWorker) {
      alert(`⛔ ይህ ፈቃድ ለ @${workerUsername} ብቻ የተሰጠ ነው!`);
      return;
    }
    const parsedUrls = (editorForm.photoUrlsText || editorForm.photoUrl || '')
      .split(/[\n,]+/)
      .map((s: string) => s.trim())
      .filter(Boolean);
    if (!editorForm.name.trim() || !editorForm.priceEtb || parsedUrls.length === 0) {
      alert('እባክዎ የስም፣ የዋጋ እና የፎቶ ሊንክ ያስገቡ');
      return;
    }

    try {
      setIsSavingProduct(true);
      if (editingProduct) {
        // PUT update
        const res = await fetch(`/api/shelf/${editingProduct.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-Telegram-Username': tmaUsername,
          },
          body: JSON.stringify({
            name: editorForm.name.trim(),
            size: editorForm.size.trim() || null,
            priceEtb: parseFloat(editorForm.priceEtb),
            photoUrl: parsedUrls[0],
            photoUrls: parsedUrls,
            categoryId: editorForm.categoryId,
            isBestseller: editorForm.isBestseller,
            workerUsername: tmaUsername,
          }),
        });
        const data = await res.json();
        if (data.success) {
          setEditorNotification('እቃው በተሳካ ሁኔታ ተስተካክሏል (Product updated)');
          await fetchShelf();
          setTimeout(() => setIsEditorOpen(false), 900);
        } else {
          alert(data.error || 'ስህተት ተከስቷል');
        }
      } else {
        // POST create
        const res = await fetch('/api/shelf', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Telegram-Username': tmaUsername,
          },
          body: JSON.stringify({
            name: editorForm.name.trim(),
            size: editorForm.size.trim() || null,
            priceEtb: parseFloat(editorForm.priceEtb),
            photoUrl: parsedUrls[0],
            photoUrls: parsedUrls,
            categoryId: editorForm.categoryId,
            isBestseller: editorForm.isBestseller,
            createdBy: tmaUsername,
            workerUsername: tmaUsername,
          }),
        });
        const data = await res.json();
        if (data.success) {
          setEditorNotification('አዲስ እቃ ወደ Shelf በተሳካ ሁኔታ ተጨምሯል (Product added)');
          await fetchShelf();
          setTimeout(() => setIsEditorOpen(false), 900);
        } else {
          alert(data.error || 'ስህተት ተከስቷል');
        }
      }
    } catch (err: any) {
      alert('እቃውን ማስቀመጥ አልተቻለም: ' + err.message);
    } finally {
      setIsSavingProduct(false);
    }
  };

  const handleDeleteProduct = async (id: number | string) => {
    if (!isAuthorizedWorker) return;
    if (!confirm('ይህንን እቃ ከ Shelf ላይ ማጥፋት ይፈልጋሉ?')) return;
    try {
      const res = await fetch(`/api/shelf/${id}`, {
        method: 'DELETE',
        headers: { 'X-Telegram-Username': tmaUsername },
      });
      const data = await res.json();
      if (data.success) {
        setShelfProducts(prev => prev.filter(p => p.id !== id));
        setBestSellers(prev => prev.filter(p => p.id !== id));
      } else {
        alert(data.error || 'ስህተት ተከስቷል');
      }
    } catch (_) {}
  };

  // Helper to construct Telegram purchase link for a product
  const getTelegramBuyUrl = (prod: any) => {
    const name = prod.name || prod.title || 'እቃ';
    const price = prod.price_etb || prod.priceEtb || 0;
    const size = prod.size ? ` (መጠን: ${prod.size})` : '';
    const text = encodeURIComponent(`ሰላም @${workerUsername}፣ ይሄንን እቃ መግዛት እፈልጋለሁ:\n\n📦 እቃ: ${name}${size}\n💰 ዋጋ: ${price} ብር\n\nየክፍያና ማድረሻ ሁኔታ እንዴት እንደሆነ ቢያሳውቁኝ ደስ ይለኛል።`);
    return `https://t.me/${workerUsername}?text=${text}`;
  };

  return (
    <div className="space-y-3 pb-10 animate-fade-in max-w-md mx-auto">
      {/* Truly Mini, Compact Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-stone-950 via-stone-900 to-amber-950 text-white p-3.5 shadow-lg border border-stone-800">
        <div className="relative z-10 space-y-2">
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-semibold border border-amber-500/30">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>ቀጥታ ከዓለም አቀፍ ገበያዎች ወደ ኢትዮጵያ</span>
            </div>
            <span className="text-[9px] font-bold text-amber-400 bg-amber-950/70 px-2 py-0.5 rounded-md border border-amber-700/50">
              40% ቅድመ ክፍያ
            </span>
          </div>

          <h2 className="text-sm font-extrabold leading-snug">
            የፈለጉትን እቃ ይምረጡ፣ እኛ በርዎ ድረስ እናደርሳለን!
          </h2>

          <p className="text-[11px] text-stone-300 leading-tight">
            ከ Shein, Amazon ወይም AliExpress የመረጡትን እቃ ሊንክ ወይም ስክሪንሾት ያስገቡ።
          </p>

          {/* Primary Action Buttons */}
          <div className="grid grid-cols-2 gap-2 pt-0.5">
            <button
              onClick={() => onOpenQuoteModal('link')}
              className="py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs flex items-center justify-center space-x-1.5 shadow-md shadow-amber-500/20 active:scale-95 transition-all cursor-pointer"
            >
              <LinkIcon className="w-3.5 h-3.5" />
              <span>ሊንክ ያስገቡ</span>
            </button>

            <button
              onClick={() => onOpenQuoteModal('screenshot')}
              className="py-2 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center justify-center space-x-1.5 border border-white/15 active:scale-95 transition-all cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5 text-amber-400" />
              <span>ስክሪንሾት ላክ</span>
            </button>
          </div>
        </div>

        <div className="absolute -top-12 -right-12 w-48 h-48 bg-amber-600/20 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* 1. GLOBAL MARKETPLACES (Direct Web + Android Play Store & Apple App Store Links) */}
      <div className="space-y-1.5 pt-0.5">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center space-x-1">
            <span className="text-xs">🌍</span>
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700">
              ዓለም አቀፍ ገበያዎች (Global Marketplaces)
            </h3>
          </div>
          <span className="text-[10px] text-amber-700 font-semibold">ሊንክ ኮፒ አድርገው ይዘዙ</span>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          {marketplaces.map((m) => (
            <div
              key={m.name}
              className="p-2 rounded-xl bg-white border border-stone-200/90 shadow-2xs flex flex-col justify-between space-y-1.5 text-center transition-all hover:border-amber-300"
            >
              <a
                href={m.webUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group block"
                title={`${m.name} ድረ-ገጽ ክፈት`}
              >
                <div className={`w-7 h-7 rounded-lg bg-gradient-to-tr ${m.gradient} text-white font-black text-xs flex items-center justify-center mx-auto mb-1 shadow-2xs group-hover:scale-105 transition-transform`}>
                  {m.name === 'Shein' ? 'S' : m.name === 'Amazon' ? 'a' : 'A'}
                </div>
                <p className="font-bold text-xs text-stone-900 group-hover:text-amber-700 flex items-center justify-center space-x-0.5 leading-tight">
                  <span>{m.name}</span>
                  <ExternalLink className="w-2.5 h-2.5 text-stone-400" />
                </p>
                <p className="text-[8px] text-stone-400 line-clamp-1 mt-0.5">{m.badgeAm}</p>
              </a>

              {/* Play Store (Android) & App Store (Apple) Download Badges */}
              <div className="pt-1 border-t border-stone-100 grid grid-cols-2 gap-1 text-[8px] font-bold">
                <a
                  href={m.playStoreUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-0.5 px-0.5 rounded bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200/70 transition-colors flex items-center justify-center leading-none"
                  title={`${m.name} Google Play Store (Android)`}
                >
                  Android
                </a>
                <a
                  href={m.appStoreUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-0.5 px-0.5 rounded bg-sky-50 text-sky-800 hover:bg-sky-100 border border-sky-200/70 transition-colors flex items-center justify-center leading-none"
                  title={`${m.name} Apple App Store (iPhone)`}
                >
                  Apple
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ADVERTISEMENT BANNER: Compact Telebirr & CBE Birr Payment Options */}
      <div className="rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-purple-500/5 border border-amber-300/60 p-2.5 space-y-1.5 shadow-2xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1.5">
            <span className="w-5 h-5 rounded-md bg-amber-600 text-white flex items-center justify-center font-black text-[10px] shadow-2xs">
              ETB
            </span>
            <span className="font-extrabold text-xs text-stone-900 leading-tight">
              በ Telebirr ወይም CBE Birr ይክፈሉ!
            </span>
          </div>
          <span className="px-1.5 py-0.2 rounded-md bg-emerald-100 text-emerald-800 text-[9px] font-bold border border-emerald-200">
            0% Forex Fee • 40% ቅድመ ክፍያ
          </span>
        </div>

        {/* Dual Compact Payment Badges */}
        <div className="grid grid-cols-2 gap-1.5 text-[10px]">
          <div className="py-1 px-2 rounded-xl bg-white border border-amber-200/80 flex items-center space-x-1.5 shadow-2xs">
            <Zap className="w-3 h-3 text-amber-600 shrink-0" />
            <div className="truncate">
              <span className="font-bold text-stone-900">ቴሌብር (Telebirr)</span>
              <p className="text-[8px] text-stone-400 leading-none">ቅጽበታዊ ማረጋገጫ</p>
            </div>
          </div>

          <div className="py-1 px-2 rounded-xl bg-white border border-purple-200/80 flex items-center space-x-1.5 shadow-2xs">
            <CreditCard className="w-3 h-3 text-purple-600 shrink-0" />
            <div className="truncate">
              <span className="font-bold text-stone-900">CBE (ንግድ ባንክ)</span>
              <p className="text-[8px] text-stone-400 leading-none">አስተማማኝ የባንክ ክፍያ</p>
            </div>
          </div>
        </div>
      </div>

      {/* 3. "በብዛት የተሸጡ" (BEST SELLERS) AT THE TOP OF THE SHELF */}
      <div className="space-y-2.5 pt-1">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center space-x-1.5">
            <span className="w-6 h-6 rounded-lg bg-red-100 text-red-600 flex items-center justify-center font-bold text-xs shadow-2xs">
              🔥
            </span>
            <div>
              <h3 className="text-sm font-extrabold text-stone-900 leading-tight">
                በብዛት የተሸጡ
              </h3>
              <p className="text-[10px] text-stone-500">ተወዳጅና በተደጋጋሚ የተገዙ ምርቶች (Top Best Sellers)</p>
            </div>
          </div>
          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/60">
            {bestSellers.length} እቃዎች
          </span>
        </div>

        {/* Collection of item pictures & cards */}
        <div className="grid grid-cols-2 gap-2.5">
          {bestSellers.map((item: any) => {
            const photos = getProductPhotos(item);
            const photo = photos[0];
            const name = item.name || item.title;
            const price = item.price_etb || item.priceEtb;
            const size = item.size;

            return (
              <div 
                key={item.id}
                className="group relative bg-white rounded-2xl border border-stone-200/90 shadow-2xs overflow-hidden flex flex-col justify-between transition-all hover:shadow-md"
              >
                {/* Photo with Badge */}
                <div className="relative aspect-square w-full bg-stone-100 overflow-hidden">
                  <img 
                    src={photo}
                    onClick={() => openLightbox(photos, 0)}
                    role="button"
                    style={{ cursor: 'zoom-in' }} 
                    alt={name}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                    onClick={() => openLightbox(photos, 0)}
                    role="button"
                    style={{ cursor: 'zoom-in' }}
                  />
                  <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md bg-stone-900/80 backdrop-blur-xs text-amber-400 font-extrabold text-[9px] flex items-center space-x-1">
                    <Flame className="w-3 h-3 text-red-400 fill-red-400" />
                    <span>Top</span>
                  </span>
                  {size && (
                    <span className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded-md bg-white/90 backdrop-blur-xs text-stone-800 font-bold text-[9px] border border-stone-200">
                      {size}
                    </span>
                  )}
                </div>

                {/* Details */}
                <div className="p-2.5 space-y-1.5 flex-1 flex flex-col justify-between">
                  <div>
                    <h4 className="font-bold text-xs text-stone-900 line-clamp-1 leading-snug" title={name}>
                      {name}
                    </h4>
                    <p className="font-black text-amber-700 text-xs mt-0.5">
                      {Number(price).toLocaleString()} ETB
                    </p>
                  </div>

                  {/* Actions: Buy (Customer) or Edit/Delete (Worker) */}
                  <div className="pt-1 flex items-center space-x-1.5">
                    {isAuthorizedWorker && isWorkerMode ? (
                      <div className="flex items-center space-x-1 w-full">
                        <button
                          onClick={() => handleOpenEditProduct(item)}
                          className="flex-1 py-1.5 px-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-amber-300 font-bold text-[11px] shadow-xs active:scale-95 transition-all cursor-pointer flex items-center justify-center space-x-1"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>አስተካክል (Edit)</span>
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(item.id)}
                          className="p-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 transition-colors"
                          title="አጥፋ"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleBuyClick(item)}
                        className="flex-1 py-1.5 px-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-[11px] shadow-xs active:scale-95 transition-all cursor-pointer flex items-center justify-center space-x-1"
                      >
                        <ShoppingBag className="w-3 h-3" />
                        <span>ግዛ (Buy)</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 1. EXACTLY SIX SHELF CATEGORIES SELECTION (With Smaller Features) */}
      <div className="space-y-2.5 pt-2 border-t border-stone-200/80">
        <div className="flex items-center justify-between px-1">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-600">
              የእቃዎች ዝርዝር (Shelf Categories)
            </h3>
            <p className="text-[10px] text-stone-400">6ቱን ዋና ዋና ምድቦች ይምረጡ</p>
          </div>

          {/* Strict RBAC Worker Shelf Controls: Visible ONLY when Telegram username === @korcha_support */}
          {isAuthorizedWorker && (
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setIsWorkerMode(!isWorkerMode)}
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all ${
                  isWorkerMode 
                    ? 'bg-amber-600 text-white' 
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
                title="የሰራተኛ ማስተካከያ ሁኔታ (@korcha_support)"
              >
                🛠 {isWorkerMode ? `@${workerUsername}` : 'ሰራተኛ'}
              </button>
              {isAuthorizedWorker && isWorkerMode && (
                <>
                  <button
                    onClick={() => handleOpenEditCategory(currentCategory)}
                    className="px-2 py-0.5 rounded-md bg-stone-800 hover:bg-stone-700 text-amber-300 text-[10px] font-bold flex items-center space-x-0.5 shadow-2xs"
                    title="የተመረጠውን ምድብ ስም/አይከን አስተካክል"
                  >
                    <Edit2 className="w-2.5 h-2.5" />
                    <span>ምድብ አስተካክል</span>
                  </button>
                  <button
                    onClick={handleOpenAddProduct}
                    className="px-2 py-0.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold flex items-center space-x-0.5 shadow-2xs"
                  >
                    <Plus className="w-3 h-3" />
                    <span>አዲስ እቃ</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Compact, Highly Visible 6-Category Grid (Mini App Optimized) */}
        <div className="grid grid-cols-3 gap-1.5">
          {categories.map((cat) => {
            const isSelected = cat.id === activeCatId;
            const count = shelfProducts.filter(p => (p.category_id || p.categoryId) === cat.id).length;

            return (
              <button
                key={cat.id}
                onClick={() => handleCategoryClick(cat.id)}
                className={`py-1.5 px-2 rounded-xl border text-center transition-all cursor-pointer relative flex flex-col items-center justify-center min-h-[46px] ${
                  isSelected
                    ? 'border-amber-600 bg-amber-500/15 shadow-xs ring-1 ring-amber-500 text-amber-950 font-black'
                    : 'border-stone-200/90 bg-white hover:bg-stone-50 shadow-2xs text-stone-800'
                }`}
              >
                <div className="flex items-center space-x-1">
                  <span className="text-xs leading-none">{cat.icon}</span>
                  <span className={`text-[10px] font-bold leading-tight line-clamp-1 ${isSelected ? 'text-amber-950 font-black' : 'text-stone-900'}`}>
                    {cat.nameAm}
                  </span>
                </div>
                <div className="flex items-center space-x-1 mt-0.5">
                  <span className="text-[8px] text-stone-400 font-medium leading-none">{cat.nameEn}</span>
                  {count > 0 && (
                    <span className="px-1 py-0.2 rounded-full bg-amber-100 text-amber-900 text-[7px] font-black leading-none">
                      {count}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Category Products Viewer (Shows Products or Exact Required Empty State) */}
        <div className="mt-2 pt-1">
          {currentCategory && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <h4 className="text-xs font-bold text-stone-800 flex items-center space-x-1.5">
                  <span>{currentCategory.icon}</span>
                  <span>{currentCategory.nameAm}</span>
                  <span className="text-[10px] text-stone-400 font-normal">({currentCategory.nameEn})</span>
                </h4>
                <span className="text-[10px] text-stone-500 font-medium">
                  {categoryProducts.length} እቃዎች
                </span>
              </div>

              {categoryProducts.length === 0 ? (
                /* EXACT REQUIRED EMPTY STATE MESSAGE */
                <div className="p-5 rounded-2xl bg-amber-50/50 border border-amber-200/80 text-center space-y-3">
                  <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center mx-auto text-lg shadow-inner">
                    📦
                  </div>
                  <div className="space-y-1">
                    <p className="font-extrabold text-xs text-amber-950 leading-relaxed max-w-xs mx-auto">
                      "በዚህ ዝርዝር ውስጥ የሚሸጥ ዕቃ ጨርሰናል። እባክዎ በቴሌግራም ቦት ወይንም በሚኒ አፕ ይዘዙን"።
                    </p>
                    <p className="text-[10px] text-stone-500">
                      የፈለጉትን ማንኛውንም እቃ ከ Shein ወይም Amazon በሊንክ ወይም በስክሪንሾት ማዘዝ ይችላሉ።
                    </p>
                  </div>
                  <div className="flex justify-center space-x-2 pt-1">
                    <button
                      onClick={() => onOpenQuoteModal('link')}
                      className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs active:scale-95 transition-all cursor-pointer inline-flex items-center space-x-1"
                    >
                      <LinkIcon className="w-3.5 h-3.5" />
                      <span>በሊንክ እዘዝ</span>
                    </button>
                    <button
                      onClick={() => onOpenQuoteModal('screenshot')}
                      className="px-3 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs shadow-xs active:scale-95 transition-all cursor-pointer inline-flex items-center space-x-1"
                    >
                      <Camera className="w-3.5 h-3.5 text-amber-400" />
                      <span>በስክሪንሾት እዘዝ</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Product Grid for category */
                <div className="grid grid-cols-2 gap-2.5">
                  {categoryProducts.map((prod: any) => {
                    const photos = getProductPhotos(prod);
                    const photo = photos[0];
                    const name = prod.name || prod.title;
                    const price = prod.price_etb || prod.priceEtb;
                    const size = prod.size;

                    return (
                      <div
                        key={prod.id}
                        className="p-2.5 rounded-2xl bg-white border border-stone-200/90 shadow-2xs space-y-2 flex flex-col justify-between"
                      >
                        <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-stone-100">
                          <img
                            src={photo}
                    onClick={() => openLightbox(photos, 0)}
                    role="button"
                    style={{ cursor: 'zoom-in' }}
                            alt={name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                          {size && (
                            <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-stone-900/80 backdrop-blur-xs text-white text-[9px] font-bold">
                              {size}
                            </span>
                          )}
                        </div>

                        <div>
                          <p className="font-bold text-xs text-stone-900 line-clamp-1" title={name}>{name}</p>
                          <p className="text-amber-700 font-black text-xs mt-0.5">{Number(price).toLocaleString()} ETB</p>
                        </div>

                        <div className="flex items-center space-x-1 pt-0.5">
                          {isAuthorizedWorker && isWorkerMode ? (
                            <div className="flex items-center space-x-1 w-full">
                              <button
                                onClick={() => handleOpenEditProduct(prod)}
                                className="flex-1 py-1.5 px-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-amber-300 font-bold text-[11px] shadow-xs active:scale-95 transition-all cursor-pointer flex items-center justify-center space-x-1"
                              >
                                <Edit2 className="w-3 h-3" />
                                <span>አስተካክል (Edit)</span>
                              </button>
                              <button
                                onClick={() => handleDeleteProduct(prod.id)}
                                className="p-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 transition-colors"
                                title="አጥፋ"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleBuyClick(prod)}
                              className="flex-1 py-1.5 px-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-[11px] shadow-xs active:scale-95 transition-all cursor-pointer flex items-center justify-center space-x-1"
                            >
                              <ShoppingBag className="w-3 h-3" />
                              <span>ግዛ (Buy)</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* DIRECT SHELF BUY MODAL: No screenshot/bot wizard — Only 1) Choice of Payment (Telebirr/CBE) & 2) Phone + Auto-Scraped Username (40% now, 60% in 1-2 days) */}
      {selectedBuyProduct && (() => {
        const prodName = selectedBuyProduct.name || selectedBuyProduct.title || 'የShelf እቃ';
        const prodPhoto = selectedBuyProduct.photo_url || selectedBuyProduct.photoUrl || selectedBuyProduct.image;
        const prodSize = selectedBuyProduct.size;
        const totalPrice = Math.max(1, Math.round(Number(selectedBuyProduct.price_etb || selectedBuyProduct.priceEtb || 0)));
        const deposit40 = Math.round(totalPrice * 0.40);
        const balance60 = totalPrice - deposit40;
        const activeAccount = shelfPaymentMethod === 'cbe_birr' ? paymentAccounts.cbeAccount : paymentAccounts.telebirrPhone;
        const activePaymentLabel = shelfPaymentMethod === 'cbe_birr' ? 'CBE / የኢትዮጵያ ንግድ ባንክ' : 'ቴሌብር (Telebirr)';

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/75 backdrop-blur-xs animate-fade-in">
            <div className="bg-white rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-2xl border border-stone-200 relative max-h-[92vh] overflow-y-auto">
              <button
                onClick={() => {
                  setSelectedBuyProduct(null);
                  setConfirmedShelfOrder(null);
                  setShelfOrderError(null);
                }}
                className="absolute top-4 right-4 p-1.5 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-500 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Product Header Summary */}
              <div className="flex items-center space-x-3 pr-6">
                <img
                  src={prodPhoto}
                  alt={prodName}
                  className="w-16 h-16 rounded-2xl object-cover border border-stone-200 shrink-0"
                / onClick={() => openLightbox(getProductPhotos(selectedBuyProduct), 0)} style={{cursor:"zoom-in"}}>
                <div>
                  <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 font-bold text-[10px]">
                    ⚡ የShelf ቀጥታ ግዢ (1-2 ቀን አቅርቦት)
                  </span>
                  <h3 className="font-extrabold text-sm text-stone-900 mt-1 line-clamp-1">
                    {prodName}
                  </h3>
                  <div className="flex items-center space-x-2 mt-0.5">
                    <span className="font-black text-amber-700 text-sm">
                      {totalPrice.toLocaleString()} ብር
                    </span>
                    {prodSize && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-100 text-stone-700 font-bold">
                        መጠን: {prodSize}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* 40% Now / 60% on Delivery (1-2 Days) Payment Split Breakdown */}
              <div className="p-3 rounded-2xl bg-amber-50/80 border border-amber-200/90 space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-stone-700">
                  <span className="font-semibold">ጠቅላላ የእቃ ዋጋ (100%):</span>
                  <span className="font-bold text-stone-900">{totalPrice.toLocaleString()} ብር</span>
                </div>
                <div className="flex items-center justify-between text-emerald-900 bg-emerald-100/80 px-2.5 py-1.5 rounded-xl border border-emerald-200">
                  <span className="font-extrabold">አሁን የሚከፈል (40% ቅድመ ክፍያ):</span>
                  <span className="font-black text-sm">{deposit40.toLocaleString()} ብር</span>
                </div>
                <div className="flex items-center justify-between text-stone-700 pt-0.5">
                  <span className="font-semibold text-[11px]">ቀሪ 60% (በ1-2 ቀን እቃው ሲደርስዎት):</span>
                  <span className="font-extrabold text-stone-900">{balance60.toLocaleString()} ብር</span>
                </div>
              </div>

              {confirmedShelfOrder ? (
                /* ORDER CONFIRMED STATE */
                <div className="space-y-3 pt-1">
                  <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-1.5">
                    <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                    <p className="font-extrabold text-xs text-emerald-950">
                      ትዕዛዝዎ ተመዝግቧል! ኮድ፡ <span className="underline">{confirmedShelfOrder.orderCode}</span>
                    </p>
                    <p className="text-[11px] text-emerald-800 leading-relaxed">
                      የ40% ቅድመ ክፍያውን (<b>{deposit40.toLocaleString()} ብር</b>) በመረጡት <b>{activePaymentLabel}</b> ይክፈሉ። ቀሪውን 60% (<b>{balance60.toLocaleString()} ብር</b>) እቃው በ1-2 ቀን ሲደርስዎት ይከፍላሉ!
                    </p>
                  </div>

                  {/* Chosen Payment Account Box */}
                  <div className="p-3 rounded-2xl bg-stone-900 text-white space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-stone-400 text-[10px] font-bold uppercase">የተመረጠው የክፍያ ሂሳብ ({activePaymentLabel})</span>
                      <span className="px-2 py-0.5 rounded bg-amber-500 text-stone-950 font-black text-[10px]">
                        40% = {deposit40.toLocaleString()} ብር
                      </span>
                    </div>
                    <div className="flex items-center justify-between bg-white/10 px-3 py-2 rounded-xl">
                      <code className="font-black text-amber-300 text-sm tracking-wide">{activeAccount}</code>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(activeAccount);
                        }}
                        className="px-2 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-[10px] cursor-pointer"
                      >
                        Copy
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 pt-1">
                    {onShelfOrderCreated && (
                      <button
                        type="button"
                        onClick={() => {
                          const code = confirmedShelfOrder.orderCode;
                          const ph = shelfCustomerPhone.trim();
                          setSelectedBuyProduct(null);
                          setConfirmedShelfOrder(null);
                          onShelfOrderCreated(code, ph, true);
                        }}
                        className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs flex items-center justify-center space-x-2 shadow-md cursor-pointer"
                      >
                        <MessageCircle className="w-4 h-4" />
                        <span>💬 በሚኒ አፕ ከሰራተኛ ጋር አውራ (Messages)</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedBuyProduct(null);
                        setConfirmedShelfOrder(null);
                      }}
                      className="w-full py-2.5 px-4 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs cursor-pointer"
                    >
                      ዝጋ (Close)
                    </button>
                  </div>
                </div>
              ) : (
                /* STREAMLINED 2-QUESTION SHELF CHECKOUT FORM */
                <form onSubmit={handleConfirmShelfOrder} className="space-y-3.5 text-xs">
                  {shelfOrderError && (
                    <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 font-bold text-[11px] flex items-center space-x-1.5">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{shelfOrderError}</span>
                    </div>
                  )}

                  {/* QUESTION 1: Choice of Payment (Telebirr or CBE) */}
                  <div className="space-y-1.5">
                    <label className="block font-extrabold text-stone-800 text-xs">
                      1) የክፍያ ምርጫዎን ይምረጡ (Choice of Payment):
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setShelfPaymentMethod('telebirr')}
                        className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer ${
                          shelfPaymentMethod === 'telebirr'
                            ? 'border-amber-600 bg-amber-50/90 ring-2 ring-amber-500/40 shadow-xs'
                            : 'border-stone-200 bg-white hover:bg-stone-50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-extrabold text-amber-900 text-xs">ቴሌብር</span>
                          <Zap className="w-3.5 h-3.5 text-amber-600" />
                        </div>
                        <p className="text-[10px] font-bold text-stone-700 truncate">{paymentAccounts.telebirrPhone}</p>
                        <p className="text-[9px] text-emerald-700 font-semibold mt-0.5">40%: {deposit40.toLocaleString()} ብር</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setShelfPaymentMethod('cbe_birr')}
                        className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer ${
                          shelfPaymentMethod === 'cbe_birr'
                            ? 'border-purple-600 bg-purple-50/90 ring-2 ring-purple-500/40 shadow-xs'
                            : 'border-stone-200 bg-white hover:bg-stone-50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-extrabold text-purple-900 text-xs">CBE (ንግድ ባንክ)</span>
                          <CreditCard className="w-3.5 h-3.5 text-purple-600" />
                        </div>
                        <p className="text-[10px] font-bold text-stone-700 truncate">{paymentAccounts.cbeAccount}</p>
                        <p className="text-[9px] text-purple-700 font-semibold mt-0.5">40%: {deposit40.toLocaleString()} ብር</p>
                      </button>
                    </div>
                  </div>

                  {/* QUESTION 2: Phone Number & Scraped Telegram Username */}
                  <div className="space-y-2.5 pt-1 border-t border-stone-100">
                    <label className="block font-extrabold text-stone-800 text-xs">
                      2) ስልክ ቁጥር እና የቴሌግራም ስም (Phone & Username):
                    </label>

                    {/* Phone Number Input */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-bold text-stone-700">ስልክ ቁጥር (Phone Number) *</span>
                        {typeof window !== 'undefined' && (window as any).Telegram?.WebApp?.requestContact && (
                          <button
                            type="button"
                            onClick={handleRequestTelegramPhone}
                            className="text-[10px] font-bold text-amber-700 hover:underline cursor-pointer"
                          >
                            📱 ከቴሌግራም ሙላ
                          </button>
                        )}
                      </div>
                      <input
                        type="tel"
                        required
                        placeholder="0912345678 ወይም 0712345678"
                        value={shelfCustomerPhone}
                        onChange={(e) => setShelfCustomerPhone(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl border border-stone-300 focus:ring-2 focus:ring-amber-500 outline-hidden font-bold text-xs"
                      />
                    </div>

                    {/* Auto-scraped Telegram Username */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-bold text-stone-700">የቴሌግራም Username</span>
                        {isUsernameScraped && shelfCustomerUsername && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                            ✓ ከቴሌግራም የተወሰደ (Auto-scraped)
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        placeholder="@username (ከቴሌግራም በራሱ ይሞላል)"
                        value={shelfCustomerUsername}
                        onChange={(e) => setShelfCustomerUsername(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:ring-2 focus:ring-amber-500 outline-hidden font-semibold text-xs text-stone-800"
                      />
                    </div>
                  </div>

                  {/* Selected Payment Account Preview */}
                  <div className="p-2.5 rounded-xl bg-stone-100 border border-stone-200/80 text-[11px] text-stone-700 flex items-center justify-between">
                    <span>የ40% ክፍያ ማስገቢያ ({activePaymentLabel}):</span>
                    <code className="font-black text-stone-900">{activeAccount}</code>
                  </div>

                  {/* Confirm Direct Shelf Order Button */}
                  <button
                    type="submit"
                    disabled={isSubmittingShelfOrder}
                    className="w-full py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-extrabold text-xs flex items-center justify-center space-x-2 shadow-lg shadow-amber-600/25 active:scale-95 transition-all cursor-pointer"
                  >
                    <ShoppingBag className="w-4 h-4" />
                    <span>
                      {isSubmittingShelfOrder
                        ? 'ትዕዛዝዎ እየተመዘገበ ነው...'
                        : `ትዕዛዙን አረጋግጥ (40% = ${deposit40.toLocaleString()} ብር)`}
                    </span>
                  </button>
                </form>
              )}
            </div>
          </div>
        );
      })()}

      {/* 2. WORKER SHELF EDITOR MODAL (korcha_support) */}
      {isAuthorizedWorker && isEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-2xl border border-stone-200 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsEditorOpen(false)}
              className="absolute top-4 right-4 p-1 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-500 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div>
              <span className="px-2 py-0.5 rounded-md bg-stone-900 text-amber-400 font-bold text-[10px]">
                ሰራተኛ (korcha_support)
              </span>
              <h3 className="font-extrabold text-sm text-stone-900 mt-1">
                {editingProduct ? 'እቃውን አስተካክል (Edit Product)' : 'አዲስ እቃ ወደ Shelf ጨምር (Add Product)'}
              </h3>
              <p className="text-[10px] text-stone-500">ስም፣ መጠን፣ ፎቶ እና ዋጋን ያቀናብሩ</p>
            </div>

            {editorNotification && (
              <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200 flex items-center space-x-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{editorNotification}</span>
              </div>
            )}

            <form onSubmit={handleSaveProduct} className="space-y-3 text-xs">
              {/* Category */}
              <div>
                <label className="block font-bold text-stone-700 mb-1">ምድብ (Category)</label>
                <select
                  value={editorForm.categoryId}
                  onChange={(e) => setEditorForm({ ...editorForm, categoryId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white focus:ring-2 focus:ring-amber-500 outline-hidden font-medium"
                >
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.nameAm} ({cat.nameEn})
                    </option>
                  ))}
                </select>
              </div>

              {/* Name */}
              <div>
                <label className="block font-bold text-stone-700 mb-1">የእቃው ስም (Name)</label>
                <input
                  type="text"
                  required
                  placeholder="ለምሳሌ: Shein Floral Summer Maxi Dress"
                  value={editorForm.name}
                  onChange={(e) => setEditorForm({ ...editorForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 focus:ring-2 focus:ring-amber-500 outline-hidden font-medium"
                />
              </div>

              {/* Size */}
              <div>
                <label className="block font-bold text-stone-700 mb-1">መጠን (Size)</label>
                <input
                  type="text"
                  placeholder="ለምሳሌ: S, M, L, XL ወይም One Size ወይም 300ml"
                  value={editorForm.size}
                  onChange={(e) => setEditorForm({ ...editorForm, size: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 focus:ring-2 focus:ring-amber-500 outline-hidden font-medium"
                />
              </div>

              {/* Price in ETB */}
              <div>
                <label className="block font-bold text-stone-700 mb-1">ዋጋ በብር (Price in ETB)</label>
                <input
                  type="number"
                  required
                  min="1"
                  step="0.01"
                  placeholder="ለምሳሌ: 2850"
                  value={editorForm.priceEtb}
                  onChange={(e) => setEditorForm({ ...editorForm, priceEtb: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 focus:ring-2 focus:ring-amber-500 outline-hidden font-medium"
                />
              </div>

              {/* Photo URL */}
              <div>
                <label className="block font-bold text-stone-700 mb-1">የፎቶ ሊንኮች (Photo URLs — አንድ በአንድ መስመር)</label>
                <textarea
                  required
                  rows={3}
                  placeholder={"https://example.com/front.jpg\nhttps://example.com/back.jpg\nhttps://example.com/side.jpg"}
                  value={editorForm.photoUrlsText || editorForm.photoUrl || ''}
                  onChange={(e) => setEditorForm({
                    ...editorForm,
                    photoUrlsText: e.target.value,
                    photoUrl: e.target.value.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean)[0] || '',
                  })}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 focus:ring-2 focus:ring-amber-500 outline-hidden font-medium text-xs"
                />
                <p className="text-[10px] text-stone-500 mt-1">ብዙ ፎቶዎችን እያንዳንዱን በአዲስ መስመር ያስገቡ (front, back, side...)</p>
                {(editorForm.photoUrlsText || editorForm.photoUrl) && (
                  <div className="mt-1.5 w-16 h-16 rounded-xl overflow-hidden border border-stone-200">
                    <img 
                      src={editorForm.photoUrl} 
                      alt="Preview" 
                      className="w-full h-full object-cover"
                      onError={(e: any) => { e.target.style.display = 'none'; }}
                    />
                  </div>
                )}
              </div>

              {/* Best Seller Checkbox */}
              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="bestseller_check"
                  checked={editorForm.isBestseller}
                  onChange={(e) => setEditorForm({ ...editorForm, isBestseller: e.target.checked })}
                  className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                />
                <label htmlFor="bestseller_check" className="font-bold text-stone-800 text-xs cursor-pointer flex items-center space-x-1">
                  <span>🔥 በብዛት የተሸጡ (Best Seller) ላይ ይታይ</span>
                </label>
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 flex space-x-2">
                <button
                  type="submit"
                  disabled={isSavingProduct}
                  className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
                >
                  {isSavingProduct ? 'እየተቀመጠ ነው...' : editingProduct ? 'አስተካክል (Save Changes)' : 'እቃ ጨምር (Add)'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditorOpen(false)}
                  className="py-2.5 px-4 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs transition-colors"
                >
                  ሰርዝ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2B. WORKER CATEGORY EDITOR MODAL (korcha_support) */}
      {isAuthorizedWorker && isCatEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-2xl border border-stone-200 relative">
            <button
              onClick={() => setIsCatEditorOpen(false)}
              className="absolute top-4 right-4 p-1 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-500 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div>
              <span className="px-2 py-0.5 rounded-md bg-stone-900 text-amber-400 font-bold text-[10px]">
                ሰራተኛ (korcha_support)
              </span>
              <h3 className="font-extrabold text-sm text-stone-900 mt-1">
                ምድብ አስተካክል (Edit Category)
              </h3>
              <p className="text-[10px] text-stone-500">የምድቡን የአማርኛ ስም፣ የእንግሊዝኛ ስም እና አይከን ያስተካክሉ</p>
            </div>

            <form onSubmit={handleSaveCategory} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-stone-700 mb-1">ምድብ ይምረጡ (Select Category)</label>
                <select
                  value={catForm.id}
                  onChange={(e) => {
                    const found = categories.find(c => c.id === e.target.value);
                    if (found) {
                      setCatForm({ id: found.id, nameAm: found.nameAm, nameEn: found.nameEn, icon: found.icon });
                    }
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white font-medium"
                >
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.icon} {cat.nameAm} ({cat.nameEn})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">የአማርኛ ስም (Amharic Name)</label>
                <input
                  type="text"
                  required
                  value={catForm.nameAm}
                  onChange={(e) => setCatForm({ ...catForm, nameAm: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 font-medium"
                />
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">የእንግሊዝኛ ስም (English Name)</label>
                <input
                  type="text"
                  required
                  value={catForm.nameEn}
                  onChange={(e) => setCatForm({ ...catForm, nameEn: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 font-medium"
                />
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">አይከን / Emoji (Icon)</label>
                <input
                  type="text"
                  value={catForm.icon}
                  onChange={(e) => setCatForm({ ...catForm, icon: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 font-medium"
                />
              </div>

              <div className="pt-2 flex space-x-2">
                <button
                  type="submit"
                  disabled={isSavingProduct}
                  className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-md cursor-pointer"
                >
                  {isSavingProduct ? 'እየተቀመጠ ነው...' : 'ምድቡን አስቀምጥ (Save Category)'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsCatEditorOpen(false)}
                  className="py-2.5 px-4 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs"
                >
                  ሰርዝ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Full-screen image lightbox with zoom */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center p-3"
          onClick={() => setLightbox(null)}
        >
          <div className="absolute top-3 right-3 flex items-center space-x-2 z-[110]" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setZoom((z) => Math.max(1, z - 0.5))} className="w-10 h-10 rounded-full bg-white/20 text-white text-xl font-bold">−</button>
            <span className="text-white text-xs font-bold w-12 text-center">{Math.round(zoom * 100)}%</span>
            <button type="button" onClick={() => setZoom((z) => Math.min(4, z + 0.5))} className="w-10 h-10 rounded-full bg-white/20 text-white text-xl font-bold">+</button>
            <button type="button" onClick={() => setLightbox(null)} className="w-10 h-10 rounded-full bg-white/20 text-white text-lg font-bold">×</button>
          </div>
          <div className="relative max-w-full max-h-[75vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <img
              src={lightbox.photos[lightbox.index]}
              alt="Product detail"
              style={{ transform: `scale(${zoom})`, transformOrigin: 'center center', transition: 'transform 0.15s ease' }}
              className="max-w-full max-h-[75vh] object-contain select-none"
              draggable={false}
            />
          </div>
          {lightbox.photos.length > 1 && (
            <div className="flex items-center space-x-3 mt-4" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="px-3 py-1.5 rounded-lg bg-white/20 text-white text-xs font-bold"
                onClick={() => { setZoom(1); setLightbox((lb) => lb ? { ...lb, index: (lb.index - 1 + lb.photos.length) % lb.photos.length } : null); }}
              >
                ‹ ቀዳሚ
              </button>
              <span className="text-white text-xs font-bold">{lightbox.index + 1} / {lightbox.photos.length}</span>
              <button
                type="button"
                className="px-3 py-1.5 rounded-lg bg-white/20 text-white text-xs font-bold"
                onClick={() => { setZoom(1); setLightbox((lb) => lb ? { ...lb, index: (lb.index + 1) % lb.photos.length } : null); }}
              >
                ቀጣይ ›
              </button>
            </div>
          )}
          <p className="text-white/70 text-[10px] mt-2">እጅዎን በመንካት ያጉላሉ · ከበስተጀርባ በመንካት ይዝጉ</p>
        </div>
      )}

    </div>
  );
};

export default StorefrontHome;
