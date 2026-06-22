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

const getDayOfWeek = (dateStr: string): number => {
  const d = new Date(dateStr);
  const day = d.getDay();
  return day === 0 ? 7 : day;
};

const parseAvailableSlots = (raw: any): Array<{ day: number; dayName: string; slots: string[] }> => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  const result: Array<{ day: number; dayName: string; slots: string[] }> = [];
  const dayMap: Record<string, number> = {
    '周一': 1, '星期二': 2, '周二': 2, '星期三': 3, '周三': 3,
    '星期四': 4, '周四': 4, '星期五': 5, '周五': 5, '星期六': 6, '周六': 6, '星期日': 7, '周日': 7, '星期天': 7,
  };
  const parts = String(raw).split(/[,，;；]/);
  parts.forEach((p) => {
    const match = p.trim().match(/(周[一二三四五六日天]|星期[一二三四五六日天])\s*[:：]?\s*([\d\-:：,，、\s]+)/);
    if (match) {
      const dayName = match[1];
      const day = dayMap[dayName];
      if (day) {
        const timeStr = match[2].replace(/[：]/g, ':');
        const slots: string[] = [];
        const rangeMatch = timeStr.match(/(\d{1,2}:\d{2})\s*[-~至]\s*(\d{1,2}:\d{2})/g);
        if (rangeMatch) {
          rangeMatch.forEach((range) => {
            const [start, end] = range.split(/[-~至]/).map((s) => s.trim());
            const [sh, sm] = start.split(':').map(Number);
            const [eh, em] = end.split(':').map(Number);
            let curMin = sh * 60 + sm;
            const endMin = eh * 60 + em;
            while (curMin < endMin) {
              const h = Math.floor(curMin / 60);
              const m = curMin % 60;
              slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
              curMin += 60;
            }
          });
        } else {
          const explicitSlots = timeStr.split(/[,，、\s]+/).filter((s) => /^\d{1,2}:\d{2}$/.test(s.trim()));
          slots.push(...explicitSlots);
        }
        if (slots.length) {
          result.push({ day, dayName, slots });
        }
      }
    }
  });
  return result;
};

const isTimeInAvailableSlots = (
  availableSlots: Array<{ day: number; dayName: string; slots: string[] }>,
  dateStr: string,
  timeStr: string
): boolean => {
  if (availableSlots.length === 0) return true;
  const dayOfWeek = getDayOfWeek(dateStr);
  const dayConfig = availableSlots.find((d) => d.day === dayOfWeek);
  if (!dayConfig) return false;
  return dayConfig.slots.includes(timeStr);
};

const isTimeInCounselorSchedules = (counselorId: number, dateStr: string, timeStr: string): boolean => {
  const dayOfWeek = getDayOfWeek(dateStr);
  const schedules: any[] = db.prepare(
    'SELECT * FROM counselor_schedules WHERE counselor_id = ? AND day_of_week = ?'
  ).all(counselorId, dayOfWeek);
  if (schedules.length === 0) return false;
  return schedules.some((s) => timeStr >= s.start_time && timeStr < s.end_time);
};

const isDateUnavailable = (counselorId: number, dateStr: string): any | null => {
  return db.prepare(
    'SELECT * FROM counselor_unavailable_dates WHERE counselor_id = ? AND unavailable_date = ?'
  ).get(counselorId, dateStr);
};

const addAppointmentLog = (appointmentId: number, action: string, operatorId: number | null, operatorName: string | null, details: string | null) => {
  db.prepare(
    'INSERT INTO appointment_logs (appointment_id, action, operator_id, operator_name, details) VALUES (?, ?, ?, ?, ?)'
  ).run(appointmentId, action, operatorId, operatorName, details);
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

router.get('/:id/logs', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const appointment: any = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id);
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

  const logs = db.prepare(
    'SELECT * FROM appointment_logs WHERE appointment_id = ? ORDER BY created_at ASC'
  ).all(req.params.id);
  res.json({ success: true, data: logs });
});

router.post('/', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const { counselor_id, appointment_date, appointment_time, notes } = req.body;

  if (!counselor_id || !appointment_date || !appointment_time) {
    res.status(400).json({ success: false, error: '缺少必要字段' });
    return;
  }

  const counselor: any = db.prepare('SELECT * FROM counselors WHERE id = ?').get(counselor_id);
  if (!counselor) {
    res.status(404).json({ success: false, error: '咨询师不存在' });
    return;
  }

  if (!counselor.is_active) {
    res.status(400).json({ success: false, error: '该咨询师已停用，暂不可预约' });
    return;
  }

  const unavailableDate: any = isDateUnavailable(counselor_id, appointment_date);
  if (unavailableDate) {
    res.status(400).json({
      success: false,
      error: `该咨询师在 ${appointment_date} 临时停诊${unavailableDate.reason ? '，原因：' + unavailableDate.reason : ''}`,
    });
    return;
  }

  const hasScheduleRecords = db.prepare(
    'SELECT COUNT(*) as count FROM counselor_schedules WHERE counselor_id = ?'
  ).get(counselor_id) as any;

  if (hasScheduleRecords.count > 0) {
    if (!isTimeInCounselorSchedules(counselor_id, appointment_date, appointment_time)) {
      const dayOfWeek = getDayOfWeek(appointment_date);
      const dayName = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'][dayOfWeek];
      const daySchedules = db.prepare(
        'SELECT start_time, end_time FROM counselor_schedules WHERE counselor_id = ? AND day_of_week = ? ORDER BY start_time'
      ).all(counselor_id, dayOfWeek) as any[];
      if (daySchedules.length > 0) {
        const slotsStr = daySchedules.map((s) => `${s.start_time}-${s.end_time}`).join('、');
        res.status(400).json({
          success: false,
          error: `${dayName}该咨询师可预约时段为：${slotsStr}，所选时间 ${appointment_time} 不在可预约范围内`,
        });
      } else {
        const allSchedules = db.prepare(
          'SELECT DISTINCT day_of_week FROM counselor_schedules WHERE counselor_id = ? ORDER BY day_of_week'
        ).all(counselor_id) as any[];
        const dayNames = allSchedules.map((s) => ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'][s.day_of_week]);
        res.status(400).json({
          success: false,
          error: `${dayName}该咨询师不接待预约，可预约日：${dayNames.join('、')}`,
        });
      }
      return;
    }
  } else {
    const availableSlots = parseAvailableSlots(counselor.available_slots);
    if (!isTimeInAvailableSlots(availableSlots, appointment_date, appointment_time)) {
      const dayOfWeek = getDayOfWeek(appointment_date);
      const dayName = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'][dayOfWeek];
      const daySlots = availableSlots.find((d) => d.day === dayOfWeek);
      if (daySlots) {
        res.status(400).json({
          success: false,
          error: `${dayName}该咨询师可预约时段为：${daySlots.slots.join('、')}，所选时间 ${appointment_time} 不在可预约范围内`,
        });
      } else {
        res.status(400).json({
          success: false,
          error: `${dayName}该咨询师不接待预约，可预约日：${availableSlots.map((d) => d.dayName).join('、')}`,
        });
      }
      return;
    }
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
    res.status(400).json({ error: '该时段已被预约', success: false, conflict_intercepted: true });
    return;
  }

  const stmt = db.prepare(
    'INSERT INTO appointments (client_id, counselor_id, appointment_date, appointment_time, notes) VALUES (?, ?, ?, ?, ?)'
  );
  const result = stmt.run(clientId, counselor_id, appointment_date, appointment_time, notes || null);
  const appointment = db.prepare('SELECT * FROM appointments WHERE id = ?').get(result.lastInsertRowid);

  addAppointmentLog(
    result.lastInsertRowid as number,
    'created',
    req.user!.id,
    req.user!.name,
    `预约创建：${appointment_date} ${appointment_time}`
  );

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
  addAppointmentLog(Number(req.params.id), 'confirmed', req.user!.id, req.user!.name, '预约已确认');
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
  addAppointmentLog(Number(req.params.id), 'rejected', req.user!.id, req.user!.name, `预约已拒绝${reject_reason ? '，原因：' + reject_reason : ''}`);
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
  addAppointmentLog(Number(req.params.id), 'cancelled', req.user!.id, req.user!.name, `预约已取消${cancel_reason ? '，原因：' + cancel_reason : ''}`);
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
  addAppointmentLog(Number(req.params.id), 'confirmed', req.user!.id, req.user!.name, '预约已完成');
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

router.post('/:id/reschedule', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const { new_date, new_time, reason } = req.body;
  if (!new_date || !new_time) {
    res.status(400).json({ success: false, error: '缺少新日期或新时间' });
    return;
  }

  const appointment: any = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id);
  if (!appointment) {
    res.status(404).json({ success: false, error: '预约不存在' });
    return;
  }

  if (appointment.status !== 'pending' && appointment.status !== 'confirmed') {
    res.status(400).json({ success: false, error: '只能改期待确认或已确认的预约' });
    return;
  }

  if (req.user!.role === 'client') {
    const clientId = getClientIdByUserId(req.user!.id);
    if (appointment.client_id !== clientId) {
      res.status(403).json({ success: false, error: '权限不足' });
      return;
    }
  } else {
    res.status(403).json({ success: false, error: '只有来访者可以发起改期' });
    return;
  }

  if (new_date === appointment.appointment_date && new_time === appointment.appointment_time) {
    res.status(400).json({ success: false, error: '新时间与原时间相同' });
    return;
  }

  const counselor: any = db.prepare('SELECT * FROM counselors WHERE id = ?').get(appointment.counselor_id);
  if (!counselor || !counselor.is_active) {
    res.status(400).json({ success: false, error: '咨询师不可用' });
    return;
  }

  const unavailableDate: any = isDateUnavailable(appointment.counselor_id, new_date);
  if (unavailableDate) {
    res.status(400).json({
      success: false,
      error: `咨询师在 ${new_date} 临时停诊${unavailableDate.reason ? '，原因：' + unavailableDate.reason : ''}`,
    });
    return;
  }

  const hasScheduleRecords = db.prepare(
    'SELECT COUNT(*) as count FROM counselor_schedules WHERE counselor_id = ?'
  ).get(appointment.counselor_id) as any;

  if (hasScheduleRecords.count > 0) {
    if (!isTimeInCounselorSchedules(appointment.counselor_id, new_date, new_time)) {
      res.status(400).json({ success: false, error: '新时间不在咨询师可预约时段内' });
      return;
    }
  } else {
    const availableSlots = parseAvailableSlots(counselor.available_slots);
    if (!isTimeInAvailableSlots(availableSlots, new_date, new_time)) {
      res.status(400).json({ success: false, error: '新时间不在咨询师可预约时段内' });
      return;
    }
  }

  const conflict: any = db.prepare(`
    SELECT id FROM appointments
    WHERE counselor_id = ? AND appointment_date = ? AND appointment_time = ?
    AND status NOT IN ('cancelled', 'no_show') AND id != ?
  `).get(appointment.counselor_id, new_date, new_time, appointment.id);

  if (conflict) {
    res.status(400).json({ success: false, error: '新时段已被预约', conflict_intercepted: true });
    return;
  }

  const clientId = getClientIdByUserId(req.user!.id);

  const result = db.prepare(
    `INSERT INTO reschedule_requests (appointment_id, client_id, counselor_id, original_date, original_time, new_date, new_time, reason)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    appointment.id, clientId, appointment.counselor_id,
    appointment.appointment_date, appointment.appointment_time,
    new_date, new_time, reason || null
  );

  addAppointmentLog(
    appointment.id,
    'reschedule_requested',
    req.user!.id,
    req.user!.name,
    `申请改期：${appointment.appointment_date} ${appointment.appointment_time} → ${new_date} ${new_time}${reason ? '，原因：' + reason : ''}`
  );

  const rescheduleRequest = db.prepare('SELECT * FROM reschedule_requests WHERE id = ?').get(result.lastInsertRowid);
  res.json({ success: true, data: rescheduleRequest });
});

router.get('/:id/reschedule-requests', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const appointment: any = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id);
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

  const requests = db.prepare(
    'SELECT * FROM reschedule_requests WHERE appointment_id = ? ORDER BY created_at DESC'
  ).all(req.params.id);
  res.json({ success: true, data: requests });
});

router.put('/reschedule/:requestId/approve', requireAuth, requireRole('admin', 'counselor'), async (req: AuthRequest, res: Response): Promise<void> => {
  const { review_note } = req.body;
  const rescheduleRequest: any = db.prepare('SELECT * FROM reschedule_requests WHERE id = ?').get(req.params.requestId);
  if (!rescheduleRequest) {
    res.status(404).json({ success: false, error: '改期申请不存在' });
    return;
  }
  if (rescheduleRequest.status !== 'pending') {
    res.status(400).json({ success: false, error: '该改期申请已处理' });
    return;
  }

  const appointment: any = db.prepare('SELECT * FROM appointments WHERE id = ?').get(rescheduleRequest.appointment_id);
  if (!appointment) {
    res.status(404).json({ success: false, error: '预约不存在' });
    return;
  }

  const unavailableDate: any = isDateUnavailable(appointment.counselor_id, rescheduleRequest.new_date);
  if (unavailableDate) {
    res.status(400).json({
      success: false,
      error: `咨询师在 ${rescheduleRequest.new_date} 临时停诊，无法批准改期`,
    });
    return;
  }

  const conflict: any = db.prepare(`
    SELECT id FROM appointments
    WHERE counselor_id = ? AND appointment_date = ? AND appointment_time = ?
    AND status NOT IN ('cancelled', 'no_show') AND id != ?
  `).get(appointment.counselor_id, rescheduleRequest.new_date, rescheduleRequest.new_time, appointment.id);

  if (conflict) {
    res.status(400).json({ success: false, error: '新时段已被其他预约占用，无法批准改期' });
    return;
  }

  const transaction = db.transaction(() => {
    db.prepare(
      'UPDATE reschedule_requests SET status = ?, reviewer_id = ?, reviewer_name = ?, review_note = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).run('approved', req.user!.id, req.user!.name, review_note || null, req.params.requestId);

    db.prepare(
      'UPDATE appointments SET appointment_date = ?, appointment_time = ? WHERE id = ?'
    ).run(rescheduleRequest.new_date, rescheduleRequest.new_time, appointment.id);

    addAppointmentLog(
      appointment.id,
      'reschedule_approved',
      req.user!.id,
      req.user!.name,
      `改期已批准：${rescheduleRequest.original_date} ${rescheduleRequest.original_time} → ${rescheduleRequest.new_date} ${rescheduleRequest.new_time}${review_note ? '，审批备注：' + review_note : ''}`
    );
  });

  transaction();
  const updated = db.prepare('SELECT * FROM appointments WHERE id = ?').get(appointment.id);
  res.json({ success: true, data: updated });
});

router.put('/reschedule/:requestId/reject', requireAuth, requireRole('admin', 'counselor'), async (req: AuthRequest, res: Response): Promise<void> => {
  const { review_note } = req.body;
  const rescheduleRequest: any = db.prepare('SELECT * FROM reschedule_requests WHERE id = ?').get(req.params.requestId);
  if (!rescheduleRequest) {
    res.status(404).json({ success: false, error: '改期申请不存在' });
    return;
  }
  if (rescheduleRequest.status !== 'pending') {
    res.status(400).json({ success: false, error: '该改期申请已处理' });
    return;
  }

  const appointment: any = db.prepare('SELECT * FROM appointments WHERE id = ?').get(rescheduleRequest.appointment_id);

  db.prepare(
    'UPDATE reschedule_requests SET status = ?, reviewer_id = ?, reviewer_name = ?, review_note = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).run('rejected', req.user!.id, req.user!.name, review_note || null, req.params.requestId);

  addAppointmentLog(
    rescheduleRequest.appointment_id,
    'reschedule_rejected',
    req.user!.id,
    req.user!.name,
    `改期已拒绝：${rescheduleRequest.original_date} ${rescheduleRequest.original_time} → ${rescheduleRequest.new_date} ${rescheduleRequest.new_time}${review_note ? '，拒绝备注：' + review_note : ''}`
  );

  const updated = db.prepare('SELECT * FROM appointments WHERE id = ?').get(appointment?.id || rescheduleRequest.appointment_id);
  res.json({ success: true, data: updated });
});

router.get('/reschedule/pending', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  let query = `
    SELECT rr.*, a.appointment_date as current_date, a.appointment_time as current_time, a.status as appointment_status,
           c.name as counselor_name, cl.name as client_name
    FROM reschedule_requests rr
    LEFT JOIN appointments a ON rr.appointment_id = a.id
    LEFT JOIN counselors c ON rr.counselor_id = c.id
    LEFT JOIN clients cl ON rr.client_id = cl.id
    WHERE rr.status = 'pending'
  `;
  const params: any[] = [];

  if (req.user!.role === 'counselor') {
    const counselorId = getCounselorIdByUserId(req.user!.id);
    if (counselorId) {
      query += ' AND rr.counselor_id = ?';
      params.push(counselorId);
    }
  } else if (req.user!.role === 'client') {
    const clientId = getClientIdByUserId(req.user!.id);
    if (clientId) {
      query += ' AND rr.client_id = ?';
      params.push(clientId);
    }
  }

  query += ' ORDER BY rr.created_at DESC';
  const requests = db.prepare(query).all(...params);
  res.json({ success: true, data: requests });
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
