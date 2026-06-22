import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Badge, getStatusConfig } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Plus, CalendarCheck, XCircle, Ban, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';

const TIME_SLOTS = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00',
];

export default function Appointments() {
  const { user } = useAuthStore();
  const isClient = user?.role === 'client';
  const isCounselor = user?.role === 'counselor';
  const isAdmin = user?.role === 'admin';
  const canManage = isAdmin || isCounselor;

  const [appointments, setAppointments] = useState<any[]>([]);
  const [counselors, setCounselors] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ counselor_id: '', appointment_date: '', appointment_time: '', notes: '' });

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState('');

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<any>(null);
  const [cancelReason, setCancelReason] = useState('');

  const loadAppointments = async () => {
    setLoading(true);
    const params: any = {};
    if (statusFilter) params.status = statusFilter;
    const res = await api.appointments.list(params);
    if (res.success && res.data) setAppointments(res.data);
    setLoading(false);
  };

  const loadCounselors = async () => {
    const res = await api.counselors.list({ is_active: true });
    if (res.success && res.data) setCounselors(res.data);
  };

  useEffect(() => {
    loadAppointments();
    if (isClient) loadCounselors();
  }, [statusFilter]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.counselor_id || !createForm.appointment_date || !createForm.appointment_time) {
      alert('请填写完整信息');
      return;
    }
    const res = await api.appointments.create(createForm);
    if (res.success) {
      setCreateOpen(false);
      setCreateForm({ counselor_id: '', appointment_date: '', appointment_time: '', notes: '' });
      loadAppointments();
    } else {
      alert(res.error || '预约失败');
    }
  };

  const handleConfirm = async (id: number) => {
    const res = await api.appointments.confirm(id);
    if (res.success) loadAppointments();
  };

  const handleReject = () => {
    if (!rejectTarget) return;
    api.appointments.reject(rejectTarget.id, { reject_reason: rejectReason }).then((res) => {
      if (res.success) {
        setRejectOpen(false);
        setRejectTarget(null);
        setRejectReason('');
        loadAppointments();
      }
    });
  };

  const handleCancel = () => {
    if (!cancelTarget) return;
    api.appointments.cancel(cancelTarget.id, { cancel_reason: cancelReason }).then((res) => {
      if (res.success) {
        setCancelOpen(false);
        setCancelTarget(null);
        setCancelReason('');
        loadAppointments();
      }
    });
  };

  const handleComplete = async (id: number) => {
    const res = await api.appointments.complete(id);
    if (res.success) loadAppointments();
  };

  const handleNoShow = async (id: number) => {
    const res = await api.appointments.noShow(id);
    if (res.success) loadAppointments();
  };

  if (loading) return <div className="text-center py-12">加载中...</div>;

  const statusOptions = [
    { value: '', label: '全部状态' },
    { value: 'pending', label: '待确认' },
    { value: 'confirmed', label: '已确认' },
    { value: 'completed', label: '已完成' },
    { value: 'cancelled', label: '已取消' },
    { value: 'no_show', label: '爽约' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold">{isClient ? '我的预约' : '预约管理'}</h1>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={statusOptions}
            className="sm:w-40"
          />
          {isClient && (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              新建预约
            </Button>
          )}
        </div>
      </div>

      {appointments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            暂无预约记录
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left py-3 px-4 font-medium text-gray-600">日期</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">时间</th>
                    {!isClient && <th className="text-left py-3 px-4 font-medium text-gray-600">来访者</th>}
                    {!isCounselor && <th className="text-left py-3 px-4 font-medium text-gray-600">咨询师</th>}
                    <th className="text-left py-3 px-4 font-medium text-gray-600">状态</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {appointments.map((apt) => {
                    const cfg = getStatusConfig(apt.status);
                    return (
                      <tr key={apt.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4">{apt.appointment_date}</td>
                        <td className="py-3 px-4">{apt.appointment_time}</td>
                        {!isClient && <td className="py-3 px-4">{apt.client_name}</td>}
                        {!isCounselor && <td className="py-3 px-4">{apt.counselor_name}</td>}
                        <td className="py-3 px-4">
                          <Badge variant={cfg.variant}>{cfg.label}</Badge>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1">
                            {apt.status === 'pending' && canManage && (
                              <>
                                <Button size="sm" variant="primary" onClick={() => handleConfirm(apt.id)}>
                                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                                  确认
                                </Button>
                                <Button size="sm" variant="danger" onClick={() => { setRejectTarget(apt); setRejectOpen(true); }}>
                                  <XCircle className="w-3.5 h-3.5 mr-1" />
                                  拒绝
                                </Button>
                              </>
                            )}
                            {apt.status === 'confirmed' && canManage && (
                              <>
                                <Button size="sm" variant="primary" onClick={() => handleComplete(apt.id)}>
                                  <CalendarCheck className="w-3.5 h-3.5 mr-1" />
                                  完成
                                </Button>
                                <Button size="sm" variant="danger" onClick={() => handleNoShow(apt.id)}>
                                  <Clock className="w-3.5 h-3.5 mr-1" />
                                  爽约
                                </Button>
                              </>
                            )}
                            {apt.status !== 'completed' && apt.status !== 'cancelled' && apt.status !== 'no_show' && (
                              <Button size="sm" variant="secondary" onClick={() => { setCancelTarget(apt); setCancelOpen(true); }}>
                                <Ban className="w-3.5 h-3.5 mr-1" />
                                取消
                              </Button>
                            )}
                            {apt.cancel_reason && (
                              <span className="text-xs text-gray-500 flex items-center">
                                <AlertTriangle className="w-3 h-3 mr-1" />
                                原因: {apt.cancel_reason}
                              </span>
                            )}
                            {apt.reject_reason && (
                              <span className="text-xs text-gray-500 flex items-center">
                                <AlertTriangle className="w-3 h-3 mr-1" />
                                拒绝: {apt.reject_reason}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="新建预约">
        <form onSubmit={handleCreate} className="space-y-4">
          <Select
            label="选择咨询师"
            value={createForm.counselor_id}
            onChange={(e) => setCreateForm({ ...createForm, counselor_id: e.target.value })}
            options={[
              { value: '', label: '请选择咨询师' },
              ...counselors.map((c) => ({ value: String(c.id), label: `${c.name} - ${c.qualification}` })),
            ]}
            required
          />
          <Input
            label="预约日期"
            type="date"
            value={createForm.appointment_date}
            onChange={(e) => setCreateForm({ ...createForm, appointment_date: e.target.value })}
            required
          />
          <Select
            label="预约时段"
            value={createForm.appointment_time}
            onChange={(e) => setCreateForm({ ...createForm, appointment_time: e.target.value })}
            options={[
              { value: '', label: '请选择时段' },
              ...TIME_SLOTS.map((t) => ({ value: t, label: t })),
            ]}
            required
          />
          <Textarea
            label="备注（可选）"
            value={createForm.notes}
            onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
            rows={2}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>取消</Button>
            <Button type="submit">提交预约</Button>
          </div>
        </form>
      </Modal>

      <Modal open={rejectOpen} onClose={() => setRejectOpen(false)} title="拒绝预约">
        <div className="space-y-4">
          <Textarea
            label="拒绝原因"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={3}
            placeholder="请填写拒绝原因..."
          />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setRejectOpen(false)}>取消</Button>
            <Button variant="danger" onClick={handleReject}>确认拒绝</Button>
          </div>
        </div>
      </Modal>

      <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title="取消预约">
        <div className="space-y-4">
          <Textarea
            label="取消原因"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            rows={3}
            placeholder="请填写取消原因..."
          />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setCancelOpen(false)}>返回</Button>
            <Button variant="danger" onClick={handleCancel}>确认取消</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
