import { Router, type Response } from 'express';
import db from '../db.js';
import { requireAuth, requireRole, type AuthRequest } from '../middleware/auth.js';

const router = Router();

const getCounselorIdByUserId = (userId: number): number | null => {
  const counselor: any = db.prepare('SELECT id FROM counselors WHERE user_id = ?').get(userId);
  return counselor ? counselor.id : null;
};

const getClientIdByUserId = (userId: number): number | null => {
  const client: any = db.prepare('SELECT id FROM clients WHERE user_id = ?').get(userId);
  return client ? client.id : null;
};

router.get('/', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const { appointment_id, client_id } = req.query;
  let query = `
    SELECT sr.*, a.appointment_date, a.appointment_time,
           c.name as counselor_name, cl.name as client_name
    FROM session_records sr
    LEFT JOIN appointments a ON sr.appointment_id = a.id
    LEFT JOIN counselors c ON sr.counselor_id = c.id
    LEFT JOIN clients cl ON sr.client_id = cl.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (req.user!.role === 'client') {
    const cId = getClientIdByUserId(req.user!.id);
    if (cId) {
      query += ' AND sr.client_id = ?';
      params.push(cId);
    }
    query += ' AND sr.confidentiality_level = ?';
    params.push('standard');
  } else if (req.user!.role === 'counselor') {
    const counselorId = getCounselorIdByUserId(req.user!.id);
    if (counselorId) {
      query += ' AND sr.counselor_id = ?';
      params.push(counselorId);
    }
  } else {
    if (appointment_id) {
      query += ' AND sr.appointment_id = ?';
      params.push(appointment_id);
    }
    if (client_id) {
      query += ' AND sr.client_id = ?';
      params.push(client_id);
    }
  }

  query += ' ORDER BY sr.created_at DESC';
  const records = db.prepare(query).all(...params);
  res.json({ success: true, data: records });
});

router.get('/:id', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const record: any = db.prepare(`
    SELECT sr.*, a.appointment_date, a.appointment_time,
           c.name as counselor_name, cl.name as client_name
    FROM session_records sr
    LEFT JOIN appointments a ON sr.appointment_id = a.id
    LEFT JOIN counselors c ON sr.counselor_id = c.id
    LEFT JOIN clients cl ON sr.client_id = cl.id
    WHERE sr.id = ?
  `).get(req.params.id);

  if (!record) {
    res.status(404).json({ success: false, error: '记录不存在' });
    return;
  }

  if (req.user!.role === 'client') {
    const clientId = getClientIdByUserId(req.user!.id);
    if (record.client_id !== clientId) {
      res.status(403).json({ success: false, error: '权限不足' });
      return;
    }
    if (record.confidentiality_level !== 'standard') {
      res.status(403).json({ success: false, error: '该记录为保密级别，您无权查看' });
      return;
    }
  }

  res.json({ success: true, data: record });
});

router.post('/', requireAuth, requireRole('admin', 'counselor'), async (req: AuthRequest, res: Response): Promise<void> => {
  const { appointment_id, summary, interventions, next_plan, confidentiality_level, attachment_url } = req.body;

  if (!appointment_id || !summary) {
    res.status(400).json({ success: false, error: '缺少必要字段' });
    return;
  }

  const appointment: any = db.prepare('SELECT * FROM appointments WHERE id = ?').get(appointment_id);
  if (!appointment) {
    res.status(404).json({ success: false, error: '预约不存在' });
    return;
  }

  let counselorId;
  if (req.user!.role === 'counselor') {
    counselorId = getCounselorIdByUserId(req.user!.id);
    if (appointment.counselor_id !== counselorId) {
      res.status(403).json({ success: false, error: '只能为自己的预约填写记录' });
      return;
    }
  } else {
    counselorId = appointment.counselor_id;
  }

  try {
    const stmt = db.prepare(
      `INSERT INTO session_records (appointment_id, client_id, counselor_id, summary,
       interventions, next_plan, confidentiality_level, attachment_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const result = stmt.run(
      appointment_id,
      appointment.client_id,
      counselorId,
      summary,
      interventions || null,
      next_plan || null,
      confidentiality_level || 'standard',
      attachment_url || null
    );
    const record = db.prepare('SELECT * FROM session_records WHERE id = ?').get(result.lastInsertRowid);
    res.json({ success: true, data: record });
  } catch (err: any) {
    if (err.code === 'SQLITE_CONSTRAINT') {
      res.status(400).json({ success: false, error: '该预约已存在咨询记录' });
    } else {
      res.status(500).json({ success: false, error: err.message });
    }
  }
});

router.put('/:id', requireAuth, requireRole('admin', 'counselor'), async (req: AuthRequest, res: Response): Promise<void> => {
  const existing: any = db.prepare('SELECT * FROM session_records WHERE id = ?').get(req.params.id);
  if (!existing) {
    res.status(404).json({ success: false, error: '记录不存在' });
    return;
  }

  if (req.user!.role === 'counselor') {
    const counselorId = getCounselorIdByUserId(req.user!.id);
    if (existing.counselor_id !== counselorId) {
      res.status(403).json({ success: false, error: '只能修改自己的记录' });
      return;
    }
  }

  const { summary, interventions, next_plan, confidentiality_level, attachment_url } = req.body;

  db.prepare(
    `UPDATE session_records SET summary = ?, interventions = ?, next_plan = ?,
     confidentiality_level = ?, attachment_url = ? WHERE id = ?`
  ).run(
    summary || existing.summary,
    interventions !== undefined ? interventions : existing.interventions,
    next_plan !== undefined ? next_plan : existing.next_plan,
    confidentiality_level || existing.confidentiality_level,
    attachment_url !== undefined ? attachment_url : existing.attachment_url,
    req.params.id
  );

  const record = db.prepare('SELECT * FROM session_records WHERE id = ?').get(req.params.id);
  res.json({ success: true, data: record });
});

router.delete('/:id', requireAuth, requireRole('admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  const existing = db.prepare('SELECT * FROM session_records WHERE id = ?').get(req.params.id);
  if (!existing) {
    res.status(404).json({ success: false, error: '记录不存在' });
    return;
  }
  db.prepare('DELETE FROM session_records WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;
