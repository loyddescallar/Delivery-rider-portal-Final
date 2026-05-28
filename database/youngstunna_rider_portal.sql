DROP DATABASE IF EXISTS youngstunna_rider_portal;
CREATE DATABASE youngstunna_rider_portal;
USE youngstunna_rider_portal;

CREATE TABLE riders (
  rider_id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(64) NOT NULL,
  contact_number VARCHAR(30) NOT NULL,
  vehicle_type VARCHAR(50) NOT NULL,
  plate_number VARCHAR(30) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE deliveries (
  delivery_id INT AUTO_INCREMENT PRIMARY KEY,
  rider_id INT NOT NULL,
  order_id VARCHAR(50) NULL,
  tracking_number VARCHAR(50) NOT NULL UNIQUE,
  recipient_name VARCHAR(100) NOT NULL,
  recipient_contact VARCHAR(30) NOT NULL,
  recipient_address TEXT NOT NULL,
  item_description VARCHAR(255) NULL,
  payment_method VARCHAR(50) NULL,
  total_amount DECIMAL(10,2) DEFAULT 0.00,
  status ENUM('Pending','Out for Delivery','Delivered','Failed') NOT NULL DEFAULT 'Pending',
  assigned_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  delivered_date DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_deliveries_rider FOREIGN KEY (rider_id) REFERENCES riders(rider_id) ON DELETE CASCADE
);

CREATE TABLE delivery_status_logs (
  log_id INT AUTO_INCREMENT PRIMARY KEY,
  delivery_id INT NOT NULL,
  status ENUM('Pending','Out for Delivery','Delivered','Failed') NOT NULL,
  remarks VARCHAR(255) NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_logs_delivery FOREIGN KEY (delivery_id) REFERENCES deliveries(delivery_id) ON DELETE CASCADE
);

INSERT INTO riders (full_name, email, password_hash, contact_number, vehicle_type, plate_number) VALUES
('Young Stunna Rider', 'rider@youngstunna.com', 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f', '0917-123-4567', 'Motorcycle', 'YS-1234');

INSERT INTO deliveries (rider_id, order_id, tracking_number, recipient_name, recipient_contact, recipient_address, item_description, payment_method, total_amount, status, assigned_date) VALUES
(1, 'ORD-1001', 'YS-TRK-1001', 'Maria Santos', '0918-222-1111', 'Brgy. Poblacion, Calaca City, Batangas', 'Food package', 'Cash on Delivery', 350.00, 'Pending', NOW()),
(1, 'ORD-1002', 'YS-TRK-1002', 'Juan Dela Cruz', '0999-555-3322', 'Brgy. Dacanlao, Calaca City, Batangas', 'Small parcel', 'Paid Online', 0.00, 'Out for Delivery', NOW()),
(1, 'ORD-1003', 'YS-TRK-1003', 'Ana Reyes', '0906-777-8888', 'Brgy. Bagong Tubig, Calaca City, Batangas', 'Document envelope', 'Paid Online', 0.00, 'Delivered', DATE_SUB(NOW(), INTERVAL 1 DAY)),
(1, 'ORD-1004', 'YS-TRK-1004', 'Pedro Ramos', '0921-444-9999', 'Brgy. Lumbang, Calaca City, Batangas', 'Grocery items', 'Cash on Delivery', 520.00, 'Failed', DATE_SUB(NOW(), INTERVAL 2 DAY));

UPDATE deliveries SET delivered_date = DATE_SUB(NOW(), INTERVAL 20 HOUR) WHERE tracking_number = 'YS-TRK-1003';

INSERT INTO delivery_status_logs (delivery_id, status, remarks) VALUES
(1, 'Pending', 'Order Management assigned this delivery to the rider.'),
(2, 'Pending', 'Order Management assigned this delivery to the rider.'),
(2, 'Out for Delivery', 'Rider picked up the order and started delivery.'),
(3, 'Pending', 'Order Management assigned this delivery to the rider.'),
(3, 'Out for Delivery', 'Rider started delivery.'),
(3, 'Delivered', 'Delivery confirmed successfully.'),
(4, 'Pending', 'Order Management assigned this delivery to the rider.'),
(4, 'Failed', 'Customer was unavailable during delivery attempt.');
