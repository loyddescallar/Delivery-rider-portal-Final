const { SERVICE_URLS, SERVICE_PATHS } = require('../config/env');

function buildServiceUrl(serviceUrl, path) {
  if (!serviceUrl) return null;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${serviceUrl}${cleanPath}`;
}

async function safePostToService(serviceName, serviceUrl, path, payload) {
  const url = buildServiceUrl(serviceUrl, path);
  if (!url) return { skipped: true, service: serviceName };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    const data = await response.json().catch(() => ({}));
    return { service: serviceName, ok: response.ok, status: response.status, data };
  } catch (error) {
    return { service: serviceName, ok: false, error: error.message };
  } finally {
    clearTimeout(timeout);
  }
}

async function notifyConnectedModules(delivery, eventType = 'status_update', remarks = '') {
  if (!delivery) return [];

  const payload = {
    eventType,
    orderId: delivery.order_id,
    deliveryId: delivery.delivery_id,
    riderId: delivery.rider_id,
    trackingNumber: delivery.tracking_number,
    recipientName: delivery.recipient_name,
    recipientContact: delivery.recipient_contact,
    deliveryAddress: delivery.recipient_address,
    status: delivery.status,
    remarks,
    updatedAt: new Date().toISOString()
  };

  const tasks = [
    safePostToService('Customer Tracking Portal', SERVICE_URLS.customerTracking, SERVICE_PATHS.customerTrackingUpdate, payload),
    safePostToService('Notification System', SERVICE_URLS.notification, SERVICE_PATHS.notificationCreate, {
      riderId: payload.riderId,
      title: `Delivery ${payload.status}`,
      message: `${payload.trackingNumber} is now ${payload.status}.`,
      type: 'delivery_status',
      data: payload
    }),
    safePostToService('Delivery Performance Monitoring System', SERVICE_URLS.performanceMonitoring, SERVICE_PATHS.performanceRecord, payload),
    safePostToService('Analytics Dashboard System', SERVICE_URLS.analytics, SERVICE_PATHS.analyticsEvent, payload)
  ];

  if (delivery.status === 'Failed') {
    tasks.push(
      safePostToService('Return Management System', SERVICE_URLS.returnManagement, SERVICE_PATHS.returnCreate, {
        ...payload,
        returnReason: remarks || 'Delivery failed.'
      })
    );
  }

  const results = await Promise.all(tasks);
  results
    .filter((result) => result && result.ok === false)
    .forEach((result) => console.warn(`Integration warning: ${result.service}`, result.error || result.status));

  return results;
}

module.exports = {
  buildServiceUrl,
  safePostToService,
  notifyConnectedModules
};
