-- Softball Team Manager Database Schema
-- Run this against your Hostinger MySQL database

CREATE TABLE IF NOT EXISTS players (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100),
  phone VARCHAR(20),
  jersey_number VARCHAR(5),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS games (
  id INT AUTO_INCREMENT PRIMARY KEY,
  game_date DATE NOT NULL,
  game_time TIME NOT NULL,
  opponent VARCHAR(100) NOT NULL,
  location VARCHAR(200),
  home_away ENUM('home', 'away') DEFAULT 'home',
  notes TEXT,
  season VARCHAR(50) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS batting_orders (
  game_id INT NOT NULL,
  player_id INT NOT NULL,
  batting_slot INT NOT NULL,
  PRIMARY KEY (game_id, player_id),
  UNIQUE KEY uq_game_slot (game_id, batting_slot),
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
);

-- position values: P, C, 1B, 2B, 3B, SS, LF, LC, RC, RF
CREATE TABLE IF NOT EXISTS fielding_lineup (
  game_id INT NOT NULL,
  inning TINYINT UNSIGNED NOT NULL,
  position VARCHAR(5) NOT NULL,
  player_id INT NOT NULL,
  PRIMARY KEY (game_id, inning, position),
  UNIQUE KEY uq_player_per_inning (game_id, inning, player_id),
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
);

-- Batting statistics per player per game
-- Hits breakdown: singles = h - doubles - triples - hr (derived)
CREATE TABLE IF NOT EXISTS batting_stats (
  id INT AUTO_INCREMENT PRIMARY KEY,
  game_id INT NOT NULL,
  player_id INT NOT NULL,
  ab INT NOT NULL DEFAULT 0,
  h INT NOT NULL DEFAULT 0,
  doubles INT NOT NULL DEFAULT 0,
  triples INT NOT NULL DEFAULT 0,
  hr INT NOT NULL DEFAULT 0,
  r INT NOT NULL DEFAULT 0,
  rbi INT NOT NULL DEFAULT 0,
  bb INT NOT NULL DEFAULT 0,
  k INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_game_player (game_id, player_id),
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS availability (
  id INT AUTO_INCREMENT PRIMARY KEY,
  player_id INT NOT NULL,
  game_id INT NOT NULL,
  status ENUM('yes', 'no', 'maybe') NOT NULL,
  note TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_player_game (player_id, game_id),
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
);
