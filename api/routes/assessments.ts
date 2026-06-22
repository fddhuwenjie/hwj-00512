import { Router, type Response } from 'express';
import db from '../db.js';
import { requireAuth, requireRole, type AuthRequest } from '../middleware/auth.js';

const router = Router();

const PHQ9_LEVELS = [
  { max: 4, level: '无抑郁', risk: false },
  { max: 9, level: '轻度抑郁', risk: false },
  { max: 14, level: '中度抑郁', risk: false },
  { max: 19, level: '中重度抑郁', risk: true },
  { max: 27, level: '重度抑郁', risk: true },
];

const GAD7_LEVELS = [
  { max: 4, level: '无焦虑', risk: false },
  { max: 9, level: '轻度焦虑', risk: false },
  { max: 14, level: '中度焦虑', risk: false },
  { max: 21, level: '重度焦虑', risk: true },
];

const getLevel = (score: number, scaleType: string): { level: string; risk: boolean } => {
  const levels = scaleType === 'PHQ-9' ? PHQ9_LEVELS : GAD7_LEVELS;
  for (const item of levels) {
    if (score <= item.max) return { level: item.level, risk: item.risk };
  }
  return { level: levels[levels.length - 1].level, risk: levels[levels.length - 1].risk };
};

const getClientIdByUserId = (userId: number): number | null => {
  const client: any = db.prepare('SELECT id FROM clients WHERE user_id = ?').get(userId);
  return client ? client.id : null;
};

router.get('/scales', requireAuth, (_req: AuthRequest, res: Response): Promise<void> => {
  res.json({
    success: true,
    data: {
      'PHQ-9': {
        name: 'PHQ-9 抑郁自评量表',
        description: '过去两周内，您被以下问题困扰的频率？',
        questions: [
          '做事提不起劲或没有兴趣',
          '感到心情低落、沮丧或绝望',
          '入睡困难、睡不安稳或睡眠过多',
          '感觉疲倦或没有活力',
          '食欲不振或吃太多',
          '觉得自己很糟或觉得自己是失败者',
          '对事物专注有困难',
          '动作或说话速度缓慢到别人已经察觉，或正好相反——烦躁或坐立不安',
          '有不如死掉或用某种方式伤害自己的念头',
        ],
        options: ['完全没有', '几天', '一半以上时间', '几乎每天'],
        optionValues: [0, 1, 2, 3],
      },
      'GAD-7': {
        name: 'GAD-7 焦虑自评量表',
        description: '过去两周内，您被以下问题困扰的频率？',
        questions: [
          '感到紧张、焦虑或烦躁',
          '不能停止或控制担忧',
          '对各种各样的事情担忧过多',
          '难以放松',
          '非常焦躁以至于难以静坐',
          '变得容易烦恼或急躁',
          '感到似乎将有可怕的事情发生',
        ],
        options: ['完全没有', '几天', '一半以上时间', '几乎每天'],
        optionValues: [0, 1, 2, 3],
      },
    },
  });
  return Promise.resolve();
});

router.get('/', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const { scale_type, client_id } = req.query;
  let query = `
    SELECT a.*, cl.name as client_name
    FROM assessments a
    LEFT JOIN clients cl ON a.client_id = cl.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (req.user!.role === 'client') {
    const cId = getClientIdByUserId(req.user!.id);
    if (cId) {
      query += ' AND a.client_id = ?';
      params.push(cId);
    }
  } else if (client_id) {
    query += ' AND a.client_id = ?';
    params.push(client_id);
  }

  if (scale_type) {
    query += ' AND a.scale_type = ?';
    params.push(scale_type);
  }

  query += ' ORDER BY a.created_at DESC';
  const assessments = db.prepare(query).all(...params);
  res.json({ success: true, data: assessments });
});

router.get('/trend/:client_id', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const { scale_type } = req.query;
  let query = `
    SELECT id, scale_type, score, level, is_high_risk, created_at
    FROM assessments
    WHERE client_id = ?
  `;
  const params: any[] = [req.params.client_id];

  if (scale_type) {
    query += ' AND scale_type = ?';
    params.push(scale_type);
  }

  query += ' ORDER BY created_at ASC';
  const data = db.prepare(query).all(...params);
  res.json({ success: true, data });
});

router.get('/high_risk', requireAuth, requireRole('admin', 'counselor'), async (_req: AuthRequest, res: Response): Promise<void> => {
  const days = _req.query.days ? Number(_req.query.days) : 30;
  const assessments = db.prepare(`
    SELECT a.*, cl.name as client_name, cl.phone as client_phone
    FROM assessments a
    LEFT JOIN clients cl ON a.client_id = cl.id
    WHERE a.is_high_risk = 1
    AND a.created_at >= datetime('now', '-' || ? || ' days')
    ORDER BY a.created_at DESC
  `).all(days);
  res.json({ success: true, data: assessments });
});

router.post('/', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const { scale_type, answers, appointment_id } = req.body;

  if (!scale_type || !answers || !Array.isArray(answers)) {
    res.status(400).json({ success: false, error: '缺少必要字段' });
    return;
  }

  if (!['PHQ-9', 'GAD-7'].includes(scale_type)) {
    res.status(400).json({ success: false, error: '量表类型无效' });
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

  const score = answers.reduce((sum: number, v: number) => sum + (Number(v) || 0), 0);
  const { level, risk } = getLevel(score, scale_type);

  const stmt = db.prepare(
    'INSERT INTO assessments (client_id, appointment_id, scale_type, answers, score, level, is_high_risk) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  const result = stmt.run(
    clientId,
    appointment_id || null,
    scale_type,
    JSON.stringify(answers),
    score,
    level,
    risk ? 1 : 0
  );

  const assessment = db.prepare('SELECT * FROM assessments WHERE id = ?').get(result.lastInsertRowid);
  res.json({ success: true, data: { ...assessment as any, level, is_high_risk: risk } });
});

router.get('/:id', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const assessment: any = db.prepare(`
    SELECT a.*, cl.name as client_name
    FROM assessments a
    LEFT JOIN clients cl ON a.client_id = cl.id
    WHERE a.id = ?
  `).get(req.params.id);

  if (!assessment) {
    res.status(404).json({ success: false, error: '评估不存在' });
    return;
  }

  if (req.user!.role === 'client') {
    const clientId = getClientIdByUserId(req.user!.id);
    if (assessment.client_id !== clientId) {
      res.status(403).json({ success: false, error: '权限不足' });
      return;
    }
  }

  try {
    assessment.answers = JSON.parse(assessment.answers);
  } catch {}

  res.json({ success: true, data: assessment });
});

export default router;
