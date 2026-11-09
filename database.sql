CREATE DATABASE IF NOT EXISTS bloodconnect;
USE bloodconnect;
CREATE TABLE IF NOT EXISTS users (
 id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100) NOT NULL,
 email VARCHAR(150) NOT NULL UNIQUE, password_hash VARCHAR(255) NOT NULL,
 blood_group VARCHAR(5) NOT NULL, phone VARCHAR(20), city VARCHAR(100),
 is_donor BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS blood_requests (
 id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL,
 patient_name VARCHAR(100) NOT NULL, blood_group VARCHAR(5) NOT NULL,
 units INT NOT NULL DEFAULT 1, hospital VARCHAR(180) NOT NULL, city VARCHAR(100) NOT NULL,
 needed_date DATE, message TEXT,
 status ENUM('Open','Donor Found','Completed','Cancelled') NOT NULL DEFAULT 'Open',
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS donor_responses (
 id INT AUTO_INCREMENT PRIMARY KEY, request_id INT NOT NULL, donor_id INT NOT NULL,
 message VARCHAR(500), status ENUM('Interested','Accepted','Declined') DEFAULT 'Interested',
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 UNIQUE KEY unique_response(request_id,donor_id),
 FOREIGN KEY(request_id) REFERENCES blood_requests(id) ON DELETE CASCADE,
 FOREIGN KEY(donor_id) REFERENCES users(id) ON DELETE CASCADE
);
