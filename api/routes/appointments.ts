import { Router, type Response } from 'express';
import db from '../db.js';
import { requireAuth, requireRole, type AuthRequest } from '../middleware/auth.js';

const router = Router();

const getClientIdByUserId = (userId: number): number | null => {
  const client: any = db.prepare('SELECT id FROM clients WHERE user_id = ?').get(userId);
  return client ? client.id : null;
};

const getCounselorIdByUserId = (userId: number): number | null => {
  const counselor: any = db.prepare('SELECT id FROM counselors WHERE user_id = ?').get(userId);
  return counselor ? counselor.id : null;
};

router.get('/', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const { status, counselor_id, client_id } = req.query;
  let query = `
    SELECT a.*, c.name as counselor_name, cl.name as client_name, cl.phone as client_phone
    FROM appointments a
    LEFT JOIN counselors c ON a.counselor_id = c.id
    LEFT JOIN clients cl ON a.client_id = cl.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (req.user!.role === 'client') {
    const clientId = getClientIdByUserId(req.user!.id);
    if (clientId) {
      query += ' AND a.client_id = ?';
      params.push(clientId);
    }
  } else if (req.user!.role === 'counselor') {
    const counselorId = getCounselorIdByUserId(req.user!.id);
    if (counselorId) {
      query += ' AND a.counselor_id = ?';
      params.push(counselorId);
    }
  } else {
    if (counselor_id) {
      query += ' AND a.counselor_id = ?';
      params.push(counselor_id);
    }
    if (client_id) {
      query += ' AND a.client_id = ?';
      params.push(client_id);
    }
  }

  if (status) {
    query += ' AND a.status = ?';
    params.push(status);
  }

  query += ' ORDER BY a.appointment_date DESC, a.appointment_time DESC';
  const appointments = db.prepare(query).all(...params);
  res.json({ success: true, data: appointments });
});

router.get('/:id', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const appointment: any = db.prepare(`
    SELECT a.*, c.name as counselor_name, cl.name as client_name, cl.phone as client_phone, cl.email as client_email
    FROM appointments a
    LEFT JOIN counselors c ON a.counselor_id = c.id
    LEFT JOIN clients cl ON a.client_id = cl.id
    WHERE a.id = ?
  `).get(req.params.id);

  if (!appointment) {
    res.status(404).json({ success: false, error: '预约不存在' });
    return;
  }

  if (req.user!.role === 'client') {
    const clientId = getClientIdByUserId(req.user!.id);
    if (appointment.client_id !== clientId) {
      res.status(403).json({ success: false, error: '权限不足' });
      return;
    }
  } else if (req.user!.role === 'counselor') {
    const counselorId = getCounselorIdByUserId(req.user!.id);
    if (appointment.counselor_id !== counselorId) {
      res.status(403).json({ success: false, error: '权限不足' });
      return;
    }
  }

  res.json({ success: true, data: appointment });
});

router.post('/', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const { counselor_id, appointment_date, appointment_time, notes } = req.body;

  if (!counselor_id || !appointment_date || !appointment_time) {
    res.status(400).json({ success: false, error: '缺少必要字段' });
    return;
  }

  let clientId;
  if (req.user!.role === 'client') {
    clientId = getClientIdByUserId(req.user!.id);
  } else {
    clientId = req.body.client_id;
  }

  if (!clientId) {
    res.status(400).json({ success: false, error: '来访者信息缺失' });
    return;
  }

  const conflict: any = db.prepare(`
    SELECT id FROM appointments
    WHERE counselor_id = ? AND appointment_date = ? AND appointment_time = ?
    AND status NOT IN ('cancelled', 'no_show')
  `).get(counselor_id, appointment_date, appointment_time);

  if (conflict) {
    res.status(400).json({ success: false, error: '该时段已被预约' });
    return;
  }

  const stmt = db.prepare(
    'INSERT INTO appointments (client_id, counselor_id, appointment_date, appointment_time, notes) VALUES (?, ?, ?, ?, ?)'
  );
  const result = stmt.run(clientId, counselor_id, appointment_date, appointment_time, notes || null);
  const appointment = db.prepare('SELECT * FROM appointments WHERE id = ?').get(result.lastInsertRowid);
  res.json({ success: true, data: appointment });
});

router.put('/:id/confirm', requireAuth, requireRole('admin', 'counselor'), async (req: AuthRequest, res: Response): Promise<void> => {
  const existing: any = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id);
  if (!existing) {
    res.status(404).json({ success: false, error: '预约不存在' });
    return;
  }
  if (existing.status !== 'pending') {
    res.status(400).json({ success: false, error: '只能确认待确认的预约' });
    return;
  }
  db.prepare('UPDATE appointments SET status = ? WHERE id = ?').run('confirmed', req.params.id);
  const appointment = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id);
  res.json({ success: true, data: appointment });
});

router.put('/:id/reject', requireAuth, requireRole('admin', 'counselor'), async (req: AuthRequest, res: Response): Promise<void> => {
  const { reject_reason } = req.body;
  const existing: any = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id);
  if (!existing) {
    res.status(404).json({ success: false, error: '预约不存在' });
    return;
  }
  if (existing.status !== 'pending') {
    res.status(400).json({ success: false, error: '只能拒绝待确认的预约' });
    return;
  }
  db.prepare('UPDATE appointments SET status = ?, reject_reason = ? WHERE id = ?').run('cancelled', reject_reason || '', req.params.id);
  const appointment = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id);
  res.json({ success: true, data: appointment });
});

router.put('/:id/cancel', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const { cancel_reason } = req.body;
  const existing: any = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id);
  if (!existing) {
    res.status(404).json({ success: false, error: '预约不存在' });
    return;
  }
  if (existing.status === 'completed' || existing.status === 'cancelled' || existing.status === 'no_show') {
    res.status(400).json({ success: false, error: '该预约状态无法取消' });
    return;
  }

  if (req.user!.role === 'client') {
    const clientId = getClientIdByUserId(req.user!.id);
    if (existing.client_id !== clientId) {
      res.status(403).json({ success: false, error: '权限不足' });
      return;
    }
  } else if (req.user!.role === 'counselor') {
    const counselorId = getCounselorIdByUserId(req.user!.id);
    if (existing.counselor_id !== counselorId) {
      res.status(403).json({ success: false, error: '权限不足' });
      return;
    }
  }

  db.prepare('UPDATE appointments SET status = ?, cancel_time = CURRENT_TIMESTAMP, cancel_reason = ? WHERE id = ?')
    .run('cancelled', cancel_reason || '', req.params.id);
  const appointment = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id);
  res.json({ success: true, data: appointment });
});

router.put('/:id/complete', requireAuth, requireRole('admin', 'counselor'), async (req: AuthRequest, res: Response): Promise<void> => {
  const existing: any = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id);
  if (!existing) {
    res.status(404).json({ success: false, error: '预约不存在' });
    return;
  }
  if (existing.status !== 'confirmed') {
    res.status(400).json({ success: false, error: '只能完成已确认的预约' });
    return;
  }
  db.prepare('UPDATE appointments SET status = ? WHERE id = ?').run('completed', req.params.id);
  const appointment = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id);
  res.json({ success: true, data: appointment });
});

router.put('/:id/no_show', requireAuth, requireRole('admin', 'counselor'), async (req: AuthRequest, res: Response): Promise<void> => {
  const existing: any = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id);
  if (!existing) {
    res.status(404).json({ success: false, error: '预约不存在' });
    return;
  }
  db.prepare('UPDATE appointments SET status = ? WHERE id = ?').run('no_show', req.params.id);
  const appointment = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id);
  res.json({ success: true, data: appointment });
});

router.delete('/:id', requireAuth, requireRole('admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  const existing = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id);
  if (!existing) {
    res.status(404).json({ success: false, error: '预约不存在' });
    return;
  }
  db.prepare('DELETE FROM appointments WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;
