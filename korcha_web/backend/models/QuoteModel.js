// backend/models/QuoteModel.js

const quotes = [];

export const QuoteModel = {
  create({
    ticketId,
    marketplace = "shein",
    sourceUrl,
    screenshotName,
    screenshotUrl,
    title = "Marketplace Item",
    imageUrl,
    workerHelper,
    customerMessage = "ዋጋውን በ5 ደቂቃ ውስጥ አስልተን እናሳውቅዎታለን",
    workerLink,
  }) {
    const id = ticketId || "KORCHA-" + Math.floor(100000 + Math.random() * 900000);
    const newQuote = {
      ticketId: id,
      quoteId: id,
      marketplace,
      sourceUrl: sourceUrl || undefined,
      screenshotName: screenshotName || undefined,
      screenshotUrl: screenshotUrl || undefined,
      title,
      imageUrl: imageUrl || undefined,
      status: "pending_worker_estimation",
      customerMessage,
      workerHelper: workerHelper || {
        detectedPrice: 15.0,
        suggestedWeightKg: 0.4,
        suggestedTotalEtb: 3850,
      },
      pricing: null, // Strictly null until worker confirms
      workerLink: workerLink || `https://t.me/korcha_support?start=quote_${id}`,
      createdAt: new Date().toISOString(),
    };

    quotes.unshift(newQuote);
    return newQuote;
  },

  updateEstimate(ticketId, pricing) {
    const quote = quotes.find((q) => q.ticketId === ticketId || q.quoteId === ticketId);
    if (!quote) return null;
    quote.pricing = pricing;
    quote.status = "estimated";
    quote.estimatedAt = new Date().toISOString();
    return quote;
  },

  findById(ticketId) {
    return quotes.find((q) => q.ticketId === ticketId || q.quoteId === ticketId) || null;
  },

  findAll() {
    return [...quotes];
  },

  findPending() {
    return quotes.filter((q) => q.status === "pending_worker_estimation");
  },
};
