// bot.js: Standalone Showcase Bot & Mini App Server
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { Telegraf, Markup } from 'telegraf';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BOT_TOKEN = process.env.CATALOG_BOT_TOKEN || process.env.BOT_TOKEN;
const PORT = process.env.PORT || 3002;
const WEBAPP_URL = process.env.WEBAPP_URL || '';
const SELLER_USERNAME = process.env.SELLER_USERNAME || 'Hailegiorgisy';

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Category Data with Descriptive Photos & ETB Pricing
export const CATEGORY_ITEMS = {
  inflight: {
    title: '👟 Inflight Shoes (የበረራ ጫማዎች)',
    desc: 'ለበረራ፣ ለሆቴል እና ለረጅም ጉዞ እጅግ ምቹ፣ የሚታጠፉና ቀላል ጫማዎች (Foldable Flight Travel Slippers & Breathable Memory Foam Slip-ons)።',
    items: [
      {
        id: 'inf-1',
        name: 'Aerolite Foldable Inflight Memory Foam Slippers',
        price_etb: 2950,
        photos: [
          'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=600&auto=format&fit=crop&q=80'
        ],
        details: '100% Breathable Mesh, የማይንሸራተት ጫማ፣ ከኪስ ቦርሳ ጋር የሚታጠፍ።'
      },
      {
        id: 'inf-2',
        name: 'CloudWalk Slip-on Cabin Comfort Loafers',
        price_etb: 3800,
        photos: [
          'https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?w=600&auto=format&fit=crop&q=80'
        ],
        details: 'ለረጅም በረራ እግር እንዳያብጥ የሚረዳ ለስላሳ የውስጥ ሶል ያለው።'
      },
      {
        id: 'inf-3',
        name: 'FlightEase Anti-Fatigue Air Cushion Travel Moccasins',
        price_etb: 3450,
        photos: [
          'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=600&auto=format&fit=crop&q=80'
        ],
        details: 'በበረራ ውስጥ የደም ዝውውርን የሚያቀላጥፍ፣ ተጣጣፊና እጅግ ለስላሳ የአየር ከረጢት ሶል ያለው የጉዞ ጫማ።'
      }
    ]
  },
  children: {
    title: '👗 Children Clothes (የህፃናት ልብሶች)',
    desc: 'ከውጭ ሀገር የመጡ 100% ኦርጋኒክ ጥጥ የህፃናት አልባሳት (Two-Piece Loungewear Sets & Seasonal Wear)።',
    items: [
      {
        id: 'ch-1',
        name: 'Organic Cotton Two-Piece Cozy Loungewear Set',
        price_etb: 2450,
        photos: [
          'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=600&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?w=600&auto=format&fit=crop&q=80'
        ],
        details: 'ለስላሳ፣ ቆዳ የማያሳክክ እና በማሽን የሚታጠብ የኮሪያ ዲዛይን ጥጥ።'
      },
      {
        id: 'ch-2',
        name: 'Warm Hooded Windbreaker & Fleece Jacket',
        price_etb: 3200,
        photos: [
          'https://images.unsplash.com/photo-1622290291468-a28f7a7dc6a8?w=600&auto=format&fit=crop&q=80'
        ],
        details: 'ብርድ መከላከያ ውሃ የማያሳልፍ ቆንጆ ጃኬት (ከ2-6 አመት)።'
      },
      {
        id: 'ch-3',
        name: 'Pastel Knitted Cotton Cardigan & Trouser 2-Piece Set',
        price_etb: 2850,
        photos: [
          'https://images.unsplash.com/photo-1514090458221-65bb69cf63e6?w=600&auto=format&fit=crop&q=80'
        ],
        details: 'ለስላሳ የተሸመነ ጥጥ፣ ለልጆች ነፃ እንቅስቃሴ ምቹ የሆነ፣ ለፎቶ እና ለበዓል ተወዳጅ የህፃናት ልብስ።'
      }
    ]
  },
  others: {
    title: '📦 Others (ሌሎች እቃዎች)',
    desc: 'ጠቃሚ የጉዞና የቤት እቃዎች፣ የቦርሳ ማደራጃዎችና ተፈላጊ መገልገያዎች።',
    items: [
      {
        id: 'oth-1',
        name: 'Vacuum Compression Travel Packing Cubes (6-Pack)',
        price_etb: 1950,
        photos: [
          'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&auto=format&fit=crop&q=80'
        ],
        details: 'በሻንጣ ውስጥ 60% ቦታ የሚቆጥብ ዘመናዊ የልብስ ማደራጃ።'
      },
      {
        id: 'oth-2',
        name: 'Stainless Insulated Temperature Display Bottle (500ml)',
        price_etb: 1650,
        photos: [
          'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=600&auto=format&fit=crop&q=80'
        ],
        details: 'የሙቀት መጠን በዲጂታል ንክኪ የሚያሳይ ጠንካራ ቴርሞስ።'
      },
      {
        id: 'oth-3',
        name: '360° Ergonomic Memory Foam Travel Neck Pillow & Eye Mask Set',
        price_etb: 2150,
        photos: [
          'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?w=600&auto=format&fit=crop&q=80'
        ],
        details: 'በበረራ እና በመኪና ጉዞ አንገት እንዳይዝል ሙሉ ድጋፍ የሚሰጥ፣ የሚታጠብ ለስላሳ ሽፋን ያለው ተወዳጅ የጉዞ ትራስ።'
      }
    ]
  }
};

// Formatted Ad Message matching user screenshot format
const getAdMessage = () => {
  return `✅ **የተመረጡ እቃዎች ማስታወቂያ | ኮርቻ**\n\n` +
    `❄️ **ኮድ**: \`KC-8820\`\n\n` +
    `✨ **አይነት**: ፕሪሚየም የበረራ ጫማዎችና የህፃናት ልብሶች\n` +
    `✨ **መገኛ**: አዲስ አበባ (በእጃችን ያሉ)\n` +
    `✨ **ማድረሻ**: ፈጣን የቤት ለቤት አቅርቦት\n` +
    `✨ **ጥራት**: 100% ኦሪጅናል ከውጭ ሀገር\n\n` +
    `**Exclusive Inflight & Kids Collections — Direct Import**\n\n` +
    `ከታች ያሉትን 3 አማራጮች በመጫን ፎቶዎችንና ዋጋዎችን ይመልከቱ:`;
};

// 3 Horizontal Bars Inline Keyboard matching user screenshot
const get3BarKeyboard = () => {
  const buttons = [];

  if (WEBAPP_URL) {
    buttons.push([Markup.button.webApp('👟 Inflight shoes (የበረራ ጫማዎች)', `${WEBAPP_URL}?cat=inflight`)]);
    buttons.push([Markup.button.webApp('👗 Children clothes (የህፃናት ልብሶች)', `${WEBAPP_URL}?cat=children`)]);
    buttons.push([Markup.button.webApp('📦 Others (ሌሎች እቃዎች)', `${WEBAPP_URL}?cat=others`)]);
  } else {
    buttons.push([Markup.button.callback('👟 Inflight shoes (የበረራ ጫማዎች)', 'cat_inflight')]);
    buttons.push([Markup.button.callback('👗 Children clothes (የህፃናት ልብሶች)', 'cat_children')]);
    buttons.push([Markup.button.callback('📦 Others (ሌሎች እቃዎች)', 'cat_others')]);
  }

  return Markup.inlineKeyboard(buttons);
};

// Fallback index route for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (BOT_TOKEN) {
  const bot = new Telegraf(BOT_TOKEN);

  bot.command('start', async (ctx) => {
    try {
      await ctx.replyWithPhoto(
        'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&auto=format&fit=crop&q=80',
        {
          caption: getAdMessage(),
          parse_mode: 'Markdown',
          ...get3BarKeyboard()
        }
      );
    } catch (err) {
      console.error('Error sending start ad with photo:', err);
      ctx.reply(getAdMessage(), { parse_mode: 'Markdown', ...get3BarKeyboard() });
    }
  });

  const handleCatCallback = async (ctx, key) => {
    await ctx.answerCbQuery();
    const cat = CATEGORY_ITEMS[key];
    if (!cat) return;

    let text = `📂 *${cat.title}*\n\n${cat.desc}\n\n`;
    cat.items.forEach((item, idx) => {
      text += `*${idx + 1}. ${item.name}*\n💰 ዋጋ: *${item.price_etb.toLocaleString()} ETB*\nℹ️ ${item.details}\n\n`;
    });
    text += `👉 ማዘዝ ከፈለጉ: @${SELLER_USERNAME}`;

    const navButtons = [
      [Markup.button.callback('‹ ወደ ዋናው ማስታወቂያ ተመለስ', 'back_to_ad')],
      [Markup.button.url('💬 ሰራተኛ ያነጋግሩ (እዘዝ)', `https://t.me/${SELLER_USERNAME}`)]
    ];

    if (cat.items[0]?.photos[0]) {
      await ctx.replyWithPhoto(cat.items[0].photos[0], {
        caption: text,
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(navButtons)
      });
    } else {
      await ctx.reply(text, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(navButtons) });
    }
  };

  bot.action('cat_inflight', (ctx) => handleCatCallback(ctx, 'inflight'));
  bot.action('cat_children', (ctx) => handleCatCallback(ctx, 'children'));
  bot.action('cat_others', (ctx) => handleCatCallback(ctx, 'others'));

  bot.action('back_to_ad', async (ctx) => {
    await ctx.answerCbQuery();
    try {
      await ctx.editMessageCaption(getAdMessage(), {
        parse_mode: 'Markdown',
        ...get3BarKeyboard()
      });
    } catch (e) {
      ctx.reply(getAdMessage(), { parse_mode: 'Markdown', ...get3BarKeyboard() });
    }
  });

  bot.launch().then(() => {
    console.log('Standalone Catalog Bot successfully started!');
  }).catch((err) => {
    console.error('Bot launch error (check CATALOG_BOT_TOKEN):', err.message);
  });
} else {
  console.log('CATALOG_BOT_TOKEN not set. Running standalone WebApp server only.');
}

app.listen(PORT, () => {
  console.log(`Standalone Catalog WebApp server running on port ${PORT}`);
});
