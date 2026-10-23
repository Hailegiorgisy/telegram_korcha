// backend/models/HelpModel.js

const helpRequests = [];

export const HelpModel = {
  create({ name, phone, message, sheinLink }) {
    const newRequest = {
      ticketId: "HELP-" + Math.floor(100000 + Math.random() * 900000),
      name: (name || "").trim(),
      phone: (phone || "").trim(),
      message: (message || "").trim(),
      sheinLink: (sheinLink || "").trim(),
      status: "Open", // "Open" | "Resolved"
      createdAt: new Date().toISOString(),
    };
    helpRequests.unshift(newRequest);
    return newRequest;
  },

  findAll() {
    return [...helpRequests];
  },

  findById(ticketId) {
    return helpRequests.find((h) => h.ticketId === ticketId) || null;
  },
};
