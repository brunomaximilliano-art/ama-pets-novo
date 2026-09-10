const { money } = require('./format');

// Arma el texto del pedido y el link de WhatsApp, tal como en el sitio de referencia:
// el cliente arma el carrito, elige entrega y pago, y el pedido se envía por WhatsApp.
function buildOrderMessage({ items, deliveryMethod, courierName, address, city, department, paymentMethod, cashAmount, customerName, phone, observation, total, storeName }) {
  const lines = [];
  lines.push(`¡Hola ${storeName}! Quiero hacer este pedido:`);
  lines.push('');
  for (const it of items) {
    const variant = it.variant ? ` (${it.variant})` : '';
    lines.push(`${it.qty}x ${it.name}${variant} - ${money(it.price * it.qty)}`);
  }
  lines.push('');

  if (deliveryMethod === 'entrega') {
    lines.push(`Forma de entrega: Envío${courierName ? ' (' + courierName + ')' : ''}`);
    if (address) lines.push(`Dirección: ${address}`);
    if (city) lines.push(`Ciudad: ${city}`);
    if (department) lines.push(`Departamento: ${department}`);
  } else {
    lines.push('Forma de entrega: Retiro en el local');
  }

  const paymentLabels = {
    efectivo: 'Efectivo',
    transferencia: 'Transferencia bancaria',
    tarjeta: 'Tarjeta (al recibir)',
    mercadopago: 'Mercado Pago',
  };
  lines.push(`Método de pago: ${paymentLabels[paymentMethod] || paymentMethod}`);
  if (paymentMethod === 'efectivo' && cashAmount) {
    lines.push(`Paga con: ${money(cashAmount)} (cambio: ${money(Math.max(0, cashAmount - total))})`);
  }

  lines.push('');
  lines.push(`Nombre: ${customerName || '-'}`);
  lines.push(`Teléfono: ${phone || '-'}`);
  if (observation) lines.push(`Observación: ${observation}`);
  lines.push('');
  lines.push(`Total: ${money(total)}`);

  return lines.join('\n');
}

function whatsappLink(number, text) {
  const clean = String(number || '').replace(/[^\d]/g, '');
  return `https://wa.me/${clean}?text=${encodeURIComponent(text)}`;
}

module.exports = { buildOrderMessage, whatsappLink };
