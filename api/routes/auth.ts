import { Router, type Request, type Response } from 'express';
import db from '../db.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';

const router = Router();

router.post('/register', async (req: Request, res: Response): Promise<void> => {
  const { username, password, role, name, phone, email } = req.body;

  if (!username || !password || !role || !name) {
    res.status(400).json({ success: false, error: '缺少必要字段' });
    return;
  }

  if (!['admin', 'counselor', 'client'].includes(role)) {
    res.status(400).json({ success: false, error: '角色无效' });
    return;
  }

  try {
    const stmt = db.prepare(
      'INSERT INTO users (username, password, role, name, phone, email) VALUES (?, ?, ?, ?, ?, ?)'
    );
    const result = stmt.run(username, password, role, name, phone || null, email || null);
    const userId = result.lastInsertRowid;

    if (role === 'client') {
      db.prepare('INSERT INTO clients (user_id, name, phone, email) VALUES (?, ?, ?, ?)').run(
        userId,
        name,
        phone || null,
        email || null
      );
    }

    if (role === 'counselor') {
      db.prepare(
        'INSERT INTO counselors (user_id, name, qualification, specialties) VALUES (?, ?, ?, ?)'
      ).run(userId, name, '', '');
    }

    const user = db.prepare('SELECT id, username, role, name, phone, email FROM users WHERE id = ?').get(userId);
    res.json({ success: true, data: user });
  } catch (err: any) {
    if (err.code === 'SQLITE_CONSTRAINT') {
      res.status(400).json({ success: false, error: '用户名已存在' });
    } else {
      res.status(500).json({ success: false, error: err.message });
    }
  }
});

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400).json({ success: false, error: '请输入用户名和密码' });
    return;
  }

  const user: any = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

  if (!user || user.password !== password) {
    res.status(401).json({ success: false, error: '用户名或密码错误' });
    return;
  }

  const { password: _, ...userInfo } = user;
  res.json({ success: true, data: userInfo });
});

router.post('/logout', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  res.json({ success: true });
});

router.get('/me', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const user: any = db.prepare('SELECT id, username, role, name, phone, email FROM users WHERE id = ?').get(req.user!.id);
  if (!user) {
    res.status(404).json({ success: false, error: '用户不存在' });
    return;
  }

  let profile = null;
  if (user.role === 'counselor') {
    profile = db.prepare('SELECT * FROM counselors WHERE user_id = ?').get(user.id);
  } else if (user.role === 'client') {
    profile = db.prepare('SELECT * FROM clients WHERE user_id = ?').get(user.id);
  }

  res.json({ success: true, data: { ...user, profile } });
});

export default router;
