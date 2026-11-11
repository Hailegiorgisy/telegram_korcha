// src/components/StorefrontHome.tsx: Role-Separated Storefront: Workers Edit, Customers Order
import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag, 
  Globe, 
  MapPin, 
  MapPin, 
  ExternalLink, 
  Sparkles, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  Truck, 
  Search, 
  CreditCard,
  MessageCircle,
  Link as LinkIcon,
  Camera,
  ChevronRight,
  X,
  Edit,
  Trash2,
  PlusCircle
} from 'lucide-react';

interface Product {
  id: number;
  category_id: string;
  name: string;
  size?: string;
  price_etb: number;
  photo_url?: string;
  is_bestseller?: boolean;
}

interface Category {
  id: string;
  nameAm: string;
  nameEn: string;
  icon: string;
  color: string;
}

interface StorefrontHomeProps {
  onOpenQuoteModal: (mode: 'link' | 'screenshot') => void;
  selectedCategory: string;
  onSelectCategory: (catId: string) => void;
  onShelfOrderCreated?: (orderCode: string, phone: string, openMessages?: boolean) => void;
  isWorker?: boolean;
}

export const StorefrontHome: React.FC<StorefrontHomeProps> = ({
  onOpenQuoteModal,
  selectedCategory,
  onSelectCategory,
  onShelfOrderCreated,
  isWorker = false,
}) => {
  const [products, setProducts] = useState<Product[]>([]);
  // Curated Region Selection: USA, Arabian market, Korean
  const [selectedRegion, setSelectedRegion] = useState<'USA' | 'ARABIAN' | 'KOREAN'>('USA');
  const [selectedSubCategory, setSelectedSubCategory] = useState<string | null>(null);

  const regionCategories = {
    USA: [
      { id: 'Food', nameEn: 'Food', nameAm: 'ምግብ እና ስናክስ', icon: '🍎' },
      { id: 'Supplements', nameEn: 'Supplements', nameAm: 'ቫይታሚን እና ማሟያ', icon: '💊' },
      { id: 'Skin care products', nameEn: 'Skin care products', nameAm: 'የቆዳ መንከባከቢያ', icon: '✨' },
      { id: 'Others', nameEn: 'Others', nameAm: 'ሌሎች እቃዎች', icon: '📦' },
    ],
    ARABIAN: [
      { id: 'Food', nameEn: 'Food', nameAm: 'የአረብ ሀገር ምግቦች/ቅመሞች', icon: '🍯' },
      { id: 'Supplements', nameEn: 'Supplements', nameAm: 'የተፈጥሮ ጤና ማሟያ', icon: '🌿' },
    ],
    KOREAN: [
      { id: 'Skin care products', nameEn: 'Skin care products', nameAm: 'K-Beauty የኮሪያ ውበት', icon: '🌸' },
    ],
  };

  const originHubs = [
    {
      id: 'KSA_UAE' as const,
      titleEn: 'KSA / UAE',
      titleAm: 'ሳውዲ / ኤምሬትስ',
      flag: '🇸🇦 🇦🇪',
      etaAm: '5-8 ቀናት',
      badge: 'ፈጣን ካርጎ',
      borderClass: 'border-emerald-500 bg-emerald-500/10 text-emerald-900',
      activeClass: 'ring-2 ring-emerald-500 bg-emerald-50 border-emerald-500',
      marketplaces: [
        { name: 'Noon', url: 'https://www.noon.com', gradient: 'from-amber-400 to-yellow-500', label: 'ኤሌክትሮኒክስና ሽቶ' },
        { name: 'Amazon AE', url: 'https://www.amazon.ae', gradient: 'from-amber-500 to-orange-600', label: 'ሁሉም ዓይነት' },
        { name: 'Shein Gulf', url: 'https://ar.shein.com', gradient: 'from-pink-500 to-rose-600', label: 'ልብሶችና አባያ' },
      ]
    },
    {
      id: 'USA' as const,
      titleEn: 'USA',
      titleAm: 'አሜሪካ',
      flag: '🇺🇸',
      etaAm: '10-14 ቀናት',
      badge: 'ኦሪጅናል ብራንድ',
      borderClass: 'border-blue-500 bg-blue-500/10 text-blue-900',
      activeClass: 'ring-2 ring-blue-500 bg-blue-50 border-blue-500',
      marketplaces: [
        { name: 'Amazon US', url: 'https://www.amazon.com', gradient: 'from-amber-500 to-orange-600', label: 'ኦሪጅናል እቃዎች' },
        { name: 'eBay', url: 'https://www.ebay.com', gradient: 'from-blue-600 to-indigo-600', label: 'ኤሌክትሮኒክስና ጫማ' },
        { name: 'Walmart', url: 'https://www.walmart.com', gradient: 'from-sky-500 to-blue-600', label: 'የቤት መገልገያ' },
      ]
    },
    {
      id: 'CHINA' as const,
      titleEn: 'China',
      titleAm: 'ቻይና',
      flag: '🇨🇳',
      etaAm: '10-14 ቀናት',
      badge: 'የፋብሪካ ዋጋ',
      borderClass: 'border-red-500 bg-red-500/10 text-red-900',
      activeClass: 'ring-2 ring-red-500 bg-red-50 border-red-500',
      marketplaces: [
        { name: 'Pingodo', url: 'https://mobile.yangkeduo.com', gradient: 'from-red-600 to-amber-500', label: 'የፋብሪካ ቀጥታ' },
        { name: 'Shein', url: 'https://www.shein.com', gradient: 'from-rose-500 to-pink-600', label: 'ፋሽንና አልባሳት' },
        { name: 'AliExpress', url: 'https://www.aliexpress.com', gradient: 'from-amber-500 to-orange-600', label: 'ኤሌክትሮኒክስ' },
      ]
    }
  ];

  const currentMarketplaces = selectedOrigin === 'ALL'
    ? [
        { name: 'Noon (KSA/UAE)', url: 'https://www.noon.com', gradient: 'from-amber-400 to-yellow-500', label: 'ሳውዲ/ኤምሬትስ' },
        { name: 'Amazon (USA)', url: 'https://www.amazon.com', gradient: 'from-amber-500 to-orange-600', label: 'አሜሪካ' },
        { name: 'Pingodo (China)', url: 'https://mobile.yangkeduo.com', gradient: 'from-red-600 to-amber-500', label: 'ቻይና ቀጥታ' },
      ]
    : (originHubs.find(h => h.id === selectedOrigin)?.marketplaces || []);

  const [categories, setCategories] = useState<Category[]>([
    { id: 'all', nameAm: 'ሁሉም', nameEn: 'All', icon: '✨', color: 'from-amber-500 to-amber-600' },
    { id: 'womens', nameAm: 'የሴቶች አልባሳት', nameEn: "Women's Clothing", icon: '👗', color: 'from-pink-500 to-rose-600' },
    { id: 'kids', nameAm: 'የህጻናት', nameEn: 'Kids & Babies', icon: '🧸', color: 'from-amber-400 to-orange-500' },
    { id: 'beauty', nameAm: 'የመዋቢያ ዕቃዎች', nameEn: 'Beauty & Skin Care', icon: '💄', color: 'from-fuchsia-500 to-purple-600' },
    { id: 'electronics', nameAm: 'ኤሌክትሮኒክስ', nameEn: 'Electronics', icon: '📱', color: 'from-blue-500 to-indigo-600' },
    { id: 'home', nameAm: 'የቤት ውስጥ', nameEn: 'Home & Kitchen', icon: '🍳', color: 'from-stone-600 to-stone-800' },
    { id: 'miscellaneous', nameAm: 'ሌሎች', nameEn: 'Other', icon: '✨', color: 'from-emerald-500 to-teal-700' },
  ]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Customer Checkout Modal State
  const [selectedProductForOrder, setSelectedProductForOrder] = useState<Product | null>(null);
  const [checkoutPhone, setCheckoutPhone] = useState<string>(() => {
    try { return localStorage.getItem('korcha_customer_phone') || ''; } catch { return ''; }
  });
  const [checkoutPaymentMethod, setCheckoutPaymentMethod] = useState<'telebirr' | 'cbe_birr'>('telebirr');
  const [isSubmittingOrder, setIsSubmittingOrder] = useState<boolean>(false);
  const [confirmedOrder, setConfirmedOrder] = useState<any | null>(null);

  // Worker Shelf Editing State
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editPrice, setEditPrice] = useState<string>('');
  const [editName, setEditName] = useState<string>('');
  const [editSize, setEditSize] = useState<string>('');
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);

  // Worker Add Product Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [newName, setNewName] = useState<string>('');
  const [newPrice, setNewPrice] = useState<string>('');
  const [newSize, setNewSize] = useState<string>('Standard');
  const [newCategory, setNewCategory] = useState<string>('womens');
  const [newPhotoUrl, setNewPhotoUrl] = useState<string>('');
  const [isAddingProduct, setIsAddingProduct] = useState<boolean>(false);

  const workerUsername = ((typeof import.meta !== 'undefined' && import.meta.env?.VITE_WORKER_TELEGRAM_USERNAME) || 'korcha_support').replace(/^@/, '');
  const tgUser = typeof window !== 'undefined' ? window.Telegram?.WebApp?.initDataUnsafe?.user : null;

  useEffect(() => {
    fetchShelfData();
  }, [selectedCategory]);

  const fetchShelfData = async () => {
    setIsLoading(true);
    try {
      const url = selectedCategory && selectedCategory !== 'all' 
        ? `/api/shelf?category=${encodeURIComponent(selectedCategory)}` 
        : '/api/shelf';
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        if (data.products) setProducts(data.products);
        if (data.categories && data.categories.length > 0) {
          setCategories([
            { id: 'all', nameAm: 'ሁሉም', nameEn: 'All', icon: '✨', color: 'from-amber-500 to-amber-600' },
            ...data.categories
          ]);
        }
      }
    } catch (e) {
      console.warn('[Fetch Shelf Error]', e);
    } finally {
      setIsLoading(false);
    }
  };

  // Worker: Save Edited Shelf Product
  const handleSaveProductEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    setIsSavingEdit(true);
    try {
      const res = await fetch(`/api/shelf/${editingProduct.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-telegram-username': workerUsername,
        },
        body: JSON.stringify({
          name: editName.trim() || editingProduct.name,
          priceEtb: parseFloat(editPrice) || editingProduct.price_etb,
          size: editSize.trim() || editingProduct.size,
          workerUsername,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert('✅ የእቃው መረጃ ተስተካክሏል!');
        setEditingProduct(null);
        fetchShelfData();
      } else {
        alert(data.error || 'ማስተካከል አልተቻለም');
      }
    } catch (err: any) {
      alert('ስህተት: ' + err.message);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Worker: Delete Shelf Product
  const handleDeleteProduct = async (productId: number) => {
    if (!confirm('ይህ እቃ ከመደርደሪያው ላይ እንዲሰረዝ እርግጠኛ ነዎት?')) return;
    try {
      const res = await fetch(`/api/shelf/${productId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-telegram-username': workerUsername,
        },
      });
      const data = await res.json();
      if (data.success) {
        alert('✅ እቃው ከመደርደሪያው ተሰርዟል');
        fetchShelfData();
      } else {
        alert(data.error || 'መሰረዝ አልተቻለም');
      }
    } catch (err: any) {
      alert('ስህተት: ' + err.message);
    }
  };

  // Worker: Add New Shelf Product
  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newPrice.trim()) {
      alert('እባክዎ የእቃውን ስም እና ዋጋ ያስገቡ');
      return;
    }
    setIsAddingProduct(true);
    try {
      const res = await fetch('/api/shelf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-telegram-username': workerUsername,
        },
        body: JSON.stringify({
          name: newName.trim(),
          priceEtb: parseFloat(newPrice),
          size: newSize.trim() || 'Standard',
          categoryId: newCategory,
          photoUrl: newPhotoUrl.trim() || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&auto=format&fit=crop&q=80',
          createdBy: workerUsername,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert('✅ አዲስ እቃ መደርደሪያው ላይ ተጨምሯል!');
        setIsAddModalOpen(false);
        setNewName('');
        setNewPrice('');
        setNewSize('Standard');
        setNewPhotoUrl('');
        fetchShelfData();
      } else {
        alert(data.error || 'እቃ መጨመር አልተቻለም');
      }
    } catch (err: any) {
      alert('ስህተት: ' + err.message);
    } finally {
      setIsAddingProduct(false);
    }
  };

  // Customer: Submit Direct Shelf Order
  const handleDirectShelfOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductForOrder) return;
    if (!checkoutPhone.trim()) {
      alert('እባክዎ ስልክ ቁጥርዎን ያስገቡ (Please enter phone number)');
      return;
    }

    setIsSubmittingOrder(true);
    try {
      const res = await fetch('/api/shelf/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: selectedProductForOrder.id,
          productName: selectedProductForOrder.name,
          size: selectedProductForOrder.size || 'Standard',
          priceEtb: selectedProductForOrder.price_etb,
          photoUrl: selectedProductForOrder.photo_url || '',
          paymentMethod: checkoutPaymentMethod,
          phone: checkoutPhone.trim(),
          telegramUsername: tgUser?.username || '',
          telegramId: tgUser?.id || null,
          firstName: tgUser?.first_name || '',
        }),
      });

      const data = await res.json();
      if (data.success) {
        if (window.Telegram?.WebApp?.HapticFeedback) {
          window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
        }
        localStorage.setItem('korcha_customer_phone', checkoutPhone.trim());
        setConfirmedOrder(data);
        if (onShelfOrderCreated) {
          onShelfOrderCreated(data.orderCode, checkoutPhone.trim(), false);
        }
      } else {
        alert(data.error || 'ትዕዛዝ መመዝገብ አልተቻለም');
      }
    } catch (err: any) {
      alert('ስህተት: ' + err.message);
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  const filteredProducts = products.filter(p => {
    if (!searchQuery.trim()) return true;
    return p.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="space-y-3 pb-16 animate-fade-in max-w-md mx-auto px-1">
      {/* 1. TOP BANNER: ROLE-BASED (WORKER HUB vs CUSTOMER STOREFRONT) */}
      {isWorker ? (
        /* WORKER OPERATIONS BANNER: INVENTORY MANAGEMENT FOCUS (NO ORDER BUTTONS) */
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-stone-900 via-amber-950 to-stone-950 text-white p-4 shadow-lg border border-amber-900/40">
          <div className="relative z-10 space-y-2">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                <span>የሰራተኛ መደርደሪያ አስተዳደር (Worker Inventory Manager)</span>
              </span>
              <span className="text-[10px] font-bold text-amber-400">@{workerUsername}</span>
            </div>

            <h2 className="text-sm font-extrabold leading-snug">
              የመደርደሪያ እቃዎችን ያስተዳድሩ እና አዲስ እቃ ይጫኑ
            </h2>

            <p className="text-[11px] text-stone-300 leading-tight">
              እዚህ እቃዎችን ማስተካከል፣ ዋጋ መቀየር እና አዳዲስ እቃዎችን መጫን ይችላሉ። ደንበኞች ብቻ ናቸው ማዘዝ የሚችሉት።
            </p>

            {/* Worker Action Button: Add New Product */}
            <div className="pt-1">
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="w-full py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-xs flex items-center justify-center space-x-1.5 shadow-md shadow-amber-500/25 active:scale-95 transition-all cursor-pointer"
              >
                <PlusCircle className="w-4 h-4 text-stone-950" />
                <span>+ አዲስ እቃ ወደ መደርደሪያ ጨምር (Add Product)</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* CUSTOMER STOREFRONT BANNER: ORDER ACTIONS */
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-stone-950 via-stone-900 to-amber-950 text-white p-4 shadow-lg border border-amber-900/30">
          <div className="relative z-10 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30">
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span>የውጭ ገበያ እቃ አቅራቢ</span>
              </span>
              <span className="text-[9px] font-bold text-amber-300 bg-amber-900/60 px-2 py-0.5 rounded-md border border-amber-600/40">
                40% ቅድመ ክፍያ • በብር
              </span>
            </div>

            <div className="flex items-start justify-between gap-2.5">
              <div className="space-y-1">
                <h2 className="text-sm font-extrabold leading-snug text-white">
                  የፈለጉትን እቃ ይምረጡ፣ በርዎ ድረስ እናደርሳለን!
                </h2>
                <p className="text-[11px] text-stone-300 leading-tight">
                  ከ Shein, Amazon ወይም AliExpress የመረጡትን እቃ ሊንክ ወይም ፎቶ አስገብተው አሁኑኑ እዘዙ።
                </p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-amber-400 p-0.5 border border-amber-500/40 shadow-md shadow-amber-500/20 shrink-0 flex items-center justify-center overflow-hidden">
                <img src="/logo.png" alt="Korcha" className="w-full h-full object-contain" />
              </div>
            </div>

            {/* HIGH-VISIBILITY PROMINENT ORDER BUTTONS FOR CUSTOMERS */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => onOpenQuoteModal('link')}
                className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-stone-950 font-black text-xs flex items-center justify-center space-x-1.5 shadow-md shadow-amber-500/25 active:scale-95 transition-all cursor-pointer"
              >
                <LinkIcon className="w-4 h-4 text-stone-950" />
                <span>🔗 በሊንክ እዘዝ (Order)</span>
              </button>

              <button
                onClick={() => onOpenQuoteModal('screenshot')}
                className="py-2.5 px-3 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs flex items-center justify-center space-x-1.5 border border-white/20 active:scale-95 transition-all cursor-pointer shadow-xs"
              >
                <Camera className="w-4 h-4 text-amber-400" />
                <span>📸 በፎቶ እዘዝ (Order)</span>
              </button>
            </div>
          </div>

          <div className="absolute -top-12 -right-12 w-48 h-48 bg-amber-600/20 rounded-full blur-3xl pointer-events-none" />
        </div>
      )}

      {/* 2. COMPACT MARKETPLACE APPS (REDUCED SIZE: ALIEXPRESS, SHEIN, AMAZON) */}
      <div className="bg-white rounded-xl p-2 border border-stone-200/80 shadow-2xs space-y-1.5">
        <div className="flex items-center justify-between px-0.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
            ዓለም አቀፍ ገበያዎች (Global Apps)
          </span>
          <span className="text-[9px] text-amber-700 font-semibold">ሊንክ ኮፒ አድርገው ይዘዙ</span>
        </div>

        {/* Ultra-compact, reduced-size marketplace tiles */}
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { name: 'AliExpress', url: 'https://www.aliexpress.com', gradient: 'from-amber-500 to-orange-600', label: 'ኤሌክትሮኒክስ', tag: 'Ali' },
            { name: 'Shein', url: 'https://www.shein.com', gradient: 'from-rose-500 to-pink-600', label: 'ፋሽን', tag: 'S' },
            { name: 'Amazon', url: 'https://www.amazon.com', gradient: 'from-amber-600 to-yellow-600', label: 'ሁሉም ዓይነት', tag: 'a' },
          ].map((m) => (
            <a
              key={m.name}
              href={m.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-lg bg-stone-50 hover:bg-amber-50/60 border border-stone-200 flex items-center space-x-1.5 transition-all group active:scale-95 cursor-pointer shadow-2xs"
              title={`${m.name} ክፈት`}
            >
              <div className={`w-5 h-5 rounded-md bg-gradient-to-tr ${m.gradient} text-white font-black text-[10px] flex items-center justify-center shrink-0 shadow-2xs`}>
                {m.tag}
              </div>
              <div className="text-left overflow-hidden min-w-0">
                <p className="font-extrabold text-[10px] text-stone-900 leading-none truncate">{m.name}</p>
                <p className="text-[8px] text-stone-500 truncate">{m.label}</p>
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* 2B. PINDUODUO FEATURE SPOT: ከቻይና ገበያ የፈለጉትን ዕቃ ያምጡ */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 text-white p-2.5 shadow-sm border border-red-500/50 flex items-center justify-between gap-2">
        <div className="space-y-0.5 min-w-0 flex-1">
          <div className="flex items-center space-x-1">
            <span className="text-xs">🇨🇳</span>
            <span className="text-[9px] font-black uppercase tracking-wider bg-black/25 px-1.5 py-0.2 rounded-md">
              Pinduoduo • ፒንጎዶ ቀጥታ
            </span>
          </div>
          <h3 className="text-xs font-black tracking-tight leading-snug truncate">
            ከቻይና ገበያ የፈለጉትን ዕቃ ያምጡ
          </h3>
          <p className="text-[9.5px] text-red-100 leading-none">
            ቀጥታ የፋብሪካ ዋጋ • በ10-14 ቀን አዲስ አበባ በርዎ ድረስ
          </p>
        </div>

        <div className="flex items-center space-x-1.5 shrink-0">
          <a
            href="https://mobile.yangkeduo.com"
            target="_blank"
            rel="noopener noreferrer"
            className="py-1 px-2.5 rounded-lg bg-white hover:bg-amber-50 text-red-700 font-extrabold text-[10px] flex items-center space-x-1 shadow-xs transition-all active:scale-95 cursor-pointer"
          >
            <span>ፒንጎዶን ክፈት</span>
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
          <button
            onClick={() => onOpenQuoteModal('link')}
            className="py-1 px-2 rounded-lg bg-stone-950/80 hover:bg-stone-950 text-amber-300 font-bold text-[10px] transition-all cursor-pointer"
            title="የፒንጎዶ ሊንክ አስገብተው እዘዙ"
          >
            በሊንክ እዘዝ
          </button>
        </div>
      </div>

      {/* 2C. THREE REGIONAL OPTIONS (USA, ARABIAN MARKET, KOREAN) + DYNAMIC SUB-CATEGORIES */}
      <div className="bg-white rounded-xl p-2.5 border border-stone-200/90 shadow-2xs space-y-2">
        <div className="flex items-center justify-between px-0.5">
          <div className="flex items-center space-x-1">
            <span className="text-xs">✈️</span>
            <h3 className="text-[11px] font-black uppercase tracking-wider text-stone-900">
              የተመረጡ የውጭ ገበያዎች (Specialty Hubs)
            </h3>
          </div>
          <span className="text-[9px] text-stone-400 font-medium">የፈለጉትን ይምረጡ</span>
        </div>

        {/* 3 Main Region Tabs: Small & Attractive */}
        <div className="grid grid-cols-3 gap-1">
          {[
            { id: 'USA' as const, label: 'USA', flag: '🇺🇸', sub: 'አሜሪካ' },
            { id: 'ARABIAN' as const, label: 'Arabian market', flag: '🇸🇦 🇦🇪', sub: 'የአረብ ገበያ' },
            { id: 'KOREAN' as const, label: 'Korean', flag: '🇰🇷', sub: 'ኮሪያ K-Beauty' },
          ].map((r) => {
            const isSelected = selectedRegion === r.id;
            return (
              <button
                key={r.id}
                onClick={() => {
                  setSelectedRegion(r.id);
                  setSelectedSubCategory(null);
                }}
                className={`py-1.5 px-1 rounded-lg border text-center transition-all active:scale-95 cursor-pointer ${
                  isSelected
                    ? 'border-amber-500 bg-amber-500 text-stone-950 font-black shadow-xs ring-1 ring-amber-400'
                    : 'border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700 font-bold'
                }`}
              >
                <span className="text-xs leading-none block">{r.flag}</span>
                <span className="text-[10px] leading-tight block truncate mt-0.5">{r.label}</span>
                <span className={`text-[7.5px] leading-none block font-medium ${isSelected ? 'text-stone-900' : 'text-stone-400'}`}>
                  {r.sub}
                </span>
              </button>
            );
          })}
        </div>

        {/* Dynamic Sub-Category Options for Selected Region */}
        <div className="pt-1.5 border-t border-stone-100 space-y-1">
          <div className="flex items-center justify-between text-[9px] text-stone-500 font-bold px-0.5">
            <span>
              የ {selectedRegion === 'USA' ? 'USA (አሜሪካ)' : selectedRegion === 'ARABIAN' ? 'Arabian market (የአረብ ገበያ)' : 'Korean (የኮሪያ)'} የተመረጡ ምርቶች:
            </span>
            <span className="text-amber-700">ለመጠየቅ ይጫኑ</span>
          </div>

          <div className="flex flex-wrap gap-1">
            {regionCategories[selectedRegion].map((sub) => {
              const isSubActive = selectedSubCategory === sub.id;
              return (
                <button
                  key={sub.id}
                  onClick={() => {
                    setSelectedSubCategory(sub.id);
                    // Open quote modal pre-configured for this category
                    onOpenQuoteModal('link');
                  }}
                  className={`py-1 px-2.5 rounded-lg text-[10px] font-bold flex items-center space-x-1 border transition-all active:scale-95 cursor-pointer shadow-2xs ${
                    isSubActive
                      ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                      : 'bg-stone-50 hover:bg-amber-50 border-stone-200/90 text-stone-800'
                  }`}
                >
                  <span className="text-xs">{sub.icon}</span>
                  <span className="font-extrabold">{sub.nameEn}</span>
                  <span className="text-[8px] text-stone-500 font-normal">({sub.nameAm})</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. SHELF CATEGORIES CHIPS */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold text-stone-800 flex items-center space-x-1">
            <ShoppingBag className="w-3.5 h-3.5 text-amber-600" />
            <span>{isWorker ? 'የመደርደሪያ እቃዎች አስተዳደር' : 'በአዲስ አበባ ዝግጁ የሆኑ እቃዎች (1-2 ቀን ማድረሻ)'}</span>
          </h3>
          <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
            {isWorker ? 'የሰራተኛ እይታ' : 'አሁን ዝግጁ'}
          </span>
        </div>

        <div className="flex space-x-1.5 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => onSelectCategory(cat.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 flex items-center space-x-1.5 transition-all active:scale-95 cursor-pointer ${
                  isSelected
                    ? 'bg-amber-500 text-stone-950 shadow-xs'
                    : 'bg-white text-stone-700 border border-stone-200 hover:bg-stone-50'
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.nameAm}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. PRODUCT CARDS: WORKERS CAN EDIT (NO ORDER), CUSTOMERS CAN ORDER (NO EDIT) */}
      {isLoading ? (
        <div className="p-8 text-center bg-white rounded-2xl border border-stone-200">
          <div className="w-6 h-6 border-2 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs text-stone-500">እቃዎች እየተጫኑ ነው...</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="p-6 text-center bg-white rounded-2xl border border-stone-200 space-y-2">
          <ShoppingBag className="w-8 h-8 text-stone-300 mx-auto" />
          <p className="text-xs font-bold text-stone-700">በዚህ ምድብ ዝግጁ እቃ አልተገኘም</p>
          {isWorker ? (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="py-2 px-4 rounded-xl bg-amber-500 text-stone-950 font-bold text-xs"
            >
              + አዲስ እቃ ጨምር
            </button>
          ) : (
            <button
              onClick={() => onOpenQuoteModal('link')}
              className="py-2 px-4 rounded-xl bg-amber-500 text-stone-950 font-bold text-xs"
            >
              በሊንክ እዘዝ (Custom Order)
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          {filteredProducts.map((p) => (
            <div
              key={p.id}
              className="bg-white rounded-2xl border border-stone-200 shadow-2xs overflow-hidden flex flex-col justify-between hover:shadow-xs transition-shadow"
            >
              {/* Product Photo */}
              <div className="relative aspect-square bg-stone-100 overflow-hidden">
                {p.photo_url ? (
                  <img
                    src={p.photo_url}
                    alt={p.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-stone-300">
                    <ShoppingBag className="w-8 h-8" />
                  </div>
                )}
                {p.is_bestseller && (
                  <span className="absolute top-1.5 left-1.5 bg-amber-500 text-stone-950 font-black text-[9px] px-2 py-0.5 rounded-md shadow-xs">
                    ተወዳጅ
                  </span>
                )}
                <span className="absolute bottom-1.5 right-1.5 bg-stone-900/80 backdrop-blur-xs text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md">
                  1-2 ቀን
                </span>
              </div>

              {/* Product Info */}
              <div className="p-2.5 space-y-1.5 flex flex-col justify-between flex-1">
                <div>
                  <h4 className="font-extrabold text-xs text-stone-900 line-clamp-2 leading-snug">
                    {p.name}
                  </h4>
                  {p.size && (
                    <p className="text-[10px] text-stone-500">መጠን: <b>{p.size}</b></p>
                  )}
                </div>

                <div className="space-y-1.5 pt-1 border-t border-stone-100">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs font-black text-amber-700">
                      {Number(p.price_etb).toLocaleString()} ETB
                    </span>
                    {!isWorker && (
                      <span className="text-[9px] text-stone-400">
                        40%: {Math.round(p.price_etb * 0.4).toLocaleString()}
                      </span>
                    )}
                  </div>

                  {/* ROLE SEPARATION ON ACTION BUTTONS: */}
                  {isWorker ? (
                    /* WORKER CONTROLS: EDIT & DELETE (NO ORDER BUTTON) */
                    <div className="grid grid-cols-2 gap-1 pt-0.5">
                      <button
                        onClick={() => {
                          setEditingProduct(p);
                          setEditName(p.name);
                          setEditPrice(String(p.price_etb));
                          setEditSize(p.size || 'Standard');
                        }}
                        className="py-1.5 px-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[11px] flex items-center justify-center space-x-1 cursor-pointer active:scale-95 transition-all"
                        title="ዋጋ እና መረጃ አስተካክል"
                      >
                        <Edit className="w-3 h-3 text-amber-700" />
                        <span>አስተካክል</span>
                      </button>

                      <button
                        onClick={() => handleDeleteProduct(p.id)}
                        className="py-1.5 px-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold text-[11px] flex items-center justify-center space-x-1 cursor-pointer active:scale-95 transition-all"
                        title="ከመደርደሪያ አጥፋ"
                      >
                        <Trash2 className="w-3 h-3 text-red-600" />
                        <span>አጥፋ</span>
                      </button>
                    </div>
                  ) : (
                    /* CUSTOMER CONTROLS: ORDER NOW (NO EDIT/DELETE) */
                    <button
                      onClick={() => {
                        setSelectedProductForOrder(p);
                        setConfirmedOrder(null);
                      }}
                      className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-stone-950 font-black text-xs flex items-center justify-center space-x-1 shadow-sm active:scale-95 transition-all cursor-pointer"
                    >
                      <ShoppingBag className="w-3.5 h-3.5 text-stone-950" />
                      <span>እዘዝ (Order Now)</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 5. WORKER MODAL: EDIT PRODUCT DRAWER */}
      {isWorker && editingProduct && (
        <div className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-4 space-y-3.5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-stone-100 pb-2">
              <h3 className="font-extrabold text-xs text-stone-900 flex items-center space-x-1.5">
                <Edit className="w-4 h-4 text-amber-600" />
                <span>የእቃ መረጃ አስተካክል (Edit Product)</span>
              </h3>
              <button
                onClick={() => setEditingProduct(null)}
                className="w-7 h-7 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProductEdit} className="space-y-2.5 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-stone-700 mb-0.5">የእቃው ስም</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl border border-stone-300 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-0.5">ዋጋ በብር (ETB)</label>
                  <input
                    type="number"
                    required
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl border border-stone-300 font-bold text-amber-700"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-0.5">መጠን / ሳይዝ</label>
                  <input
                    type="text"
                    value={editSize}
                    onChange={(e) => setEditSize(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl border border-stone-300 font-medium"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="flex-1 py-2 rounded-xl bg-stone-100 text-stone-700 font-bold"
                >
                  ሰርዝ
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black shadow-xs cursor-pointer"
                >
                  {isSavingEdit ? 'እየተቀየረ ነው...' : 'አስቀምጥ (Save)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. WORKER MODAL: ADD PRODUCT DRAWER */}
      {isWorker && isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-4 space-y-3.5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-stone-100 pb-2">
              <h3 className="font-extrabold text-xs text-stone-900 flex items-center space-x-1.5">
                <PlusCircle className="w-4 h-4 text-amber-600" />
                <span>አዲስ እቃ ወደ መደርደሪያ ጨምር (Add to Shelf)</span>
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="w-7 h-7 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddProduct} className="space-y-2.5 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-stone-700 mb-0.5">የእቃው ስም</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="ምሳሌ፡ የሴቶች ሐር ቀሚስ"
                  className="w-full px-3 py-1.5 rounded-xl border border-stone-300 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-0.5">ዋጋ በብር (ETB)</label>
                  <input
                    type="number"
                    required
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    placeholder="2800"
                    className="w-full px-3 py-1.5 rounded-xl border border-stone-300 font-bold text-amber-700"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-0.5">መጠን / ሳይዝ</label>
                  <input
                    type="text"
                    value={newSize}
                    onChange={(e) => setNewSize(e.target.value)}
                    placeholder="S, M, L..."
                    className="w-full px-3 py-1.5 rounded-xl border border-stone-300 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-700 mb-0.5">ምድብ (Category)</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl border border-stone-300 font-medium bg-stone-50"
                >
                  <option value="womens">👗 የሴቶች አልባሳት</option>
                  <option value="kids">🧸 የህጻናት ዕቃዎች</option>
                  <option value="beauty">💄 ውበትና ሜካፕ</option>
                  <option value="electronics">📱 ኤሌክትሮኒክስ</option>
                  <option value="home">🍳 የቤት መገልገያ</option>
                  <option value="miscellaneous">✨ ሌሎች</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-700 mb-0.5">የፎቶ ሊንክ (Image URL)</label>
                <input
                  type="url"
                  value={newPhotoUrl}
                  onChange={(e) => setNewPhotoUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full px-3 py-1.5 rounded-xl border border-stone-300 font-medium"
                />
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-2 rounded-xl bg-stone-100 text-stone-700 font-bold"
                >
                  ሰርዝ
                </button>
                <button
                  type="submit"
                  disabled={isAddingProduct}
                  className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black shadow-xs cursor-pointer"
                >
                  {isAddingProduct ? 'እየተጨመረ ነው...' : 'መደርደሪያ ላይ ጫን'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. CUSTOMER MODAL: DIRECT SHELF CHECKOUT (CUSTOMERS ONLY) */}
      {!isWorker && selectedProductForOrder && (
        <div className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-4 space-y-3.5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700">
                  <ShoppingBag className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-xs text-stone-900">
                    {confirmedOrder ? 'ትዕዛዝዎ ተረጋግጧል!' : 'የቀጥታ መደርደሪያ እቃ ማዘዣ'}
                  </h3>
                  <p className="text-[10px] text-stone-500">በ1-2 ቀን ውስጥ አዲስ አበባ ድረስ ይደርሳል</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedProductForOrder(null)}
                className="w-7 h-7 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {confirmedOrder ? (
              <div className="space-y-3 text-center py-2">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                <h4 className="font-black text-sm text-stone-900">
                  ትዕዛዝዎ በተሳካ ሁኔታ ተመዝግቧል!
                </h4>
                <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200 text-left text-xs space-y-1">
                  <p>🏷️ የትዕዛዝ ኮድ: <b className="font-mono text-amber-700">{confirmedOrder.orderCode}</b></p>
                  <p>📦 እቃ: <b>{selectedProductForOrder.name}</b></p>
                  <p>💰 ጠቅላላ ዋጋ: <b>{Number(selectedProductForOrder.price_etb).toLocaleString()} ETB</b></p>
                  <p>💳 40% ቅድመ ክፍያ: <b className="text-emerald-700">{Math.round(selectedProductForOrder.price_etb * 0.4).toLocaleString()} ETB</b></p>
                  <p className="text-[11px] text-stone-500 pt-1 border-t border-stone-200">
                    የ40% ቅድመ ክፍያውን በቴሌብር ወይም በንግድ ባንክ ያስገቡ። ሰራተኛችን ወዲያውኑ ያረጋግጥልዎታል።
                  </p>
                </div>

                <div className="pt-2 flex items-center space-x-2">
                  <button
                    onClick={() => {
                      setSelectedProductForOrder(null);
                      if (onShelfOrderCreated) {
                        onShelfOrderCreated(confirmedOrder.orderCode, checkoutPhone, true);
                      }
                    }}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-amber-500 text-stone-950 font-bold text-xs"
                  >
                    መልዕክቶችን ተከታተል
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleDirectShelfOrder} className="space-y-3">
                <div className="flex items-center space-x-3 p-2.5 rounded-2xl bg-stone-50 border border-stone-200">
                  {selectedProductForOrder.photo_url && (
                    <img
                      src={selectedProductForOrder.photo_url}
                      alt={selectedProductForOrder.name}
                      className="w-14 h-14 rounded-xl object-cover border border-stone-200 shrink-0"
                    />
                  )}
                  <div className="space-y-0.5 flex-1 min-w-0">
                    <h4 className="font-extrabold text-xs text-stone-900 truncate">
                      {selectedProductForOrder.name}
                    </h4>
                    {selectedProductForOrder.size && (
                      <p className="text-[10px] text-stone-500">መጠን: <b>{selectedProductForOrder.size}</b></p>
                    )}
                    <p className="text-xs font-black text-amber-700">
                      ጠቅላላ፡ {Number(selectedProductForOrder.price_etb).toLocaleString()} ETB
                    </p>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200/80 text-[11px] space-y-1">
                  <div className="flex justify-between text-stone-700">
                    <span>አሁን የሚከፈል (40% ቅድመ ክፍያ)፡</span>
                    <b className="text-amber-900 font-bold">{Math.round(selectedProductForOrder.price_etb * 0.4).toLocaleString()} ETB</b>
                  </div>
                  <div className="flex justify-between text-stone-500">
                    <span>ሲረከቡ የሚከፈል (60% በ1-2 ቀን)፡</span>
                    <span>{Math.round(selectedProductForOrder.price_etb * 0.6).toLocaleString()} ETB</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-stone-800 mb-1">
                    ስልክ ቁጥርዎን ያስገቡ (Phone Number) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={checkoutPhone}
                    onChange={(e) => setCheckoutPhone(e.target.value)}
                    placeholder="09**** / 07****"
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs font-bold focus:ring-2 focus:ring-amber-500 outline-hidden bg-stone-50/50"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-stone-800 mb-1">
                    የቅድመ ክፍያ ዘዴ ይምረጡ
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setCheckoutPaymentMethod('telebirr')}
                      className={`p-2 rounded-xl border text-left flex items-center space-x-2 transition-all ${
                        checkoutPaymentMethod === 'telebirr'
                          ? 'border-amber-500 bg-amber-50/80 ring-1 ring-amber-500'
                          : 'border-stone-200 bg-white'
                      }`}
                    >
                      <div className="w-6 h-6 rounded-lg bg-amber-500 text-stone-950 font-black text-xs flex items-center justify-center">
                        T
                      </div>
                      <div>
                        <p className="text-[11px] font-bold text-stone-900">ቴሌብር</p>
                        <p className="text-[9px] text-stone-500">Telebirr</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCheckoutPaymentMethod('cbe_birr')}
                      className={`p-2 rounded-xl border text-left flex items-center space-x-2 transition-all ${
                        checkoutPaymentMethod === 'cbe_birr'
                          ? 'border-purple-500 bg-purple-50/80 ring-1 ring-purple-500'
                          : 'border-stone-200 bg-white'
                      }`}
                    >
                      <div className="w-6 h-6 rounded-lg bg-purple-600 text-white font-black text-xs flex items-center justify-center">
                        C
                      </div>
                      <div>
                        <p className="text-[11px] font-bold text-stone-900">ንግድ ባንክ</p>
                        <p className="text-[9px] text-stone-500">CBE / CBE Birr</p>
                      </div>
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingOrder}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-stone-950 font-black text-xs flex items-center justify-center space-x-1.5 shadow-md shadow-amber-500/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                >
                  <ShoppingBag className="w-4 h-4 text-stone-950" />
                  <span>{isSubmittingOrder ? 'እየተመዘገበ ነው...' : 'አሁን እዘዝ (Confirm Order)'}</span>
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default StorefrontHome;
