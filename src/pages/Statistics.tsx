import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import {
  CalendarCheck, Users, UserCircle, ClipboardList, XCircle, AlertTriangle, Clock, BarChart3, PieChart, TrendingUp, RefreshCw, Shield, CalendarOff
} from 'lucide-react';

export default function Statistics() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const res = await api.statistics.overview();
      if (res.success && res.data) setData(res.data);
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <div className="text-center py-12">加载中...</div>;

  const { overview, counselorWorkload, specialtyDistribution, scaleDistribution, highRisk30Days, recentAppointments,
    counselorUtilization, rescheduleStats, conflictIntercepted, unavailableDateImpact, totalUnavailableImpact } = data || {};

  const StatCard = ({ icon: Icon, label, value, color, sub }: any) => (
    <Card>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg bg-${color}-100`}>
            <Icon className={`w-5 h-5 text-${color}-600`} />
          </div>
          <div>
            <p className="text-sm text-gray-500">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
            {sub && <p className="text-xs text-gray-400">{sub}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <BarChart3 className="w-7 h-7 text-blue-600" />
        统计报表
      </h1>

      {overview && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={CalendarCheck} label="总预约数" value={overview.totalAppointments} color="blue" />
          <StatCard icon={TrendingUp} label="完成率" value={`${overview.completionRate}%`} color="green" sub={`已完成 ${overview.completedAppointments} 次`} />
          <StatCard icon={XCircle} label="取消率" value={`${overview.cancelRate}%`} color="orange" sub={`已取消 ${overview.cancelledAppointments} 次`} />
          <StatCard icon={Clock} label="爽约率" value={`${overview.noShowRate}%`} color="red" sub={`爽约 ${overview.noShowAppointments} 次`} />
          <StatCard icon={UserCircle} label="来访者总数" value={overview.clientCount} color="purple" />
          <StatCard icon={Users} label="咨询师总数" value={overview.counselorCount} color="cyan" />
          <StatCard icon={ClipboardList} label="量表评估总数" value={overview.totalAssessments} color="indigo" />
          <StatCard icon={AlertTriangle} label="待确认预约" value={overview.pendingAppointments} color="yellow" />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={RefreshCw} label="改期总次数" value={rescheduleStats?.total || 0} color="orange" sub={`待处理 ${rescheduleStats?.pending || 0} 条`} />
        <StatCard icon={Shield} label="冲突拦截次数" value={conflictIntercepted || 0} color="red" sub="预约时段冲突被拦截" />
        <StatCard icon={CalendarOff} label="停诊影响预约" value={totalUnavailableImpact || 0} color="amber" sub="临时停诊影响的预约数" />
        <StatCard icon={TrendingUp} label="改期通过率" value={
          rescheduleStats?.total > 0
            ? `${Math.round((rescheduleStats.approved / rescheduleStats.total) * 100)}%`
            : '0%'
        } color="green" sub={`通过 ${rescheduleStats?.approved || 0} / 拒绝 ${rescheduleStats?.rejected || 0}`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              咨询师工作量
            </CardTitle>
          </CardHeader>
          <CardContent>
            {counselorWorkload?.length ? (
              <div className="space-y-3">
                {counselorWorkload.map((c: any) => {
                  const pct = c.total_appointments > 0 ? Math.round((c.completed_appointments / c.total_appointments) * 100) : 0;
                  return (
                    <div key={c.id}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm">{c.name}</span>
                        <span className="text-xs text-gray-500">
                          完成 {c.completed_appointments}/{c.total_appointments} ({pct}%)
                        </span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-center text-gray-500 py-6">暂无数据</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-purple-600" />
              咨询师时段利用率
            </CardTitle>
          </CardHeader>
          <CardContent>
            {counselorUtilization?.length ? (
              <div className="space-y-3">
                {counselorUtilization.map((c: any) => (
                  <div key={c.id}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm">{c.name}</span>
                      <span className="text-xs text-gray-500">
                        已预约 {c.booked_appointments} / 排班 {c.total_schedule_slots} ({c.utilization_rate}%)
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${c.utilization_rate > 70 ? 'bg-green-500' : c.utilization_rate > 40 ? 'bg-yellow-500' : 'bg-red-400'}`}
                        style={{ width: `${Math.min(c.utilization_rate, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-500 py-6">暂无数据</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-orange-600" />
              改期统计
            </CardTitle>
          </CardHeader>
          <CardContent>
            {rescheduleStats && rescheduleStats.total > 0 ? (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <p className="text-2xl font-bold text-green-600">{rescheduleStats.approved}</p>
                    <p className="text-xs text-gray-500">已通过</p>
                  </div>
                  <div className="text-center p-3 bg-red-50 rounded-lg">
                    <p className="text-2xl font-bold text-red-600">{rescheduleStats.rejected}</p>
                    <p className="text-xs text-gray-500">已拒绝</p>
                  </div>
                  <div className="text-center p-3 bg-orange-50 rounded-lg">
                    <p className="text-2xl font-bold text-orange-600">{rescheduleStats.pending}</p>
                    <p className="text-xs text-gray-500">待处理</p>
                  </div>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden flex">
                  {rescheduleStats.approved > 0 && (
                    <div className="h-full bg-green-500" style={{ width: `${(rescheduleStats.approved / rescheduleStats.total) * 100}%` }} />
                  )}
                  {rescheduleStats.rejected > 0 && (
                    <div className="h-full bg-red-400" style={{ width: `${(rescheduleStats.rejected / rescheduleStats.total) * 100}%` }} />
                  )}
                  {rescheduleStats.pending > 0 && (
                    <div className="h-full bg-orange-400" style={{ width: `${(rescheduleStats.pending / rescheduleStats.total) * 100}%` }} />
                  )}
                </div>
              </div>
            ) : (
              <p className="text-center text-gray-500 py-6">暂无改期记录</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarOff className="w-5 h-5 text-amber-600" />
              临时停诊影响
            </CardTitle>
          </CardHeader>
          <CardContent>
            {unavailableDateImpact?.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-amber-50">
                      <th className="text-left py-2 px-3 font-medium text-gray-700">咨询师</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-700">停诊日期</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-700">原因</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-700">影响预约</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unavailableDateImpact.map((r: any) => (
                      <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2 px-3">{r.counselor_name}</td>
                        <td className="py-2 px-3">{r.unavailable_date}</td>
                        <td className="py-2 px-3 text-gray-500">{r.reason || '-'}</td>
                        <td className="py-2 px-3">
                          <Badge variant={r.affected_appointments > 0 ? 'danger' : 'success'}>
                            {r.affected_appointments}个
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-center text-gray-500 py-6">暂无临时停诊记录</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChart className="w-5 h-5 text-green-600" />
            擅长方向分布
          </CardTitle>
        </CardHeader>
        <CardContent>
          {specialtyDistribution?.length ? (
            <div className="space-y-3">
              {(() => {
                const max = Math.max(...specialtyDistribution.map((s: any) => s.count));
                return specialtyDistribution.map((s: any) => {
                  const pct = max > 0 ? Math.round((s.count / max) * 100) : 0;
                  return (
                    <div key={s.name}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm">{s.name}</span>
                        <span className="text-xs text-gray-500">{s.count} 位咨询师</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          ) : (
            <p className="text-center text-gray-500 py-6">暂无数据</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-purple-600" />
            量表等级分布
          </CardTitle>
        </CardHeader>
        <CardContent>
          {scaleDistribution?.length ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {['PHQ-9', 'GAD-7'].map((scale) => {
                const items = scaleDistribution.filter((s: any) => s.scale_type === scale);
                const total = items.reduce((acc: number, s: any) => acc + s.count, 0);
                return (
                  <div key={scale}>
                    <h4 className="font-medium mb-3">{scale}（共 {total} 份）</h4>
                    <div className="space-y-2">
                      {items.length ? items.map((s: any) => {
                        const pct = total > 0 ? Math.round((s.count / total) * 100) : 0;
                        const isRisk = s.level.includes('重度') || s.level.includes('中重度');
                        return (
                          <div key={s.level} className="flex items-center gap-3">
                            <span className="w-20 text-sm shrink-0">{s.level}</span>
                            <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${isRisk ? 'bg-red-400' : 'bg-blue-400'}`} style={{ width: `${pct}%` }} />
                            </div>
                            <span className="w-16 text-right text-sm text-gray-600">{s.count} ({pct}%)</span>
                          </div>
                        );
                      }) : <p className="text-sm text-gray-400">暂无数据</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-center text-gray-500 py-6">暂无数据</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            近30天高风险评估（{highRisk30Days?.length || 0}条）
          </CardTitle>
        </CardHeader>
        <CardContent>
          {highRisk30Days?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-red-50">
                    <th className="text-left py-3 px-4 font-medium text-gray-700">来访者</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">联系电话</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">量表</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">分数</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">等级</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">评估时间</th>
                  </tr>
                </thead>
                <tbody>
                  {highRisk30Days.map((a: any) => (
                    <tr key={a.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium">{a.client_name}</td>
                      <td className="py-3 px-4">{a.client_phone || '-'}</td>
                      <td className="py-3 px-4">{a.scale_type}</td>
                      <td className="py-3 px-4 font-bold text-red-600">{a.score}分</td>
                      <td className="py-3 px-4"><Badge variant="danger">{a.level}</Badge></td>
                      <td className="py-3 px-4 text-gray-500">{new Date(a.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center text-gray-500 py-6">近30天暂无高风险评估</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarCheck className="w-5 h-5 text-blue-600" />
            最近预约
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentAppointments?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left py-3 px-4 font-medium text-gray-600">日期</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">时间</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">来访者</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">咨询师</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {recentAppointments.slice(0, 10).map((a: any) => {
                    const statusMap: Record<string, any> = {
                      pending: { variant: 'warning', label: '待确认' },
                      confirmed: { variant: 'info', label: '已确认' },
                      completed: { variant: 'success', label: '已完成' },
                      cancelled: { variant: 'default', label: '已取消' },
                      no_show: { variant: 'danger', label: '爽约' },
                    };
                    const cfg = statusMap[a.status] || { variant: 'default', label: a.status };
                    return (
                      <tr key={a.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4">{a.appointment_date}</td>
                        <td className="py-3 px-4">{a.appointment_time}</td>
                        <td className="py-3 px-4">{a.client_name}</td>
                        <td className="py-3 px-4">{a.counselor_name}</td>
                        <td className="py-3 px-4"><Badge variant={cfg.variant}>{cfg.label}</Badge></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center text-gray-500 py-6">暂无预约</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
