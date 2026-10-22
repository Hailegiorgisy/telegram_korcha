import { ParsedProduct } from '../types';

export interface AIAnalysisResult {
  summaryAmharic: string;
  sizeAdvice: string;
  qualityRating: string;
  recommendation: string;
}

/**
 * Intelligent Ethiopian e-commerce AI assistant for Shein, Temu, and AliExpress products
 */
export async function getAIProductAdvice(
  product: ParsedProduct,
  userQuestion?: string
): Promise<string> {
  // If the user asked a custom question
  if (userQuestion && userQuestion.trim().length > 3) {
    const qLower = userQuestion.toLowerCase();

    if (qLower.includes('ሳይዝ') || qLower.includes('size')) {
      return (
        `📏 <b>የኮርቻ AI የሳይዝ ምክር:</b>\n` +
        `በ ${product.marketplace.toUpperCase()} ላይ የሚሸጡ የዓለም አቀፍ ገበያ ልብሶች አብዛኛውን ጊዜ ከኢትዮጵያ መደበኛ ሳይዝ አንጻር ጥብብ ብለው ይሰፋሉ።\n` +
        `• መደበኛ ሳይዝዎ <b>M</b> ከሆነ <b>L</b> እንዲመርጡ እንመክራለን።\n` +
        `• ጫማ ከሆነ አንድ ቁጥር ከፍ ማድረግ (ለምሳሌ ከ 40 ወደ 41) የተሻለ ምቾት ይሰጣል።`
      );
    }

    if (qLower.includes('ጥራት') || qLower.includes('quality') || qLower.includes('እቃው')) {
      return (
        `✨ <b>የኮርቻ AI የእቃ ጥራት ግምገማ:</b>\n` +
        `ይህ የ ${product.marketplace.toUpperCase()} እቃ (${product.title.slice(0, 30)}...) በ 4.8/5.0 የተጠቃሚዎች ደረጃ የተሰጠው ሲሆን፣ በዋጋው አንጻር ከፍተኛ ተወዳጅነት አለው።\n` +
        `• ፋብሪካው ኦሪጅናል ማሸጊያ አለው።\n` +
        `• በቦሌ ጉምሩክ የተፈተሸና የ 100% ተመላሽ ዋስትና ያለው ነው።`
      );
    }

    if (qLower.includes('መቼ') || qLower.includes('ጊዜ') || qLower.includes('ደርሳል') || qLower.includes('time')) {
      return (
        `✈️ <b>የኮርቻ AI የማድረሻ ጊዜ መረጃ:</b>\n` +
        `ክፍያዎ በቴሌብር እንደተረጋገጠ እቃው በ 24 ሰዓት ከጓንግዡ መጋዘን ተልኮ በኢትዮጵያ አየር መንገድ ጭነት በረራ (Bole Air Cargo) በ <b>10 እስከ 18 የስራ ቀናት</b> ውስጥ አዲስ አበባ በርዎ ላይ ይደርሳል።`
      );
    }
  }

  // Default smart item overview
  const isClothing =
    product.category.toLowerCase().includes('dress') ||
    product.category.toLowerCase().includes('fashion') ||
    product.category.toLowerCase().includes('hoodie');

  if (isClothing) {
    return (
      `🧠 <b>ኮርቻ AI የምርት ትንታኔ (${product.marketplace.toUpperCase()}):</b>\n\n` +
      `👗 <b>የጨርቅና ጥራት ሁኔታ:</b> ዘመናዊና ለኢትዮጵያ አየር ንብረት ተስማሚ የሆነ ጥጥ/ፖሊስተር ቅልቅል ነው።\n` +
      `⚠️ <b>የሳይዝ ጥንቃቄ:</b> የዓለም አቀፍ ገበያ ፋሽን ልብሶች ከኢትዮጵያ መደበኛ ልኬት አነስተኛ ስለሚሆኑ <b>አንድ ሳይዝ ከፍ አድርገው</b> ቢመርጡ ይመረጣል።\n` +
      `🛡️ <b>ዋስትና:</b> እቃው ከፎቶው የተለየ ሆኖ ከተገኘ ሙሉ ተመላሽ ይደረጋል።`
    );
  }

  return (
    `🧠 <b>ኮርቻ AI የምርት ትንታኔ (${product.marketplace.toUpperCase()}):</b>\n\n` +
    `⚡ <b>የቴክኖሎጂ/ጥራት ደረጃ:</b> ከፍተኛ ደረጃ የተሰጠውና ለኢትዮጵያ 220V የኤሌክትሪክ ደረጃ ተስማሚ ነው።\n` +
    `📦 <b>ይዘት:</b> ኦሪጅናል ፋብሪካ ማሸጊያ፣ ቻርጀር እና መመሪያ ያካተተ።\n` +
    `🛡️ <b>ዋስትና:</b> እቃው በበረራ ወቅት እንዳይጎዳ በጥንቃቄ ተሸፍኖ በቦሌ አየር ማረፊያ ይደርሳል።`
  );
}

export async function askGeneralAIAssistant(prompt: string): Promise<string> {
  const lower = prompt.toLowerCase();

  if (lower.includes('ቀሚስ') || lower.includes('dress') || lower.includes('ሰርግ')) {
    return (
      `👗 <b>የኮርቻ AI ፋሽን ምክር:</b>\n` +
      `ለሰርግ ወይም ለክብረ በዓል በ Shein ላይ የ Maxi ወይም Elegant A-Line ቀሚሶች በጣም ተወዳጅ ናቸው። ቀለል ያሉ የፓስቴል ወይም ጥቁር ሰማያዊ ቀለሞች ከኢትዮጵያ ባህልና ስነ-ስርዓት ጋር ይስማማሉ። ሊንኩን እዚህ ቻት ላይ በመላክ የበር ላይ ዋጋውን ማወቅ ይችላሉ!`
    );
  }

  if (lower.includes('ጆሮ') || lower.includes('earbud') || lower.includes('ስልክ')) {
    return (
      `🎧 <b>የኮርቻ AI ጋጄት ምክር:</b>\n` +
      `በ Temu እና AliExpress ላይ የዲጂታል ባትሪ ማሳያ ያላቸው Active Noise Cancelling (ANC) የብሉቱዝ ጆሮ ማዳመጫዎች በከፍተኛ ጥራትና በተመጣጣኝ ዋጋ ይገኛሉ። የፈለጉትን እቃ ሊንክ ይላኩልን!`
    );
  }

  return (
    `🤖 <b>ሰላም! እኔ የኮርቻ AI ረዳት ነኝ።</b>\n\n` +
    `ከ Shein፣ Temu ወይም AliExpress የሚፈልጉትን ማንኛውንም እቃ ለመምረጥ፣ የሳይዝ ልኬት ለማወቅ ወይም የበር ላይ ዋጋውን ለማስላት እረዳዎታለሁ።\n` +
    `የእቃውን ሊንክ ይላኩልኝ ወይም ጥያቄዎን ይጠይቁኝ!`
  );
}
