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
  }
};

initDB();

export default db;
