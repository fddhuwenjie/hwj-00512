import { Router, type Response } from 'express';
import db from '../db.js';
import { requireAuth, requireRole, type AuthRequest } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const { is_active } = req.query;
  let query = 'SELECT * FROM counselors WHERE 1=1';
  const params: any[] = [];

  if (is_active !== undefined) {
    query += ' AND is_active = ?';
    params.push(is_active === 'true' || is_active === '1' ? 1 : 0);
  }

  query += ' ORDER BY created_at DESC';
  const counselors = db.prepare(query).all(...params);
  res.json({ success: true, data: counselors });
});

router.get('/:id', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const counselor = db.prepare('SELECT * FROM counselors WHERE id = ?').get(req.params.id);
  if (!counselor) {
    res.status(404).json({ success: false, error: '咨询师不存在' });
    return;
  }
  res.json({ success: true, data: counselor });
});

router.post('/', requireAuth, requireRole('admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  const { user_id, name, qualification, specialties, available_slots, session_duration, fee, bio } = req.body;

  if (!name || !qualification || !specialties) {
    res.status(400).json({ success: false, error: '缺少必要字段' });
    return;
  }

  try {
    const stmt = db.prepare(
      `INSERT INTO counselors (user_id, name, qualification, specialties, available_slots, session_duration, fee, bio)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const result = stmt.run(
      user_id || null,
      name,
      qualification,
      specialties,
      available_slots || null,
      session_duration || 50,
      fee || 0,
      bio || null
    );
    const counselor = db.prepare('SELECT * FROM counselors WHERE id = ?').get(result.lastInsertRowid);
    res.json({ success: true, data: counselor });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/:id', requireAuth, requireRole('admin', 'counselor'), async (req: AuthRequest, res: Response): Promise<void> => {
  const existing: any = db.prepare('SELECT * FROM counselors WHERE id = ?').get(req.params.id);
  if (!existing) {
    res.status(404).json({ success: false, error: '咨询师不存在' });
    return;
  }

  const { name, qualification, specialties, available_slots, session_duration, fee, bio, is_active } = req.body;

  db.prepare(
    `UPDATE counselors SET name = ?, qualification = ?, specialties = ?, available_slots = ?,
     session_duration = ?, fee = ?, bio = ?, is_active = ? WHERE id = ?`
  ).run(
    name || existing.name,
    qualification || existing.qualification,
    specialties || existing.specialties,
    available_slots !== undefined ? available_slots : existing.available_slots,
    session_duration || existing.session_duration,
    fee !== undefined ? fee : existing.fee,
    bio !== undefined ? bio : existing.bio,
    is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active,
    req.params.id
  );

  const counselor = db.prepare('SELECT * FROM counselors WHERE id = ?').get(req.params.id);
  res.json({ success: true, data: counselor });
});

router.patch('/:id/toggle', requireAuth, requireRole('admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  const existing: any = db.prepare('SELECT * FROM counselors WHERE id = ?').get(req.params.id);
  if (!existing) {
    res.status(404).json({ success: false, error: '咨询师不存在' });
    return;
  }

  const newStatus = existing.is_active ? 0 : 1;
  db.prepare('UPDATE counselors SET is_active = ? WHERE id = ?').run(newStatus, req.params.id);
  res.json({ success: true, data: { is_active: newStatus === 1 } });
});

router.delete('/:id', requireAuth, requireRole('admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  const existing = db.prepare('SELECT * FROM counselors WHERE id = ?').get(req.params.id);
  if (!existing) {
    res.status(404).json({ success: false, error: '咨询师不存在' });
    return;
  }

  db.prepare('DELETE FROM counselors WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;
