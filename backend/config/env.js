require('dotenv').config();

const PORT = process.env.PORT || 3600;
const JWT_SECRET = process.env.JWT_SECRET || 'young_stunna_secret_key_change_me';
const INTEGRATION_API_KEY = process.env.INTEGRATION_API_KEY || 'demo-integration-key';
const AUTH_MODE = (process.env.AUTH_MODE || 'external').toLowerCase();
const AUTH_SERVICE_URL = (process.env.AUTH_SERVICE_URL || 'http://localhost:3000').replace(/\/+$/, '');
const DEFAULT_RIDER_ID = Number(process.env.DEFAULT_RIDER_ID || 1);

const SERVICE_URLS = {
  orderManagement: (process.env.ORDER_MANAGEMENT_SERVICE_URL || '').replace(/\/+$/, ''),
  notification: (process.env.NOTIFICATION_SERVICE_URL || '').replace(/\/+$/, ''),
  customerTracking: (process.env.CUSTOMER_TRACKING_SERVICE_URL || '').replace(/\/+$/, ''),
  performanceMonitoring: (process.env.PERFORMANCE_MONITORING_SERVICE_URL || '').replace(/\/+$/, ''),
  analytics: (process.env.ANALYTICS_SERVICE_URL || '').replace(/\/+$/, ''),
  returnManagement: (process.env.RETURN_MANAGEMENT_SERVICE_URL || '').replace(/\/+$/, '')
};

const SERVICE_PATHS = {
  orderAssignments: process.env.ORDER_MANAGEMENT_ASSIGNMENTS_PATH || '/api/orders/assigned',
  notificationCreate: process.env.NOTIFICATION_CREATE_PATH || '/api/notifications',
  customerTrackingUpdate: process.env.CUSTOMER_TRACKING_UPDATE_PATH || '/api/tracking/status',
  performanceRecord: process.env.PERFORMANCE_RECORD_PATH || '/api/performance/deliveries',
  analyticsEvent: process.env.ANALYTICS_EVENT_PATH || '/api/analytics/delivery-events',
  returnCreate: process.env.RETURN_CREATE_PATH || '/api/returns'
};

const allowedStatuses = ['Pending', 'Out for Delivery', 'Delivered', 'Failed'];

module.exports = {
  PORT,
  JWT_SECRET,
  INTEGRATION_API_KEY,
  AUTH_MODE,
  AUTH_SERVICE_URL,
  DEFAULT_RIDER_ID,
  SERVICE_URLS,
  SERVICE_PATHS,
  allowedStatuses
};
