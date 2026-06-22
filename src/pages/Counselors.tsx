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
import { Plus, Pencil, Power, Trash2 } from 'lucide-react';

const SPECIALTY_OPTIONS = ['焦虑', '抑郁', '亲密关系', '亲子', '职业', '睡眠'];

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
              {(isAdmin || user?.role === 'counselor') && (
                <div className="flex gap-2 pt-3 border-t border-gray-100">
                  <Button size="sm" variant="secondary" onClick={() => openEdit(c)}>
                    <Pencil className="w-4 h-4 mr-1" />
                    编辑
                  </Button>
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
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? '编辑咨询师' : '新增咨询师'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="姓名"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <Input
            label="资质"
            value={form.qualification}
            onChange={(e) => setForm({ ...form, qualification: e.target.value })}
            placeholder="如：国家二级心理咨询师"
            required
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">擅长方向</label>
            <div className="flex flex-wrap gap-2">
              {SPECIALTY_OPTIONS.map((s) => {
                const arr = Array.isArray(form.specialties) ? form.specialties : [];
                const active = arr.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleSpecialty(s)}
                    className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                      active
                        ? 'bg-blue-100 text-blue-700 border-blue-300'
                        : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>
          <Textarea
            label="可预约时段"
            value={form.available_slots}
            onChange={(e) => setForm({ ...form, available_slots: e.target.value })}
            placeholder="如：周一 09:00-12:00,周三 14:00-18:00"
            rows={2}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="单次时长(分钟)"
              type="number"
              value={form.session_duration}
              onChange={(e) => setForm({ ...form, session_duration: Number(e.target.value) })}
            />
            <Input
              label="收费(元)"
              type="number"
              value={form.fee}
              onChange={(e) => setForm({ ...form, fee: Number(e.target.value) })}
            />
          </div>
          <Textarea
            label="简介"
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
            rows={3}
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              取消
            </Button>
            <Button type="submit">保存</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
