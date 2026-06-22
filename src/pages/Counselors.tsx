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
import { Plus, Pencil, Power, Trash2, Calendar, Clock, X } from 'lucide-react';

const SPECIALTY_OPTIONS = ['焦虑', '抑郁', '亲密关系', '亲子', '职业', '睡眠'];

const DAY_OPTIONS = [
  { value: 1, label: '周一' },
  { value: 2, label: '周二' },
  { value: 3, label: '周三' },
  { value: 4, label: '周四' },
  { value: 5, label: '周五' },
  { value: 6, label: '周六' },
  { value: 7, label: '周日' },
];

const DAY_NAMES: Record<number, string> = { 1: '周一', 2: '周二', 3: '周三', 4: '周四', 5: '周五', 6: '周六', 7: '周日' };

const parseSpecialties = (raw: any): string[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  return String(raw).split(/[,，]/).map((s: string) => s.trim()).filter(Boolean);
};

const formatSlots = (raw: any): string => {
  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .map((d: any) => `${d.dayName || '周?'}: ${(d.slots || []).join('/')}`)
        .join('；');
    }
  } catch {}
  return String(raw);
};

export default function Counselors() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const isCounselor = user?.role === 'counselor';
  const [counselors, setCounselors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    name: '',
    qualification: '',
    specialties: '' as string | string[],
    available_slots: '',
    session_duration: 50,
    fee: 0,
    bio: '',
  });

  const [scheduleCounselor, setScheduleCounselor] = useState<any>(null);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [unavailableDates, setUnavailableDates] = useState<any[]>([]);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [addScheduleForm, setAddScheduleForm] = useState({ day_of_week: 1, start_time: '09:00', end_time: '12:00' });
  const [addUnavailableForm, setAddUnavailableForm] = useState({ unavailable_date: '', reason: '' });

  const loadCounselors = async () => {
    setLoading(true);
    const res = await api.counselors.list();
    if (res.success && res.data) setCounselors(res.data);
    setLoading(false);
  };

  useEffect(() => {
    loadCounselors();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', qualification: '', specialties: [], available_slots: '', session_duration: 50, fee: 0, bio: '' });
    setModalOpen(true);
  };

  const openEdit = (c: any) => {
    setEditing(c);
    setForm({
      name: c.name,
      qualification: c.qualification,
      specialties: parseSpecialties(c.specialties),
      available_slots: formatSlots(c.available_slots),
      session_duration: c.session_duration || 50,
      fee: c.fee || 0,
      bio: c.bio || '',
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const specialties = Array.isArray(form.specialties) ? form.specialties.join(',') : form.specialties;
    if (editing) {
      const res = await api.counselors.update(editing.id, { ...form, specialties });
      if (res.success) {
        setModalOpen(false);
        loadCounselors();
      } else {
        alert(res.error || '操作失败');
      }
    } else {
      const res = await api.counselors.create({ ...form, specialties });
      if (res.success) {
        setModalOpen(false);
        loadCounselors();
      } else {
        alert(res.error || '创建失败');
      }
    }
  };

  const handleToggle = async (id: number) => {
    const res = await api.counselors.toggle(id);
    if (res.success) loadCounselors();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除该咨询师吗？')) return;
    const res = await api.counselors.remove(id);
    if (res.success) loadCounselors();
  };

  const toggleSpecialty = (s: string) => {
    const current = Array.isArray(form.specialties) ? form.specialties : [];
    if (current.includes(s)) {
      setForm({ ...form, specialties: current.filter((x) => x !== s) });
    } else {
      setForm({ ...form, specialties: [...current, s] });
    }
  };

  const openScheduleManager = async (c: any) => {
    setScheduleCounselor(c);
    const [schedRes, unavailRes] = await Promise.all([
      api.schedules.getSchedules(c.id),
      api.schedules.getUnavailableDates(c.id),
    ]);
    if (schedRes.success && schedRes.data) setSchedules(schedRes.data);
    if (unavailRes.success && unavailRes.data) setUnavailableDates(unavailRes.data);
    setScheduleModalOpen(true);
  };

  const handleAddSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleCounselor) return;
    const res = await api.schedules.addSchedule(scheduleCounselor.id, addScheduleForm);
    if (res.success) {
      const schedRes = await api.schedules.getSchedules(scheduleCounselor.id);
      if (schedRes.success && schedRes.data) setSchedules(schedRes.data);
      setAddScheduleForm({ day_of_week: 1, start_time: '09:00', end_time: '12:00' });
    } else {
      alert(res.error || '添加失败');
    }
  };

  const handleDeleteSchedule = async (scheduleId: number) => {
    if (!scheduleCounselor) return;
    const res = await api.schedules.deleteSchedule(scheduleCounselor.id, scheduleId);
    if (res.success) {
      const schedRes = await api.schedules.getSchedules(scheduleCounselor.id);
      if (schedRes.success && schedRes.data) setSchedules(schedRes.data);
    }
  };

  const handleAddUnavailableDate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleCounselor) return;
    const res = await api.schedules.addUnavailableDate(scheduleCounselor.id, addUnavailableForm);
    if (res.success) {
      const unavailRes = await api.schedules.getUnavailableDates(scheduleCounselor.id);
      if (unavailRes.success && unavailRes.data) setUnavailableDates(unavailRes.data);
      setAddUnavailableForm({ unavailable_date: '', reason: '' });
    } else {
      alert(res.error || '添加失败');
    }
  };

  const handleDeleteUnavailableDate = async (dateId: number) => {
    if (!scheduleCounselor) return;
    const res = await api.schedules.deleteUnavailableDate(scheduleCounselor.id, dateId);
    if (res.success) {
      const unavailRes = await api.schedules.getUnavailableDates(scheduleCounselor.id);
      if (unavailRes.success && unavailRes.data) setUnavailableDates(unavailRes.data);
    }
  };

  if (loading) return <div className="text-center py-12">加载中...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">咨询师管理</h1>
        {isAdmin && (
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" />
            新增咨询师
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {counselors.map((c) => (
          <Card key={c.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>{c.name}</CardTitle>
                  <p className="text-sm text-gray-500 mt-1">{c.qualification}</p>
                </div>
                <Badge variant={c.is_active ? 'success' : 'default'}>
                  {c.is_active ? '可预约' : '已停用'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1 mb-3">
                {parseSpecialties(c.specialties).map((s: string, i: number) => (
                  <Badge key={i} variant="info">{s.trim()}</Badge>
                ))}
              </div>
              {c.bio && <p className="text-sm text-gray-600 mb-3 line-clamp-3">{c.bio}</p>}
              <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                <span>时长: {c.session_duration}分钟</span>
                <span className="font-medium text-blue-600">¥{c.fee}/次</span>
              </div>
              {c.available_slots && (
                <p className="text-xs text-gray-500 mb-4">可约时段: {formatSlots(c.available_slots)}</p>
              )}
              <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100">
                <Button size="sm" variant="secondary" onClick={() => openScheduleManager(c)}>
                  <Calendar className="w-4 h-4 mr-1" />
                  排班管理
                </Button>
                {(isAdmin || isCounselor) && (
                  <Button size="sm" variant="secondary" onClick={() => openEdit(c)}>
                    <Pencil className="w-4 h-4 mr-1" />
                    编辑
                  </Button>
                )}
                {isAdmin && (
                  <>
                    <Button size="sm" variant={c.is_active ? 'danger' : 'primary'} onClick={() => handleToggle(c.id)}>
                      <Power className="w-4 h-4 mr-1" />
                      {c.is_active ? '停用' : '启用'}
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => handleDelete(c.id)}>
                      <Trash2 className="w-4 h-4 mr-1" />
                      删除
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? '编辑咨询师' : '新增咨询师'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="姓名" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Input label="资质" value={form.qualification} onChange={(e) => setForm({ ...form, qualification: e.target.value })} placeholder="如：国家二级心理咨询师" required />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">擅长方向</label>
            <div className="flex flex-wrap gap-2">
              {SPECIALTY_OPTIONS.map((s) => {
                const arr = Array.isArray(form.specialties) ? form.specialties : [];
                const active = arr.includes(s);
                return (
                  <button key={s} type="button" onClick={() => toggleSpecialty(s)} className={`px-3 py-1 rounded-full text-sm border transition-colors ${active ? 'bg-blue-100 text-blue-700 border-blue-300' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
                    {s}
                  </button>
                );
              })}
            </div>
          </div>
          <Textarea label="可预约时段" value={form.available_slots} onChange={(e) => setForm({ ...form, available_slots: e.target.value })} placeholder="如：周一 09:00-12:00,周三 14:00-18:00" rows={2} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="单次时长(分钟)" type="number" value={form.session_duration} onChange={(e) => setForm({ ...form, session_duration: Number(e.target.value) })} />
            <Input label="收费(元)" type="number" value={form.fee} onChange={(e) => setForm({ ...form, fee: Number(e.target.value) })} />
          </div>
          <Textarea label="简介" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} rows={3} />
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>取消</Button>
            <Button type="submit">保存</Button>
          </div>
        </form>
      </Modal>

      <Modal open={scheduleModalOpen} onClose={() => setScheduleModalOpen(false)} title={`${scheduleCounselor?.name || ''} - 排班管理`} maxWidth="max-w-2xl">
        <div className="space-y-6">
          <div>
            <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              每周可预约时段
            </h3>
            {schedules.length > 0 ? (
              <div className="space-y-2 mb-4">
                {schedules.map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-3">
                      <Badge variant="info">{DAY_NAMES[s.day_of_week] || `周${s.day_of_week}`}</Badge>
                      <span className="text-sm font-medium">{s.start_time} - {s.end_time}</span>
                    </div>
                    <Button size="sm" variant="danger" onClick={() => handleDeleteSchedule(s.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 mb-4">暂无固定排班，将使用咨询师资料中的可约时段</p>
            )}
            <form onSubmit={handleAddSchedule} className="flex items-end gap-3 bg-blue-50 p-3 rounded-lg">
              <Select
                label="星期"
                value={String(addScheduleForm.day_of_week)}
                onChange={(e) => setAddScheduleForm({ ...addScheduleForm, day_of_week: Number(e.target.value) })}
                options={DAY_OPTIONS.map((d) => ({ value: String(d.value), label: d.label }))}
                className="w-28"
              />
              <Input label="开始时间" type="time" value={addScheduleForm.start_time} onChange={(e) => setAddScheduleForm({ ...addScheduleForm, start_time: e.target.value })} className="w-32" />
              <Input label="结束时间" type="time" value={addScheduleForm.end_time} onChange={(e) => setAddScheduleForm({ ...addScheduleForm, end_time: e.target.value })} className="w-32" />
              <Button type="submit" size="sm" className="mb-0.5">
                <Plus className="w-4 h-4 mr-1" />
                添加
              </Button>
            </form>
          </div>

          <div>
            <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-red-600" />
              临时停诊日期
            </h3>
            {unavailableDates.length > 0 ? (
              <div className="space-y-2 mb-4">
                {unavailableDates.map((d: any) => (
                  <div key={d.id} className="flex items-center justify-between bg-red-50 rounded-lg px-3 py-2">
                    <div>
                      <span className="text-sm font-medium text-red-700">{d.unavailable_date}</span>
                      {d.reason && <span className="text-sm text-gray-500 ml-2">（{d.reason}）</span>}
                    </div>
                    <Button size="sm" variant="danger" onClick={() => handleDeleteUnavailableDate(d.id)}>
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 mb-4">暂无临时停诊日期</p>
            )}
            <form onSubmit={handleAddUnavailableDate} className="flex items-end gap-3 bg-red-50 p-3 rounded-lg">
              <Input label="停诊日期" type="date" value={addUnavailableForm.unavailable_date} onChange={(e) => setAddUnavailableForm({ ...addUnavailableForm, unavailable_date: e.target.value })} className="w-40" />
              <Input label="原因（可选）" value={addUnavailableForm.reason} onChange={(e) => setAddUnavailableForm({ ...addUnavailableForm, reason: e.target.value })} placeholder="如：培训、请假" className="flex-1" />
              <Button type="submit" size="sm" variant="danger" className="mb-0.5">
                <Plus className="w-4 h-4 mr-1" />
                添加
              </Button>
            </form>
          </div>
        </div>
      </Modal>
    </div>
  );
}
