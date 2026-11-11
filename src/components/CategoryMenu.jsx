import React from 'react';
import { CATEGORIES } from '../data/categories';

export default function CategoryMenu({ activeCategory, onSelectCategory, lang = 'am' }) {
  const handleSelect = (categoryId) => {
    // Trigger native Telegram Mini App tactile feedback
    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
    }
    onSelectCategory(categoryId);
  };

  return (
    <nav className="w-full py-3 bg-[var(--tg-theme-bg-color,#ffffff)] border-b border-gray-100 dark:border-gray-800">
      <div className="flex gap-2.5 overflow-x-auto px-4 no-scrollbar scroll-smooth">
        {CATEGORIES.map((cat) => {
          const isSelected = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => handleSelect(cat.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-150 ${
                isSelected
                  ? 'bg-[var(--tg-theme-button-color,#2481cc)] text-[var(--tg-theme-button-text-color,#ffffff)] shadow-sm scale-[0.98]'
                  : 'bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] text-[var(--tg-theme-text-color,#18181b)] hover:bg-gray-200'
              }`}
            >
              <span className="text-sm">{cat.icon}</span>
              <span>{lang === 'am' ? cat.nameAm : cat.nameEn}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}