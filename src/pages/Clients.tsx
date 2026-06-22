import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, getStatusConfig } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Eye, Pencil, FileText, ClipboardList, Calendar } from 'lucide-react';

interface ClientDetail {
  appointments: any[];
  records: any[];
  assessments: any[];
}

export default function Clients() {
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [detail, setDetail] = useState<ClientDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState<'appointments' | 'records' | 'assessments'>('appointments');

  const loadClients = async () => {
    setLoading(true);
    const res = await api.clients.list();
    if (res.success && res.data) setClients(res.data);
    setLoading(false);
  };

  useEffect(() => {
    loadClients();
  }, []);

  const viewDetail = async (c: any) => {
    setSelected(c);
    setDetailLoading(true);
    const res = await api.clients.history(c.id);
    if (res.success && res.data) {
      setDetail(res.data);
    }
    setDetailLoading(false);
  };

  if (loading) return <div className="text-center py-12">加载中...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">来访者档案</h1>

      {clients.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            暂无来访者档案
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left py-3 px-4 font-medium text-gray-600">姓名</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">性别</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">年龄</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">联系电话</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">主要困扰</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((c) => (
                    <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium">{c.name}</td>
                      <td className="py-3 px-4">{c.gender || '-'}</td>
                      <td className="py-3 px-4">{c.age || '-'}</td>
                      <td className="py-3 px-4">{c.phone || '-'}</td>
                      <td className="py-3 px-4 max-w-xs truncate">{c.main_concerns || '-'}</td>
                      <td className="py-3 px-4">
                        <Button size="sm" variant="ghost" onClick={() => viewDetail(c)}>
                          <Eye className="w-4 h-4 mr-1" />
                          查看详情
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Modal
        open={!!selected}
        onClose={() => { setSelected(null); setDetail(null); }}
        title={`${selected?.name} - 档案详情`}
        className="max-w-3xl"
      >
        {selected && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="text-xs text-gray-500">姓名</p>
                <p className="font-medium">{selected.name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">性别</p>
                <p>{selected.gender || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">年龄</p>
                <p>{selected.age || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">电话</p>
                <p>{selected.phone || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">邮箱</p>
                <p>{selected.email || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">紧急联系人</p>
                <p>{selected.emergency_contact || '-'}{selected.emergency_phone ? ` (${selected.emergency_phone})` : ''}</p>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">主要困扰</p>
              <p className="text-sm text-gray-600">{selected.main_concerns || '暂无'}</p>
            </div>

            <div className="flex gap-2 border-b border-gray-200">
              <button
                onClick={() => setDetailTab('appointments')}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  detailTab === 'appointments'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Calendar className="w-4 h-4 inline mr-1" />
                咨询记录
              </button>
              <button
                onClick={() => setDetailTab('records')}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  detailTab === 'records'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <FileText className="w-4 h-4 inline mr-1" />
                咨询笔记
              </button>
              <button
                onClick={() => setDetailTab('assessments')}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  detailTab === 'assessments'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <ClipboardList className="w-4 h-4 inline mr-1" />
                量表评估
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto">
              {detailLoading ? (
                <p className="text-center py-8 text-gray-500">加载中...</p>
              ) : detail ? (
                <>
                  {detailTab === 'appointments' && (
                    detail.appointments.length === 0 ? (
                      <p className="text-center py-8 text-gray-500">暂无预约记录</p>
                    ) : (
                      <div className="space-y-2">
                        {detail.appointments.map((a: any) => {
                          const cfg = getStatusConfig(a.status);
                          return (
                            <div key={a.id} className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-lg">
                              <div>
                                <p className="font-medium">{a.appointment_date} {a.appointment_time}</p>
                                <p className="text-sm text-gray-500">咨询师: {a.counselor_name}</p>
                              </div>
                              <Badge variant={cfg.variant}>{cfg.label}</Badge>
                            </div>
                          );
                        })}
                      </div>
                    )
                  )}
                  {detailTab === 'records' && (
                    detail.records.length === 0 ? (
                      <p className="text-center py-8 text-gray-500">暂无咨询笔记</p>
                    ) : (
                      <div className="space-y-3">
                        {detail.records.map((r: any) => (
                          <div key={r.id} className="p-4 bg-white border border-gray-100 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-sm text-gray-500">
                                {r.appointment_date} {r.appointment_time} · {r.counselor_name}
                              </p>
                              <Badge variant="info">{r.confidentiality_level === 'standard' ? '普通' : r.confidentiality_level === 'confidential' ? '保密' : '绝密'}</Badge>
                            </div>
                            <p className="text-sm"><span className="font-medium">摘要: </span>{r.summary}</p>
                            {r.interventions && <p className="text-sm mt-1"><span className="font-medium">干预: </span>{r.interventions}</p>}
                            {r.next_plan && <p className="text-sm mt-1"><span className="font-medium">计划: </span>{r.next_plan}</p>}
                          </div>
                        ))}
                      </div>
                    )
                  )}
                  {detailTab === 'assessments' && (
                    detail.assessments.length === 0 ? (
                      <p className="text-center py-8 text-gray-500">暂无评估记录</p>
                    ) : (
                      <div className="space-y-2">
                        {detail.assessments.map((a: any) => (
                          <div key={a.id} className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-lg">
                            <div>
                              <p className="font-medium">{a.scale_type}</p>
                              <p className="text-sm text-gray-500">{new Date(a.created_at).toLocaleString()}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-lg">{a.score}分</p>
                              <Badge variant={a.is_high_risk ? 'danger' : 'success'}>{a.level}</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  )}
                </>
              ) : null}
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={() => { setSelected(null); setDetail(null); }}>关闭</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
