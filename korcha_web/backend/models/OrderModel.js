// backend/models/OrderModel.js

const orders = [];

export const OrderModel = {
  create(orderData) {
    const newOrder = {
      orderId: "KOR-" + Math.floor(100000 + Math.random() * 900000),
      userId: orderData.userId || "tg-user-" + Math.floor(Math.random() * 10000),
      items: orderData.items || [],
      totalPrice: Math.round(orderData.totalPrice),
      depositAmount: Math.round(orderData.depositAmount),
      codAmount: Math.round(orderData.codAmount),
      depositPaid: Boolean(orderData.depositPaid),
      telebirrTransactionId: orderData.telebirrTransactionId || null,
      status: "Pending", // "Pending" | "Dispatched" | "Delivered"
      createdAt: new Date().toISOString(),
      deliveryProfile: {
        userId: orderData.userId || "tg-user",
        gps: orderData.deliveryProfile?.gps || { lat: 9.0107, lng: 38.7612 },
        landmark: (orderData.deliveryProfile?.landmark || "").trim(),
        primaryPhone: (orderData.deliveryProfile?.primaryPhone || "").trim(),
        backupPhone: (orderData.deliveryProfile?.backupPhone || "").trim(),
        deliveryMethod: orderData.deliveryProfile?.deliveryMethod || "MotorCourier",
      },
    };

    orders.unshift(newOrder);
    return newOrder;
  },

  findAll() {
    return [...orders];
  },

  findById(orderId) {
    return orders.find((o) => o.orderId === orderId) || null;
  },

  updateStatus(orderId, status) {
    const order = this.findById(orderId);
    if (!order) return null;
    order.status = status;
    return order;
  },

  attachTelebirrTransaction(orderId, transactionId) {
    const order = this.findById(orderId);
    if (!order) return null;
    order.telebirrTransactionId = transactionId;
    order.depositPaid = true;
    return order;
  },
};
