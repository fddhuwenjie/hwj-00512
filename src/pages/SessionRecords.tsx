import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Plus, Pencil, FileText, Eye, Lock } from 'lucide-react';

export default function SessionRecords() {
  const { user } = useAuthStore();
  const isClient = user?.role === 'client';
  const canCreate = user?.role === 'admin' || user?.role === 'counselor';

  const [records, setRecords] = useState<any[]>([]);
  const [completedAppointments, setCompletedAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [viewing, setViewing] = useState<any>(null);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    appointment_id: '',
    summary: '',
    interventions: '',
    next_plan: '',
    confidentiality_level: 'standard',
    attachment_url: '',
  });

  const loadRecords = async () => {
    setLoading(true);
    const res = await api.sessionRecords.list();
    if (res.success && res.data) setRecords(res.data);
    setLoading(false);
  };

  const loadAppointments = async () => {
    const res = await api.appointments.list({ status: 'completed' });
    if (res.success && res.data) {
      const aptsWithNoRecord = res.data.filter((apt: any) => !apt.has_record);
      setCompletedAppointments(aptsWithNoRecord);
    }
  };

  useEffect(() => {
    loadRecords();
    if (canCreate) loadAppointments();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({
      appointment_id: '',
      summary: '',
      interventions: '',
      next_plan: '',
      confidentiality_level: 'standard',
      attachment_url: '',
    });
    setModalOpen(true);
  };

  const openEdit = (r: any) => {
    setEditing(r);
    setForm({
      appointment_id: String(r.appointment_id),
      summary: r.summary,
      interventions: r.interventions || '',
      next_plan: r.next_plan || '',
      confidentiality_level: r.confidentiality_level || 'standard',
      attachment_url: r.attachment_url || '',
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.summary) {
      alert('请填写咨询摘要');
      return;
    }
    let res;
    if (editing) {
      res = await api.sessionRecords.update(editing.id, form);
    } else {
      if (!form.appointment_id) {
        alert('请选择预约');
        return;
      }
      res = await api.sessionRecords.create({
        ...form,
        appointment_id: Number(form.appointment_id),
      });
    }
    if (res.success) {
      setModalOpen(false);
      loadRecords();
    } else {
      alert(res.error || '保存失败');
    }
  };

  const getConfidentialityLabel = (level: string) => {
    const map: Record<string, string> = {
      standard: '普通',
      confidential: '保密',
      strict: '绝密',
    };
    return map[level] || level;
  };

  const getConfidentialityVariant = (level: string) => {
    const map: Record<string, 'default' | 'warning' | 'danger'> = {
      standard: 'default',
      confidential: 'warning',
      strict: 'danger',
    };
    return map[level] || 'default';
  };

  if (loading) return <div className="text-center py-12">加载中...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">咨询记录</h1>
        {canCreate && (
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" />
            新增记录
          </Button>
        )}
      </div>

      {records.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            暂无咨询记录
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {records.map((r) => (
            <Card key={r.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-600" />
                      {isClient ? r.counselor_name : `${r.client_name} 的咨询记录`}
                    </CardTitle>
                    <p className="text-xs text-gray-500 mt-1">
                      {r.appointment_date} {r.appointment_time} · {isClient ? '' : `咨询师: ${r.counselor_name}`}
                    </p>
                  </div>
                  <Badge variant={getConfidentialityVariant(r.confidentiality_level)}>
                    <Lock className="w-3 h-3 mr-1" />
                    {getConfidentialityLabel(r.confidentiality_level)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium text-gray-700">咨询摘要：</span>
                    <p className="text-gray-600 mt-1 whitespace-pre-wrap line-clamp-3">{r.summary}</p>
                  </div>
                  {r.interventions && (
                    <div>
                      <span className="font-medium text-gray-700">干预建议：</span>
                      <p className="text-gray-600 mt-1 whitespace-pre-wrap line-clamp-2">{r.interventions}</p>
                    </div>
                  )}
                  {r.next_plan && (
                    <div>
                      <span className="font-medium text-gray-700">下次计划：</span>
                      <p className="text-gray-600 mt-1 whitespace-pre-wrap line-clamp-2">{r.next_plan}</p>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 mt-4 pt-3 border-t border-gray-100">
                  <Button size="sm" variant="secondary" onClick={() => setViewing(r)}>
                    <Eye className="w-4 h-4 mr-1" />
                    查看详情
                  </Button>
                  {canCreate && (user?.role === 'admin' || (user?.role === 'counselor' && r.counselor_name === user.name)) && (
                    <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>
                      <Pencil className="w-4 h-4 mr-1" />
                      编辑
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? '编辑咨询记录' : '新增咨询记录'}
        className="max-w-2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {!editing && (
            <Select
              label="选择已完成的预约"
              value={form.appointment_id}
              onChange={(e) => setForm({ ...form, appointment_id: e.target.value })}
              options={[
                { value: '', label: '请选择预约' },
                ...completedAppointments.map((a: any) => ({
                  value: String(a.id),
                  label: `${a.appointment_date} ${a.appointment_time} - ${a.client_name || a.counselor_name}`,
                })),
              ]}
              required
            />
          )}
          <Textarea
            label="咨询摘要 *"
            value={form.summary}
            onChange={(e) => setForm({ ...form, summary: e.target.value })}
            rows={4}
            required
          />
          <Textarea
            label="干预建议"
            value={form.interventions}
            onChange={(e) => setForm({ ...form, interventions: e.target.value })}
            rows={3}
          />
          <Textarea
            label="下次计划"
            value={form.next_plan}
            onChange={(e) => setForm({ ...form, next_plan: e.target.value })}
            rows={2}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="保密级别"
              value={form.confidentiality_level}
              onChange={(e) => setForm({ ...form, confidentiality_level: e.target.value })}
              options={[
                { value: 'standard', label: '普通 - 来访者可见' },
                { value: 'confidential', label: '保密 - 仅咨询师/管理员可见' },
                { value: 'strict', label: '绝密 - 仅管理员可见' },
              ]}
            />
            <Input
              label="附件URL（可选）"
              value={form.attachment_url}
              onChange={(e) => setForm({ ...form, attachment_url: e.target.value })}
              placeholder="文件链接..."
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>取消</Button>
            <Button type="submit">保存</Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title="咨询记录详情"
        className="max-w-2xl"
      >
        {viewing && (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm text-gray-500">
                  {viewing.appointment_date} {viewing.appointment_time}
                </p>
                <p className="font-medium">
                  来访者: {viewing.client_name} · 咨询师: {viewing.counselor_name}
                </p>
              </div>
              <Badge variant={getConfidentialityVariant(viewing.confidentiality_level)}>
                {getConfidentialityLabel(viewing.confidentiality_level)}
              </Badge>
            </div>
            <div>
              <p className="font-medium text-gray-700 mb-1">咨询摘要</p>
              <div className="p-3 bg-gray-50 rounded-lg text-sm whitespace-pre-wrap">{viewing.summary}</div>
            </div>
            {viewing.interventions && (
              <div>
                <p className="font-medium text-gray-700 mb-1">干预建议</p>
                <div className="p-3 bg-blue-50 rounded-lg text-sm whitespace-pre-wrap">{viewing.interventions}</div>
              </div>
            )}
            {viewing.next_plan && (
              <div>
                <p className="font-medium text-gray-700 mb-1">下次计划</p>
                <div className="p-3 bg-green-50 rounded-lg text-sm whitespace-pre-wrap">{viewing.next_plan}</div>
              </div>
            )}
            {viewing.attachment_url && (
              <div>
                <p className="font-medium text-gray-700 mb-1">附件</p>
                <a href={viewing.attachment_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm break-all">
                  {viewing.attachment_url}
                </a>
              </div>
            )}
            <div className="flex justify-end pt-2">
              <Button onClick={() => setViewing(null)}>关闭</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
