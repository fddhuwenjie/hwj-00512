import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', 'data', 'counseling.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const initDB = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'counselor', 'client')),
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS counselors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL,
      name TEXT NOT NULL,
      qualification TEXT NOT NULL,
      specialties TEXT NOT NULL,
      available_slots TEXT,
      session_duration INTEGER DEFAULT 50,
      fee REAL DEFAULT 0,
      bio TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL,
      name TEXT NOT NULL,
      gender TEXT,
      age INTEGER,
      phone TEXT,
      email TEXT,
      emergency_contact TEXT,
      emergency_phone TEXT,
      main_concerns TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      counselor_id INTEGER NOT NULL,
      appointment_date TEXT NOT NULL,
      appointment_time TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'confirmed', 'completed', 'cancelled', 'no_show')),
      reject_reason TEXT,
      cancel_time DATETIME,
      cancel_reason TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients(id),
      FOREIGN KEY (counselor_id) REFERENCES counselors(id)
    );

    CREATE TABLE IF NOT EXISTS assessments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      appointment_id INTEGER,
      scale_type TEXT NOT NULL CHECK(scale_type IN ('PHQ-9', 'GAD-7')),
      answers TEXT NOT NULL,
      score INTEGER NOT NULL,
      level TEXT NOT NULL,
      is_high_risk INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients(id),
      FOREIGN KEY (appointment_id) REFERENCES appointments(id)
    );

    CREATE TABLE IF NOT EXISTS session_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      appointment_id INTEGER UNIQUE NOT NULL,
      client_id INTEGER NOT NULL,
      counselor_id INTEGER NOT NULL,
      summary TEXT NOT NULL,
      interventions TEXT,
      next_plan TEXT,
      confidentiality_level TEXT DEFAULT 'standard' CHECK(confidentiality_level IN ('standard', 'confidential', 'strict')),
      attachment_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (appointment_id) REFERENCES appointments(id),
      FOREIGN KEY (client_id) REFERENCES clients(id),
      FOREIGN KEY (counselor_id) REFERENCES counselors(id)
    );

    CREATE TABLE IF NOT EXISTS counselor_schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      counselor_id INTEGER NOT NULL,
      day_of_week INTEGER NOT NULL CHECK(day_of_week BETWEEN 1 AND 7),
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (counselor_id) REFERENCES counselors(id),
      UNIQUE(counselor_id, day_of_week, start_time, end_time)
    );

    CREATE TABLE IF NOT EXISTS counselor_unavailable_dates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      counselor_id INTEGER NOT NULL,
      unavailable_date TEXT NOT NULL,
      reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (counselor_id) REFERENCES counselors(id),
      UNIQUE(counselor_id, unavailable_date)
    );

    CREATE TABLE IF NOT EXISTS appointment_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      appointment_id INTEGER NOT NULL,
      action TEXT NOT NULL CHECK(action IN ('created', 'confirmed', 'cancelled', 'rejected', 'reschedule_requested', 'reschedule_approved', 'reschedule_rejected')),
      operator_id INTEGER,
      operator_name TEXT,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (appointment_id) REFERENCES appointments(id)
    );

    CREATE TABLE IF NOT EXISTS reschedule_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      appointment_id INTEGER NOT NULL,
      client_id INTEGER NOT NULL,
      counselor_id INTEGER NOT NULL,
      original_date TEXT NOT NULL,
      original_time TEXT NOT NULL,
      new_date TEXT NOT NULL,
      new_time TEXT NOT NULL,
      reason TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
      reviewer_id INTEGER,
      reviewer_name TEXT,
      review_note TEXT,
      reviewed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (appointment_id) REFERENCES appointments(id),
      FOREIGN KEY (client_id) REFERENCES clients(id),
      FOREIGN KEY (counselor_id) REFERENCES counselors(id)
    );

    CREATE TABLE IF NOT EXISTS conflict_interceptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      counselor_id INTEGER NOT NULL,
      client_id INTEGER,
      conflict_type TEXT NOT NULL CHECK(conflict_type IN ('booking_appointment', 'reschedule_appointment')),
      conflict_date TEXT NOT NULL,
      conflict_time TEXT NOT NULL,
      intercept_reason TEXT NOT NULL,
      existing_appointment_id INTEGER,
      operator_id INTEGER,
      operator_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (counselor_id) REFERENCES counselors(id),
      FOREIGN KEY (client_id) REFERENCES clients(id),
      FOREIGN KEY (existing_appointment_id) REFERENCES appointments(id)
    );
  `);

  const userCount = (db.prepare('SELECT COUNT(*) as count FROM users').get() as any).count;
  if (userCount === 0) {
    const insertUser = db.prepare(
      'INSERT INTO users (username, password, role, name, phone, email) VALUES (?, ?, ?, ?, ?, ?)'
    );
    insertUser.run('admin', 'admin123', 'admin', '系统管理员', '13800138000', 'admin@test.com');
    const counselorUserId = insertUser.run('counselor1', '123456', 'counselor', '张医生', '13900139000', 'zhang@test.com').lastInsertRowid;
    const clientUserId = insertUser.run('client1', '123456', 'client', '李来访者', '13700137000', 'li@test.com').lastInsertRowid;

    db.prepare(
      'INSERT INTO counselors (user_id, name, qualification, specialties, available_slots, session_duration, fee, bio) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      counselorUserId,
      '张医生',
      '国家二级心理咨询师',
      '焦虑,抑郁,亲密关系',
      '周一 09:00-12:00,周三 14:00-18:00,周五 09:00-17:00',
      50,
      300,
      '从事心理咨询工作10年，擅长认知行为疗法，在焦虑、抑郁、亲密关系方面有丰富的临床经验。'
    );

    db.prepare(
      'INSERT INTO clients (user_id, name, gender, age, phone, email, emergency_contact, emergency_phone, main_concerns) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      clientUserId,
      '李来访者',
      '女',
      28,
      '13700137000',
      'li@test.com',
      '王先生',
      '13600136000',
      '近期工作压力大，睡眠不好，情绪低落'
    );

    const counselorId = (db.prepare('SELECT id FROM counselors WHERE user_id = ?').get(counselorUserId) as any).id;
    const clientId = (db.prepare('SELECT id FROM clients WHERE user_id = ?').get(clientUserId) as any).id;

    const insertSchedule = db.prepare(
      'INSERT INTO counselor_schedules (counselor_id, day_of_week, start_time, end_time) VALUES (?, ?, ?, ?)'
    );
    insertSchedule.run(counselorId, 1, '09:00', '12:00');
    insertSchedule.run(counselorId, 3, '14:00', '18:00');
    insertSchedule.run(counselorId, 5, '09:00', '17:00');
  }
};

initDB();

export default db;
