import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Pencil, Save } from 'lucide-react';

export default function Profile() {
  const { user } = useAuthStore();
  const [profile, setProfile] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<any>({});

  const loadProfile = async () => {
    setLoading(true);
    const res = await api.clients.me();
    if (res.success && res.data) {
      setProfile(res.data);
      setForm(res.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleSave = async () => {
    const res = await api.clients.updateMe(form);
    if (res.success && res.data) {
      setProfile(res.data);
      setEditing(false);
    } else {
      alert(res.error || '保存失败');
    }
  };

  if (loading) return <div className="text-center py-12">加载中...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">我的档案</h1>
        {!editing ? (
          <Button onClick={() => setEditing(true)}>
            <Pencil className="w-4 h-4 mr-2" />
            编辑资料
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => { setEditing(false); setForm(profile); }}>
              取消
            </Button>
            <Button onClick={handleSave}>
              <Save className="w-4 h-4 mr-2" />
              保存
            </Button>
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>基本信息</CardTitle>
        </CardHeader>
        <CardContent>
          {editing ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="姓名" value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Select
                label="性别"
                value={form.gender || ''}
                onChange={(e) => setForm({ ...form, gender: e.target.value })}
                options={[
                  { value: '', label: '请选择' },
                  { value: '男', label: '男' },
                  { value: '女', label: '女' },
                  { value: '其他', label: '其他' },
                ]}
              />
              <Input label="年龄" type="number" value={form.age || ''} onChange={(e) => setForm({ ...form, age: e.target.value })} />
              <Input label="电话" value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <Input label="邮箱" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
              <div>
                <p className="text-xs text-gray-500">用户名</p>
                <p className="font-medium">{user?.username}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">姓名</p>
                <p className="font-medium">{profile?.name || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">性别</p>
                <p>{profile?.gender || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">年龄</p>
                <p>{profile?.age || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">电话</p>
                <p>{profile?.phone || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">邮箱</p>
                <p>{profile?.email || '-'}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>紧急联系人</CardTitle>
        </CardHeader>
        <CardContent>
          {editing ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="联系人姓名" value={form.emergency_contact || ''} onChange={(e) => setForm({ ...form, emergency_contact: e.target.value })} />
              <Input label="联系电话" value={form.emergency_phone || ''} onChange={(e) => setForm({ ...form, emergency_phone: e.target.value })} />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <p className="text-xs text-gray-500">紧急联系人</p>
                <p className="font-medium">{profile?.emergency_contact || '（未填写，仅咨询师和管理员可见）'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">联系电话</p>
                <p>{profile?.emergency_phone || '-'}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>主要困扰</CardTitle>
        </CardHeader>
        <CardContent>
          {editing ? (
            <Textarea
              value={form.main_concerns || ''}
              onChange={(e) => setForm({ ...form, main_concerns: e.target.value })}
              rows={4}
              placeholder="请描述您目前的主要困扰..."
            />
          ) : (
            <p className="text-gray-700 whitespace-pre-wrap">{profile?.main_concerns || '暂无描述'}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
