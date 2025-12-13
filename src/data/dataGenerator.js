const { v4: uuidv4 } = require('uuid');

const generateLogData = (count) => {
  const logs = [];
  for (let i = 0; i < count; i++) {
    logs.push({
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      user_id: Math.floor(Math.random() * 1000) + 1, // IDs de usuário entre 1 e 1000
      action: ['checkout_completed', 'item_viewed', 'add_to_cart', 'login_success', 'payment_failed'][Math.floor(Math.random() * 5)],
      device: ['mobile_app', 'web_browser', 'desktop_app'][Math.floor(Math.random() * 3)],
      details: {
        total_value: parseFloat((Math.random() * 1000).toFixed(2)),
        items_qtd: Math.floor(Math.random() * 10) + 1,
        coupon_applied: Math.random() > 0.5 ? `COUPON${Math.floor(Math.random() * 100)}` : null,
        ip_address: `192.168.0.${Math.floor(Math.random() * 255)}`
      }
    });
  }
  return logs;
};

module.exports = { generateLogData };
