import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

export default function Login() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('client');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { setUser } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from?.pathname || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'login') {
        const res = await api.auth.login({ username, password });
        if (res.success && res.data) {
          setUser(res.data);
          navigate(from, { replace: true });
        } else {
          setError(res.error || '登录失败');
        }
      } else {
        const res = await api.auth.register({ username, password, name, role, phone });
        if (res.success && res.data) {
          setUser(res.data);
          navigate('/', { replace: true });
        } else {
          setError(res.error || '注册失败');
        }
      }
    } catch {
      setError('操作失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 to-indigo-100">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">心理咨询预约系统</CardTitle>
          <p className="text-sm text-gray-500 mt-1">
            {mode === 'login' ? '欢迎回来，请登录您的账户' : '创建一个新账户'}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <>
                <Input
                  label="姓名"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="请输入姓名"
                  required
                />
                <Select
                  label="角色"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  options={[
                    { value: 'client', label: '来访者' },
                    { value: 'counselor', label: '咨询师' },
                  ]}
                />
                <Input
                  label="手机号"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="请输入手机号"
                />
              </>
            )}
            <Input
              label="用户名"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入用户名"
              required
            />
            <Input
              label="密码"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              required
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? '处理中...' : mode === 'login' ? '登录' : '注册'}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            <span className="text-gray-600">
              {mode === 'login' ? '还没有账户？' : '已有账户？'}
            </span>
            <button
              type="button"
              className="text-blue-600 hover:underline ml-1"
              onClick={() => {
                setMode(mode === 'login' ? 'register' : 'login');
                setError('');
              }}
            >
              {mode === 'login' ? '去注册' : '去登录'}
            </button>
          </div>
          <div className="mt-6 pt-4 border-t border-gray-200 text-xs text-gray-500 text-center">
            <p>测试账号：</p>
            <p>管理员：admin / admin123</p>
            <p>咨询师：counselor1 / 123456</p>
            <p>来访者：client1 / 123456</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
