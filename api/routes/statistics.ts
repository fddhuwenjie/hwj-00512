import { Router, type Response } from 'express';
import db from '../db.js';
import { requireAuth, requireRole, type AuthRequest } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, requireRole('admin', 'counselor'), async (_req: AuthRequest, res: Response): Promise<void> => {
  const totalAppointments = (db.prepare('SELECT COUNT(*) as count FROM appointments').get() as any).count;
  const completedAppointments = (db.prepare("SELECT COUNT(*) as count FROM appointments WHERE status = 'completed'").get() as any).count;
  const cancelledAppointments = (db.prepare("SELECT COUNT(*) as count FROM appointments WHERE status = 'cancelled'").get() as any).count;
  const noShowAppointments = (db.prepare("SELECT COUNT(*) as count FROM appointments WHERE status = 'no_show'").get() as any).count;
  const pendingAppointments = (db.prepare("SELECT COUNT(*) as count FROM appointments WHERE status = 'pending'").get() as any).count;
  const confirmedAppointments = (db.prepare("SELECT COUNT(*) as count FROM appointments WHERE status = 'confirmed'").get() as any).count;

  const completionRate = totalAppointments > 0 ? Math.round((completedAppointments / totalAppointments) * 100) : 0;
  const cancelRate = totalAppointments > 0 ? Math.round((cancelledAppointments / totalAppointments) * 100) : 0;
  const noShowRate = totalAppointments > 0 ? Math.round((noShowAppointments / totalAppointments) * 100) : 0;

  const counselorWorkload = db.prepare(`
    SELECT c.id, c.name,
           COUNT(a.id) as total_appointments,
           SUM(CASE WHEN a.status = 'completed' THEN 1 ELSE 0 END) as completed_appointments
    FROM counselors c
    LEFT JOIN appointments a ON c.id = a.counselor_id
    GROUP BY c.id, c.name
    ORDER BY total_appointments DESC
  `).all();

  const allSpecialties: any[] = db.prepare('SELECT specialties FROM counselors WHERE specialties IS NOT NULL AND specialties != ""').all();
  const specialtyCounts: Record<string, number> = {};
  allSpecialties.forEach((row) => {
    const specialties = String(row.specialties || '').split(/[,，]/).map(s => s.trim()).filter(Boolean);
    specialties.forEach(s => {
      specialtyCounts[s] = (specialtyCounts[s] || 0) + 1;
    });
  });
  const specialtyDistribution = Object.entries(specialtyCounts).map(([name, count]) => ({ name, count }));

  const scaleDistribution = db.prepare(`
    SELECT scale_type, level, COUNT(*) as count
    FROM assessments
    GROUP BY scale_type, level
    ORDER BY scale_type, level
  `).all();

  const highRisk30Days = db.prepare(`
    SELECT a.*, cl.name as client_name, cl.phone as client_phone
    FROM assessments a
    LEFT JOIN clients cl ON a.client_id = cl.id
    WHERE a.is_high_risk = 1
    AND a.created_at >= datetime('now', '-30 days')
    ORDER BY a.created_at DESC
  `).all();

  const recentAppointments = db.prepare(`
    SELECT a.*, c.name as counselor_name, cl.name as client_name
    FROM appointments a
    LEFT JOIN counselors c ON a.counselor_id = c.id
    LEFT JOIN clients cl ON a.client_id = cl.id
    ORDER BY a.created_at DESC
    LIMIT 10
  `).all();

  const clientCount = (db.prepare('SELECT COUNT(*) as count FROM clients').get() as any).count;
  const counselorCount = (db.prepare('SELECT COUNT(*) as count FROM counselors').get() as any).count;
  const totalAssessments = (db.prepare('SELECT COUNT(*) as count FROM assessments').get() as any).count;

  res.json({
    success: true,
    data: {
      overview: {
        totalAppointments,
        completedAppointments,
        cancelledAppointments,
        noShowAppointments,
        pendingAppointments,
        confirmedAppointments,
        completionRate,
        cancelRate,
        noShowRate,
        clientCount,
        counselorCount,
        totalAssessments,
      },
      counselorWorkload,
      specialtyDistribution,
      scaleDistribution,
      highRisk30Days,
      recentAppointments,
    },
  });
});

export default router;
