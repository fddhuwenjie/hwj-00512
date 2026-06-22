import { Router, type Response } from 'express';
import db from '../db.js';
import { requireAuth, requireRole, type AuthRequest } from '../middleware/auth.js';

const router = Router();

const DAY_NAMES: Record<number, string> = {
  1: '周一', 2: '周二', 3: '周三', 4: '周四', 5: '周五', 6: '周六', 7: '周日',
};

const getCounselorIdByUserId = (userId: number): number | null => {
  const counselor: any = db.prepare('SELECT id FROM counselors WHERE user_id = ?').get(userId);
  return counselor ? counselor.id : null;
};

const resolveCounselorId = (req: AuthRequest): number | null => {
  if (req.user!.role === 'admin') {
    return Number(req.params.counselorId) || null;
  }
  if (req.user!.role === 'counselor') {
    return getCounselorIdByUserId(req.user!.id);
  }
  return null;
};

router.get('/:counselorId/schedules', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const counselorId = resolveCounselorId(req);
  if (!counselorId) {
    res.status(400).json({ success: false, error: '无法确定咨询师' });
    return;
  }
  const schedules = db.prepare(
    'SELECT * FROM counselor_schedules WHERE counselor_id = ? ORDER BY day_of_week, start_time'
  ).all(counselorId);
  res.json({ success: true, data: schedules });
});

router.post('/:counselorId/schedules', requireAuth, requireRole('admin', 'counselor'), async (req: AuthRequest, res: Response): Promise<void> => {
  const counselorId = resolveCounselorId(req);
  if (!counselorId) {
    res.status(400).json({ success: false, error: '无法确定咨询师' });
    return;
  }
  const { day_of_week, start_time, end_time } = req.body;
  if (!day_of_week || !start_time || !end_time) {
    res.status(400).json({ success: false, error: '缺少必要字段' });
    return;
  }
  if (day_of_week < 1 || day_of_week > 7) {
    res.status(400).json({ success: false, error: '星期值必须在1-7之间' });
    return;
  }
  if (start_time >= end_time) {
    res.status(400).json({ success: false, error: '开始时间必须早于结束时间' });
    return;
  }
  try {
    const result = db.prepare(
      'INSERT INTO counselor_schedules (counselor_id, day_of_week, start_time, end_time) VALUES (?, ?, ?, ?)'
    ).run(counselorId, day_of_week, start_time, end_time);
    const schedule = db.prepare('SELECT * FROM counselor_schedules WHERE id = ?').get(result.lastInsertRowid);
    res.json({ success: true, data: schedule });
  } catch (err: any) {
    if (err.message?.includes('UNIQUE')) {
      res.status(400).json({ success: false, error: '该时段已存在' });
      return;
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/:counselorId/schedules/:scheduleId', requireAuth, requireRole('admin', 'counselor'), async (req: AuthRequest, res: Response): Promise<void> => {
  const counselorId = resolveCounselorId(req);
  if (!counselorId) {
    res.status(400).json({ success: false, error: '无法确定咨询师' });
    return;
  }
  const existing = db.prepare('SELECT * FROM counselor_schedules WHERE id = ? AND counselor_id = ?').get(req.params.scheduleId, counselorId);
  if (!existing) {
    res.status(404).json({ success: false, error: '排班记录不存在' });
    return;
  }
  db.prepare('DELETE FROM counselor_schedules WHERE id = ?').run(req.params.scheduleId);
  res.json({ success: true });
});

router.put('/:counselorId/schedules/:scheduleId', requireAuth, requireRole('admin', 'counselor'), async (req: AuthRequest, res: Response): Promise<void> => {
  const counselorId = resolveCounselorId(req);
  if (!counselorId) {
    res.status(400).json({ success: false, error: '无法确定咨询师' });
    return;
  }
  const existing = db.prepare('SELECT * FROM counselor_schedules WHERE id = ? AND counselor_id = ?').get(req.params.scheduleId, counselorId);
  if (!existing) {
    res.status(404).json({ success: false, error: '排班记录不存在' });
    return;
  }
  const { day_of_week, start_time, end_time } = req.body;
  if (day_of_week !== undefined && (day_of_week < 1 || day_of_week > 7)) {
    res.status(400).json({ success: false, error: '星期值必须在1-7之间' });
    return;
  }
  if (start_time && end_time && start_time >= end_time) {
    res.status(400).json({ success: false, error: '开始时间必须早于结束时间' });
    return;
  }
  try {
    db.prepare(
      'UPDATE counselor_schedules SET day_of_week = ?, start_time = ?, end_time = ? WHERE id = ?'
    ).run(
      day_of_week || (existing as any).day_of_week,
      start_time || (existing as any).start_time,
      end_time || (existing as any).end_time,
      req.params.scheduleId
    );
    const schedule = db.prepare('SELECT * FROM counselor_schedules WHERE id = ?').get(req.params.scheduleId);
    res.json({ success: true, data: schedule });
  } catch (err: any) {
    if (err.message?.includes('UNIQUE')) {
      res.status(400).json({ success: false, error: '该时段已存在' });
      return;
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:counselorId/unavailable-dates', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const counselorId = resolveCounselorId(req);
  if (!counselorId) {
    res.status(400).json({ success: false, error: '无法确定咨询师' });
    return;
  }
  const dates = db.prepare(
    'SELECT * FROM counselor_unavailable_dates WHERE counselor_id = ? ORDER BY unavailable_date'
  ).all(counselorId);
  res.json({ success: true, data: dates });
});

router.post('/:counselorId/unavailable-dates', requireAuth, requireRole('admin', 'counselor'), async (req: AuthRequest, res: Response): Promise<void> => {
  const counselorId = resolveCounselorId(req);
  if (!counselorId) {
    res.status(400).json({ success: false, error: '无法确定咨询师' });
    return;
  }
  const { unavailable_date, reason } = req.body;
  if (!unavailable_date) {
    res.status(400).json({ success: false, error: '缺少日期' });
    return;
  }
  try {
    const result = db.prepare(
      'INSERT INTO counselor_unavailable_dates (counselor_id, unavailable_date, reason) VALUES (?, ?, ?)'
    ).run(counselorId, unavailable_date, reason || null);
    const record = db.prepare('SELECT * FROM counselor_unavailable_dates WHERE id = ?').get(result.lastInsertRowid);
    res.json({ success: true, data: record });
  } catch (err: any) {
    if (err.message?.includes('UNIQUE')) {
      res.status(400).json({ success: false, error: '该日期已设置为停诊' });
      return;
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/:counselorId/unavailable-dates/:dateId', requireAuth, requireRole('admin', 'counselor'), async (req: AuthRequest, res: Response): Promise<void> => {
  const counselorId = resolveCounselorId(req);
  if (!counselorId) {
    res.status(400).json({ success: false, error: '无法确定咨询师' });
    return;
  }
  const existing = db.prepare('SELECT * FROM counselor_unavailable_dates WHERE id = ? AND counselor_id = ?').get(req.params.dateId, counselorId);
  if (!existing) {
    res.status(404).json({ success: false, error: '停诊记录不存在' });
    return;
  }
  db.prepare('DELETE FROM counselor_unavailable_dates WHERE id = ?').run(req.params.dateId);
  res.json({ success: true });
});

router.get('/', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const { counselor_id } = req.query;
  if (!counselor_id) {
    res.status(400).json({ success: false, error: '缺少咨询师ID' });
    return;
  }
  const schedules = db.prepare(
    'SELECT * FROM counselor_schedules WHERE counselor_id = ? ORDER BY day_of_week, start_time'
  ).all(counselor_id);
  const unavailableDates = db.prepare(
    'SELECT * FROM counselor_unavailable_dates WHERE counselor_id = ? ORDER BY unavailable_date'
  ).all(counselor_id);
  res.json({ success: true, data: { schedules, unavailableDates } });
});

export default router;
