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
import { SHELF_CATEGORIES, INITIAL_BESTSELLERS, CategoryDefinition, ProductItem } from '../data/categories';

interface StorefrontHomeProps {
  onOpenQuoteModal: (mode?: 'link' | 'screenshot', preferredPayment?: 'telebirr' | 'cbe_birr') => void;
  selectedCategory: string;
  onSelectCategory: (id: string) => void;
}

export const StorefrontHome: React.FC<StorefrontHomeProps> = ({
  onOpenQuoteModal,
  selectedCategory,
  onSelectCategory,
}) => {
  const [activeCatId, setActiveCatId] = useState<string>(selectedCategory && selectedCategory !== 'all' ? selectedCategory : 'womens');
  const [shelfProducts, setShelfProducts] = useState<any[]>(INITIAL_BESTSELLERS);
  const [bestSellers, setBestSellers] = useState<any[]>(INITIAL_BESTSELLERS);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Buy Flow Modal State
  const [selectedBuyProduct, setSelectedBuyProduct] = useState<any | null>(null);

  // Worker Shelf Editor State (korcha_support)
  const [isWorkerMode, setIsWorkerMode] = useState<boolean>(false);
  const [isEditorOpen, setIsEditorOpen] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [editorForm, setEditorForm] = useState({
    name: '',
    size: '',
    priceEtb: '',
    photoUrl: '',
    categoryId: 'womens',
    isBestseller: false,
  });
  const [isSavingProduct, setIsSavingProduct] = useState<boolean>(false);
  const [editorNotification, setEditorNotification] = useState<string | null>(null);

  const workerUsername = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_WORKER_TELEGRAM_USERNAME) 
    || 'korcha_support';
  const supportUrl = `https://t.me/${workerUsername}`;

  // Check if current user is worker or enable worker mode if username is korcha_support
  useEffect(() => {
    const tmaUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
    if (tmaUser?.username && tmaUser.username.toLowerCase() === workerUsername.toLowerCase()) {
      setIsWorkerMode(true);
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

  const currentCategory = SHELF_CATEGORIES.find(c => c.id === activeCatId) || SHELF_CATEGORIES[0];
  const categoryProducts = shelfProducts.filter(p => (p.category_id || p.categoryId) === activeCatId);

  // Trigger "Buy" / "ግዛ" for a product
  const handleBuyClick = (product: any) => {
    setSelectedBuyProduct(product);
  };

  // Open Editor for adding or editing
  const handleOpenAddProduct = () => {
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
    setEditingProduct(prod);
    setEditorForm({
      name: prod.name || prod.title || '',
      size: prod.size || '',
      priceEtb: String(prod.price_etb || prod.priceEtb || ''),
      photoUrl: prod.photo_url || prod.photoUrl || prod.image || '',
      categoryId: prod.category_id || prod.categoryId || 'womens',
      isBestseller: Boolean(prod.is_bestseller || prod.isBestseller),
    });
    setEditorNotification(null);
    setIsEditorOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editorForm.name.trim() || !editorForm.priceEtb || !editorForm.photoUrl.trim()) {
      alert('እባክዎ የስም፣ የዋጋ እና የፎቶ ሊንክ ያስገቡ');
      return;
    }

    try {
      setIsSavingProduct(true);
      if (editingProduct) {
        // PUT update
        const res = await fetch(`/api/shelf/${editingProduct.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: editorForm.name.trim(),
            size: editorForm.size.trim() || null,
            priceEtb: parseFloat(editorForm.priceEtb),
            photoUrl: editorForm.photoUrl.trim(),
            categoryId: editorForm.categoryId,
            isBestseller: editorForm.isBestseller,
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
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: editorForm.name.trim(),
            size: editorForm.size.trim() || null,
            priceEtb: parseFloat(editorForm.priceEtb),
            photoUrl: editorForm.photoUrl.trim(),
            categoryId: editorForm.categoryId,
            isBestseller: editorForm.isBestseller,
            createdBy: 'korcha_support',
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
    if (!confirm('ይህንን እቃ ከ Shelf ላይ ማጥፋት ይፈልጋሉ?')) return;
    try {
      const res = await fetch(`/api/shelf/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setShelfProducts(prev => prev.filter(p => p.id !== id));
        setBestSellers(prev => prev.filter(p => p.id !== id));
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
    <div className="space-y-4 pb-12 animate-fade-in max-w-md mx-auto">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-stone-950 via-stone-900 to-amber-950 text-white p-5 shadow-xl border border-stone-800">
        <div className="relative z-10 space-y-3">
          <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 text-[11px] font-semibold border border-amber-500/30">
            <Sparkles className="w-3.5 h-3.5" />
            <span>ቀጥታ ከዓለም አቀፍ ገበያዎች ወደ ኢትዮጵያ</span>
          </div>

          <h2 className="text-xl font-extrabold leading-tight">
            የፈለጉትን እቃ ይምረጡ፣ <br />
            እኛ በርዎ ድረስ እናደርሳለን!
          </h2>

          <p className="text-xs text-stone-300 leading-relaxed">
            ከ Shein, Amazon ወይም AliExpress የመረጡትን እቃ ሊንክ ወይም ስክሪንሾት ያስገቡ። ሰራተኞቻችን ወጪውን አስልተው ያቀርቡልዎታል።
          </p>

          {/* Primary Action Buttons */}
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <button
              onClick={() => onOpenQuoteModal('link')}
              className="py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs flex items-center justify-center space-x-2 shadow-lg shadow-amber-500/25 active:scale-95 transition-all cursor-pointer"
            >
              <LinkIcon className="w-4 h-4" />
              <span>ሊንክ ያስገቡ</span>
            </button>

            <button
              onClick={() => onOpenQuoteModal('screenshot')}
              className="py-3 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center justify-center space-x-2 border border-white/15 active:scale-95 transition-all cursor-pointer"
            >
              <Camera className="w-4 h-4 text-amber-400" />
              <span>ስክሪንሾት ላክ</span>
            </button>
          </div>
        </div>

        <div className="absolute -top-12 -right-12 w-48 h-48 bg-amber-600/20 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* ADVERTISEMENT BANNER: Telebirr & CBE Birr Payment Options (Not in menu) */}
      <div className="rounded-3xl bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border border-amber-300/60 p-4 space-y-3 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="w-7 h-7 rounded-xl bg-amber-600 text-white flex items-center justify-center font-black text-xs shadow-xs">
              ETB
            </span>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-md inline-block mb-0.5">
                📢 ማስታወቂያ (Payment Advertisement)
              </span>
              <h3 className="font-extrabold text-xs text-stone-900 leading-tight">
                በ Telebirr ወይም CBE Birr ይክፈሉ!
              </h3>
              <p className="text-[10px] text-amber-800 font-semibold">
                የውጭ ምንዛሪ ወይም ቪዛ ካርድ አያስፈልግዎትም • 100% በብር
              </p>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-200">
            0% Forex Fee
          </span>
        </div>

        {/* Dual Marketing Payment Advertisement Cards */}
        <div className="grid grid-cols-2 gap-2">
          {/* Telebirr Ad Card */}
          <div className="p-3 rounded-2xl bg-white border border-amber-200/80 shadow-2xs text-left">
            <div className="flex items-center justify-between mb-1.5">
              <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 font-black text-[10px]">
                ቴሌብር (Telebirr)
              </span>
              <Zap className="w-3.5 h-3.5 text-amber-600" />
            </div>
            <p className="font-bold text-xs text-stone-900">Telebirr Instant</p>
            <p className="text-[10px] text-stone-500 mt-0.5">ቅጽበታዊ ማረጋገጫ • 40% ቅድመ ክፍያ</p>
          </div>

          {/* CBE Birr Ad Card */}
          <div className="p-3 rounded-2xl bg-white border border-purple-200/80 shadow-2xs text-left">
            <div className="flex items-center justify-between mb-1.5">
              <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-900 font-black text-[10px]">
                CBE Birr (ንግድ ባንክ)
              </span>
              <CreditCard className="w-3.5 h-3.5 text-purple-600" />
            </div>
            <p className="font-bold text-xs text-stone-900">CBE Birr / CBE</p>
            <p className="text-[10px] text-stone-500 mt-0.5">በኢትዮጵያ ንግድ ባንክ • ደህንነቱ የተጠበቀ</p>
          </div>
        </div>

        {/* Marketing Feature Bullets */}
        <div className="grid grid-cols-3 gap-1 pt-1 text-center border-t border-amber-200/50">
          <div className="text-[9px] text-stone-600 font-semibold flex items-center justify-center space-x-1">
            <Check className="w-3 h-3 text-emerald-600" />
            <span>40% ቅድመ ክፍያ</span>
          </div>
          <div className="text-[9px] text-stone-600 font-semibold flex items-center justify-center space-x-1">
            <Check className="w-3 h-3 text-emerald-600" />
            <span>60% ሲረከቡ (COD)</span>
          </div>
          <div className="text-[9px] text-stone-600 font-semibold flex items-center justify-center space-x-1">
            <Check className="w-3 h-3 text-emerald-600" />
            <span>ቀጥታ ደረሰኝ</span>
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
            const photo = item.photo_url || item.photoUrl || item.image;
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
                    alt={name}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
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

                  {/* Actions: Buy / Edit (if worker) */}
                  <div className="pt-1 flex items-center space-x-1.5">
                    <button
                      onClick={() => handleBuyClick(item)}
                      className="flex-1 py-1.5 px-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-[11px] shadow-xs active:scale-95 transition-all cursor-pointer flex items-center justify-center space-x-1"
                    >
                      <ShoppingBag className="w-3 h-3" />
                      <span>ግዛ (Buy)</span>
                    </button>

                    {isWorkerMode && (
                      <button
                        onClick={() => handleOpenEditProduct(item)}
                        className="p-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 transition-colors"
                        title="አስተካክል"
                      >
                        <Edit2 className="w-3 h-3" />
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

          {/* Worker Shelf Control Button (korcha_support) */}
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setIsWorkerMode(!isWorkerMode)}
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all ${
                isWorkerMode 
                  ? 'bg-amber-600 text-white' 
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
              title="የሰራተኛ ማስተካከያ ሁኔታ"
            >
              🛠 {isWorkerMode ? 'Worker Active' : 'ሰራተኛ'}
            </button>
            {isWorkerMode && (
              <button
                onClick={handleOpenAddProduct}
                className="px-2 py-0.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold flex items-center space-x-0.5 shadow-2xs"
              >
                <Plus className="w-3 h-3" />
                <span>አዲስ እቃ</span>
              </button>
            )}
          </div>
        </div>

        {/* Compact 6-Category Grid with Smaller Features */}
        <div className="grid grid-cols-3 gap-1.5">
          {SHELF_CATEGORIES.map((cat) => {
            const isSelected = cat.id === activeCatId;
            const count = shelfProducts.filter(p => (p.category_id || p.categoryId) === cat.id).length;

            return (
              <button
                key={cat.id}
                onClick={() => handleCategoryClick(cat.id)}
                className={`py-2 px-1.5 rounded-xl border text-center transition-all cursor-pointer relative flex flex-col items-center justify-center min-h-[64px] ${
                  isSelected
                    ? 'border-amber-600 bg-amber-500/10 shadow-xs ring-1 ring-amber-500 text-amber-950'
                    : 'border-stone-200/80 bg-white hover:bg-stone-50 shadow-2xs text-stone-800'
                }`}
              >
                <span className="text-base mb-0.5">{cat.icon}</span>
                <p className={`font-bold text-[10px] leading-tight line-clamp-1 ${isSelected ? 'text-amber-900 font-extrabold' : 'text-stone-800'}`}>
                  {cat.nameAm}
                </p>
                <span className="text-[8px] text-stone-400 line-clamp-1">{cat.nameEn}</span>
                {count > 0 && (
                  <span className="mt-0.5 px-1 rounded-full bg-amber-100 text-amber-900 text-[8px] font-bold">
                    {count}
                  </span>
                )}
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
                    const photo = prod.photo_url || prod.photoUrl || prod.image;
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
                          <button
                            onClick={() => handleBuyClick(prod)}
                            className="flex-1 py-1.5 px-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-[11px] shadow-xs active:scale-95 transition-all cursor-pointer flex items-center justify-center space-x-1"
                          >
                            <ShoppingBag className="w-3 h-3" />
                            <span>ግዛ (Buy)</span>
                          </button>

                          {isWorkerMode && (
                            <div className="flex space-x-0.5">
                              <button
                                onClick={() => handleOpenEditProduct(prod)}
                                className="p-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700"
                                title="አስተካክል"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => handleDeleteProduct(prod.id)}
                                className="p-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600"
                                title="አጥፋ"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
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

      {/* BUY MODAL: Direct contact with worker (@korcha_support) to pay and buy */}
      {selectedBuyProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-2xl border border-stone-200 relative animate-scale-up">
            <button
              onClick={() => setSelectedBuyProduct(null)}
              className="absolute top-4 right-4 p-1 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-500 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center space-x-3">
              <img 
                src={selectedBuyProduct.photo_url || selectedBuyProduct.photoUrl || selectedBuyProduct.image} 
                alt={selectedBuyProduct.name || selectedBuyProduct.title}
                className="w-16 h-16 rounded-2xl object-cover border border-stone-200"
              />
              <div>
                <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 font-bold text-[10px]">
                  ግዢ ለማረጋገጥ (Instant Buy)
                </span>
                <h3 className="font-extrabold text-sm text-stone-900 mt-1 line-clamp-1">
                  {selectedBuyProduct.name || selectedBuyProduct.title}
                </h3>
                <p className="font-black text-amber-700 text-sm">
                  {Number(selectedBuyProduct.price_etb || selectedBuyProduct.priceEtb).toLocaleString()} ETB
                </p>
                {selectedBuyProduct.size && (
                  <p className="text-[10px] text-stone-500">መጠን (Size): {selectedBuyProduct.size}</p>
                )}
              </div>
            </div>

            {/* Payment & Purchase Options */}
            <div className="p-3 rounded-2xl bg-stone-50 border border-stone-200 space-y-2 text-xs text-stone-700">
              <div className="flex items-center justify-between font-bold text-stone-900 text-[11px]">
                <span>የክፍያ አማራጭ:</span>
                <span className="text-amber-800">Telebirr ወይም CBE Birr</span>
              </div>
              <ul className="text-[10px] text-stone-600 space-y-1 list-disc list-inside">
                <li>40% ቅድመ ክፍያ (Advance payment)</li>
                <li>60% እቃው ኢትዮጵያ ሲገባ ወይም በርዎ ሲደርስ</li>
                <li>የውጭ ምንዛሪ ወይም የባንክ ቪዛ ካርድ አያስፈልግዎትም</li>
              </ul>
            </div>

            {/* Direct Contact with Worker Button */}
            <div className="space-y-2 pt-1">
              <a
                href={getTelegramBuyUrl(selectedBuyProduct)}
                target="_blank"
                rel="noreferrer"
                className="w-full py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-xs flex items-center justify-center space-x-2 shadow-lg shadow-amber-600/30 active:scale-95 transition-all text-center"
              >
                <MessageCircle className="w-4 h-4" />
                <span>ከሰራተኛ ጋር አውራ (@{workerUsername})</span>
              </a>

              <button
                onClick={() => {
                  setSelectedBuyProduct(null);
                  onOpenQuoteModal('link');
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-xs flex items-center justify-center space-x-1.5 transition-colors"
              >
                <span>የትዕዛዝ ቅጽ ይሙሉ</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. WORKER SHELF EDITOR MODAL (korcha_support) */}
      {isEditorOpen && (
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
                  {SHELF_CATEGORIES.map(cat => (
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
                <label className="block font-bold text-stone-700 mb-1">የፎቶ ሊንክ (Photo URL)</label>
                <input
                  type="url"
                  required
                  placeholder="https://images.unsplash.com/..."
                  value={editorForm.photoUrl}
                  onChange={(e) => setEditorForm({ ...editorForm, photoUrl: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 focus:ring-2 focus:ring-amber-500 outline-hidden font-medium"
                />
                {editorForm.photoUrl && (
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
    </div>
  );
};

export default StorefrontHome;
