import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, getStatusConfig } from '@/components/ui/Badge';
import { CalendarCheck, ClipboardList, Users, UserCircle, AlertTriangle } from 'lucide-react';

export default function Home() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>(null);
  const [recentAppointments, setRecentAppointments] = useState<any[]>([]);
  const [highRisk, setHighRisk] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      if (user?.role === 'admin' || user?.role === 'counselor') {
        const [statsRes, riskRes] = await Promise.all([
          api.statistics.overview(),
          api.assessments.highRisk(30),
        ]);
        if (statsRes.success && statsRes.data) {
          setStats(statsRes.data.overview);
          setRecentAppointments(statsRes.data.recentAppointments || []);
        }
        if (riskRes.success && riskRes.data) {
          setHighRisk(riskRes.data);
        }
      } else {
        const aptRes = await api.appointments.list();
        if (aptRes.success && aptRes.data) {
          setRecentAppointments(aptRes.data.slice(0, 5));
        }
      }
      setLoading(false);
    };
    loadData();
  }, [user]);

  if (loading) {
    return <div className="text-center py-12">加载中...</div>;
  }

  const isStaff = user?.role === 'admin' || user?.role === 'counselor';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          欢迎回来，{user?.name}
        </h1>
        <p className="text-gray-600 mt-1">
          {user?.role === 'admin' && '系统管理员 - 管理咨询师、来访者和查看统计数据'}
          {user?.role === 'counselor' && '咨询师工作台 - 管理预约、填写咨询记录'}
          {user?.role === 'client' && '来访者中心 - 预约咨询、进行量表评估'}
        </p>
      </div>

      {isStaff && stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <CalendarCheck className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">总预约</p>
                  <p className="text-2xl font-bold">{stats.totalAppointments}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Users className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">完成率</p>
                  <p className="text-2xl font-bold">{stats.completionRate}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <UserCircle className="w-5 h-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">来访者数</p>
                  <p className="text-2xl font-bold">{stats.clientCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <ClipboardList className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">评估总数</p>
                  <p className="text-2xl font-bold">{stats.totalAssessments}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {isStaff && highRisk.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <CardTitle className="text-red-800">高风险评估提醒（近30天）</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {highRisk.slice(0, 5).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 bg-white rounded-lg"
                >
                  <div>
                    <p className="font-medium">{item.client_name}</p>
                    <p className="text-sm text-gray-500">
                      {item.scale_type} - {item.level}（{item.score}分）
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">{item.client_phone}</p>
                    <p className="text-xs text-gray-400">{new Date(item.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {user?.role === 'client' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/appointments')}>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 rounded-xl">
                  <CalendarCheck className="w-8 h-8 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">预约咨询</h3>
                  <p className="text-sm text-gray-500">选择咨询师和时段进行预约</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/assessments')}>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-100 rounded-xl">
                  <ClipboardList className="w-8 h-8 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">量表评估</h3>
                  <p className="text-sm text-gray-500">完成 PHQ-9 / GAD-7 自评量表</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{isStaff ? '最近预约' : '我的预约'}</CardTitle>
          <Button size="sm" variant="ghost" onClick={() => navigate('/appointments')}>
            查看全部
          </Button>
        </CardHeader>
        <CardContent>
          {recentAppointments.length === 0 ? (
            <p className="text-center text-gray-500 py-8">暂无预约记录</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-2 font-medium text-gray-600">日期</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-600">时间</th>
                    {isStaff && <th className="text-left py-3 px-2 font-medium text-gray-600">来访者</th>}
                    {user?.role === 'client' && <th className="text-left py-3 px-2 font-medium text-gray-600">咨询师</th>}
                    <th className="text-left py-3 px-2 font-medium text-gray-600">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {recentAppointments.slice(0, 5).map((apt) => {
                    const statusCfg = getStatusConfig(apt.status);
                    return (
                      <tr key={apt.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-2">{apt.appointment_date}</td>
                        <td className="py-3 px-2">{apt.appointment_time}</td>
                        <td className="py-3 px-2">{isStaff ? apt.client_name : apt.counselor_name}</td>
                        <td className="py-3 px-2">
                          <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
