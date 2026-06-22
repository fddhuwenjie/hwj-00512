import { Router, type Response } from 'express';
import db from '../db.js';
import { requireAuth, requireRole, type AuthRequest } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, requireRole('admin', 'counselor'), async (req: AuthRequest, res: Response): Promise<void> => {
  const clients = db.prepare('SELECT * FROM clients ORDER BY created_at DESC').all();
  res.json({ success: true, data: clients });
});

router.get('/me', requireAuth, requireRole('client'), async (req: AuthRequest, res: Response): Promise<void> => {
  const client: any = db.prepare('SELECT * FROM clients WHERE user_id = ?').get(req.user!.id);
  if (!client) {
    res.status(404).json({ success: false, error: '档案不存在' });
    return;
  }
  res.json({ success: true, data: client });
});

router.get('/:id', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const client: any = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
  if (!client) {
    res.status(404).json({ success: false, error: '来访者不存在' });
    return;
  }

  if (req.user!.role === 'client' && client.user_id !== req.user!.id) {
    res.status(403).json({ success: false, error: '权限不足' });
    return;
  }

  const fullClient = { ...client };
  if (req.user!.role === 'client') {
    delete fullClient.emergency_contact;
    delete fullClient.emergency_phone;
  }

  res.json({ success: true, data: fullClient });
});

router.get('/:id/history', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const client: any = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
  if (!client) {
    res.status(404).json({ success: false, error: '来访者不存在' });
    return;
  }

  if (req.user!.role === 'client' && client.user_id !== req.user!.id) {
    res.status(403).json({ success: false, error: '权限不足' });
    return;
  }

  const appointments = db.prepare(
    `SELECT a.*, c.name as counselor_name
     FROM appointments a
     LEFT JOIN counselors c ON a.counselor_id = c.id
     WHERE a.client_id = ?
     ORDER BY a.appointment_date DESC, a.appointment_time DESC`
  ).all(req.params.id);

  const records = db.prepare(
    `SELECT sr.*, a.appointment_date, a.appointment_time, c.name as counselor_name
     FROM session_records sr
     LEFT JOIN appointments a ON sr.appointment_id = a.id
     LEFT JOIN counselors c ON sr.counselor_id = c.id
     WHERE sr.client_id = ?
     ORDER BY sr.created_at DESC`
  ).all(req.params.id);

  const assessments = db.prepare(
    `SELECT * FROM assessments WHERE client_id = ? ORDER BY created_at DESC`
  ).all(req.params.id);

  res.json({ success: true, data: { appointments, records, assessments } });
});

router.put('/me', requireAuth, requireRole('client'), async (req: AuthRequest, res: Response): Promise<void> => {
  const existing: any = db.prepare('SELECT * FROM clients WHERE user_id = ?').get(req.user!.id);
  if (!existing) {
    res.status(404).json({ success: false, error: '档案不存在' });
    return;
  }

  const { name, gender, age, phone, email, emergency_contact, emergency_phone, main_concerns } = req.body;

  db.prepare(
    `UPDATE clients SET name = ?, gender = ?, age = ?, phone = ?, email = ?,
     emergency_contact = ?, emergency_phone = ?, main_concerns = ? WHERE user_id = ?`
  ).run(
    name || existing.name,
    gender !== undefined ? gender : existing.gender,
    age !== undefined ? age : existing.age,
    phone !== undefined ? phone : existing.phone,
    email !== undefined ? email : existing.email,
    emergency_contact !== undefined ? emergency_contact : existing.emergency_contact,
    emergency_phone !== undefined ? emergency_phone : existing.emergency_phone,
    main_concerns !== undefined ? main_concerns : existing.main_concerns,
    req.user!.id
  );

  const client = db.prepare('SELECT * FROM clients WHERE user_id = ?').get(req.user!.id);
  res.json({ success: true, data: client });
});

router.put('/:id', requireAuth, requireRole('admin', 'counselor'), async (req: AuthRequest, res: Response): Promise<void> => {
  const existing: any = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
  if (!existing) {
    res.status(404).json({ success: false, error: '来访者不存在' });
    return;
  }

  const { name, gender, age, phone, email, emergency_contact, emergency_phone, main_concerns } = req.body;

  db.prepare(
    `UPDATE clients SET name = ?, gender = ?, age = ?, phone = ?, email = ?,
     emergency_contact = ?, emergency_phone = ?, main_concerns = ? WHERE id = ?`
  ).run(
    name || existing.name,
    gender !== undefined ? gender : existing.gender,
    age !== undefined ? age : existing.age,
    phone !== undefined ? phone : existing.phone,
    email !== undefined ? email : existing.email,
    emergency_contact !== undefined ? emergency_contact : existing.emergency_contact,
    emergency_phone !== undefined ? emergency_phone : existing.emergency_phone,
    main_concerns !== undefined ? main_concerns : existing.main_concerns,
    req.params.id
  );

  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
  res.json({ success: true, data: client });
});

export default router;
