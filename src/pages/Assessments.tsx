import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { ClipboardList, Plus, AlertTriangle, TrendingUp, CalendarCheck, User, LineChart } from 'lucide-react';

interface ScaleDef {
  name: string;
  description: string;
  questions: string[];
  options: string[];
  optionValues: number[];
}

const SCALE_THRESHOLDS: Record<string, { max: number; color: string; label: string }[]> = {
  'PHQ-9': [
    { max: 4, color: '#10b981', label: '无抑郁' },
    { max: 9, color: '#84cc16', label: '轻度' },
    { max: 14, color: '#f59e0b', label: '中度' },
    { max: 19, color: '#f97316', label: '中重度' },
    { max: 27, color: '#ef4444', label: '重度' },
  ],
  'GAD-7': [
    { max: 4, color: '#10b981', label: '无焦虑' },
    { max: 9, color: '#84cc16', label: '轻度' },
    { max: 14, color: '#f59e0b', label: '中度' },
    { max: 21, color: '#ef4444', label: '重度' },
  ],
};

const getScoreColor = (scaleType: string, score: number) => {
  const thresholds = SCALE_THRESHOLDS[scaleType] || [];
  for (const t of thresholds) {
    if (score <= t.max) return t.color;
  }
  return '#ef4444';
};

function TrendChart({ data, scaleType }: { data: any[]; scaleType: string }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
        暂无数据，完成评估后将显示趋势
      </div>
    );
  }

  const width = 600;
  const height = 180;
  const padding = { top: 20, right: 20, bottom: 30, left: 30 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const maxScore = scaleType === 'PHQ-9' ? 27 : 21;
  const maxY = Math.max(maxScore, ...data.map((d) => d.score));

  const points = data.map((d, i) => {
    const x = padding.left + (i / Math.max(data.length - 1, 1)) * chartW;
    const y = padding.top + chartH - (d.score / maxY) * chartH;
    return { x, y, d };
  });

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[480px] h-44">
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
          const y = padding.top + chartH * ratio;
          const score = Math.round(maxScore * (1 - ratio));
          return (
            <g key={i}>
              <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#e5e7eb" strokeDasharray="3,3" />
              <text x={padding.left - 5} y={y + 3} textAnchor="end" fontSize="10" fill="#9ca3af">{score}</text>
            </g>
          );
        })}
        <path d={pathD} fill="none" stroke="#3b82f6" strokeWidth="2" />
        {points.map((p, i) => {
          const color = getScoreColor(scaleType, p.d.score);
          return (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r="5" fill={color} stroke="white" strokeWidth="2" />
              <text x={p.x} y={height - 10} textAnchor="middle" fontSize="10" fill="#6b7280">
                {new Date(p.d.created_at).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
              </text>
              <text x={p.x} y={p.y - 10} textAnchor="middle" fontSize="11" fill={color} fontWeight="bold">
                {p.d.score}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function Assessments() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const isClient = user?.role === 'client';
  const [list, setList] = useState<any[]>([]);
  const [scales, setScales] = useState<Record<string, ScaleDef>>({});
  const [loading, setLoading] = useState(true);
  const [highRisk, setHighRisk] = useState<any[]>([]);
  const [myAppointments, setMyAppointments] = useState<any[]>([]);
  const [trendScale, setTrendScale] = useState<string>('PHQ-9');
  const [trendData, setTrendData] = useState<any[]>([]);
  const [trendLoading, setTrendLoading] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedScale, setSelectedScale] = useState('');
  const [answers, setAnswers] = useState<number[]>([]);
  const [result, setResult] = useState<any>(null);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string>('');

  const loadList = async () => {
    setLoading(true);
    const res = await api.assessments.list();
    if (res.success && res.data) setList(res.data);

    if (!isClient) {
      const risk = await api.assessments.highRisk(30);
      if (risk.success && risk.data) setHighRisk(risk.data);
    }
    setLoading(false);
  };

  const loadScales = async () => {
    const res = await api.assessments.scales();
    if (res.success && res.data) setScales(res.data);
  };

  const loadAppointments = async () => {
    if (!isClient) return;
    const res = await api.appointments.list();
    if (res.success && res.data) {
      const relevant = res.data.filter((a: any) => a.status === 'confirmed' || a.status === 'pending' || a.status === 'completed');
      setMyAppointments(relevant);
    }
  };

  const loadTrend = async (scaleType: string) => {
    setTrendLoading(true);
    if (isClient) {
      const res = await api.assessments.trend(0, { scale_type: scaleType });
    } else {
      const res = await api.assessments.list({ scale_type: scaleType });
      if (res.success && res.data) {
        setTrendData(
          res.data
            .slice()
            .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        );
      }
    }
    setTrendLoading(false);
  };

  useEffect(() => {
    loadList();
    loadScales();
    loadAppointments();
  }, []);

  useEffect(() => {
    if (list.length > 0) {
      const filtered = list
        .filter((a) => a.scale_type === trendScale)
        .slice()
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      setTrendData(filtered);
    }
  }, [list, trendScale]);

  const startAssessment = (type: string) => {
    setSelectedScale(type);
    const scale = scales[type];
    if (scale) {
      setAnswers(new Array(scale.questions.length).fill(0));
    }
    setResult(null);
    setSelectedAppointmentId('');
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    const payload: any = {
      scale_type: selectedScale,
      answers,
    };
    if (selectedAppointmentId) {
      payload.appointment_id = Number(selectedAppointmentId);
    }
    const res = await api.assessments.create(payload);
    if (res.success && res.data) {
      setResult(res.data);
      loadList();
    }
  };

  const scale = scales[selectedScale];

  const groupedTrend = useMemo(() => {
    if (isClient) return trendData;
    const byClient: Record<string, any[]> = {};
    trendData.forEach((d) => {
      const key = d.client_id;
      if (!byClient[key]) byClient[key] = [];
      byClient[key].push(d);
    });
    return byClient;
  }, [trendData, isClient]);

  if (loading) return <div className="text-center py-12">加载中...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ClipboardList className="w-7 h-7 text-purple-600" />
          量表评估
        </h1>
        {isClient && (
          <div className="flex gap-2">
            <Button onClick={() => startAssessment('PHQ-9')}>
              <Plus className="w-4 h-4 mr-2" />
              PHQ-9 抑郁自评
            </Button>
            <Button onClick={() => startAssessment('GAD-7')}>
              <Plus className="w-4 h-4 mr-2" />
              GAD-7 焦虑自评
            </Button>
          </div>
        )}
      </div>

      {!isClient && highRisk.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <CardTitle className="text-red-800">高风险评估提醒（近30天，{highRisk.length}条）</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {highRisk.slice(0, 6).map((item) => (
                <div key={item.id} className="p-3 bg-white rounded-lg border border-red-100">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-500" />
                      <p className="font-medium">{item.client_name}</p>
                    </div>
                    <Badge variant="danger">{item.scale_type}</Badge>
                  </div>
                  <p className="text-sm text-gray-600">{item.level}（{item.score}分）</p>
                  <p className="text-xs text-gray-400 mt-1">{new Date(item.created_at).toLocaleString()}</p>
                  {item.client_phone && <p className="text-xs text-gray-500 mt-1">📞 {item.client_phone}</p>}
                  {item.appointment_id && (
                    <p className="text-xs text-blue-500 mt-1">关联预约 #{item.appointment_id}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {isClient && Object.keys(scales).length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(scales).map(([key, s]) => (
            <Card
              key={key}
              className="hover:shadow-md transition-shadow cursor-pointer border-2 border-transparent hover:border-purple-200"
              onClick={() => startAssessment(key)}
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-purple-100 rounded-xl">
                    <ClipboardList className="w-8 h-8 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold">{s.name}</h3>
                    <p className="text-sm text-gray-500 mt-1">{s.description}</p>
                    <div className="flex items-center justify-between mt-3">
                      <p className="text-xs text-gray-400">{s.questions.length}道题 · 约5分钟</p>
                      <span className="text-xs text-purple-600 font-medium">立即评估 →</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <LineChart className="w-5 h-5 text-blue-600" />
              评估趋势图
            </CardTitle>
            <Select
              value={trendScale}
              onChange={(e) => setTrendScale(e.target.value)}
              options={[
                { value: 'PHQ-9', label: 'PHQ-9 抑郁' },
                { value: 'GAD-7', label: 'GAD-7 焦虑' },
              ]}
              className="sm:w-40"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isClient ? (
            <TrendChart data={trendData} scaleType={trendScale} />
          ) : (
            <div className="space-y-6">
              {Object.keys(groupedTrend).length === 0 ? (
                <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
                  暂无{trendScale}评估数据
                </div>
              ) : (
                Object.entries(groupedTrend as Record<string, any[]>).map(([clientId, data]) => {
                  const clientName = data[0]?.client_name || `来访者 #${clientId}`;
                  return (
                    <div key={clientId} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <User className="w-4 h-4 text-gray-500" />
                        <span className="font-medium">{clientName}</span>
                        <span className="text-xs text-gray-400">({data.length} 次评估)</span>
                      </div>
                      <TrendChart data={data} scaleType={trendScale} />
                    </div>
                  );
                })
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{isClient ? '我的评估记录' : '评估记录'}</CardTitle>
        </CardHeader>
        <CardContent>
          {list.length === 0 ? (
            <p className="text-center text-gray-500 py-8">暂无评估记录</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    {!isClient && <th className="text-left py-3 px-4 font-medium text-gray-600">来访者</th>}
                    <th className="text-left py-3 px-4 font-medium text-gray-600">量表类型</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">分数</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">等级</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">关联预约</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">评估时间</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((a) => (
                    <tr key={a.id} className="border-b border-gray-100 hover:bg-gray-50">
                      {!isClient && <td className="py-3 px-4">{a.client_name}</td>}
                      <td className="py-3 px-4 font-medium">{a.scale_type}</td>
                      <td className="py-3 px-4">
                        <span
                          className="font-bold"
                          style={{ color: getScoreColor(a.scale_type, a.score) }}
                        >
                          {a.score}分
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={a.is_high_risk ? 'danger' : 'info'}>{a.level}</Badge>
                      </td>
                      <td className="py-3 px-4">
                        {a.appointment_id ? (
                          <span className="inline-flex items-center gap-1 text-xs text-blue-600">
                            <CalendarCheck className="w-3 h-3" />
                            预约 #{a.appointment_id}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">未关联</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-gray-500">{new Date(a.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setResult(null); }}
        title={result ? '评估结果' : scale?.name || ''}
        className="max-w-2xl"
      >
        {result ? (
          <div className="space-y-5 text-center">
            <div className={`mx-auto w-24 h-24 rounded-full flex items-center justify-center ${
              result.is_high_risk ? 'bg-red-100' : 'bg-green-100'
            }`}>
              <span className={`text-3xl font-bold ${result.is_high_risk ? 'text-red-600' : 'text-green-600'}`}>
                {result.score}
              </span>
            </div>
            <div>
              <p className="text-lg font-semibold">{result.scale_type}</p>
              <p className="text-2xl font-bold mt-2">{result.level}</p>
              {result.appointment_id && (
                <p className="text-sm text-blue-600 mt-2">
                  <CalendarCheck className="w-4 h-4 inline mr-1" />
                  已关联预约 #{result.appointment_id}
                </p>
              )}
            </div>
            {result.is_high_risk && (
              <div className="p-4 bg-red-50 rounded-lg border border-red-200 text-left">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-red-800">检测到高风险评分</p>
                    <p className="text-sm text-red-700 mt-1">
                      建议您尽快联系专业心理咨询师获取帮助。如有紧急情况，请拨打心理援助热线或前往医院就诊。
                    </p>
                  </div>
                </div>
              </div>
            )}
            <div className="flex justify-center gap-3 pt-2">
              {isClient && (
                <Button onClick={() => { setModalOpen(false); navigate('/appointments'); }}>
                  <TrendingUp className="w-4 h-4 mr-2" />
                  预约咨询
                </Button>
              )}
              <Button variant="secondary" onClick={() => { setModalOpen(false); setResult(null); }}>
                关闭
              </Button>
            </div>
          </div>
        ) : scale ? (
          <div className="space-y-5">
            <p className="text-gray-600">{scale.description}</p>

            {isClient && myAppointments.length > 0 && (
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                <Select
                  label="关联咨询预约（可选）"
                  value={selectedAppointmentId}
                  onChange={(e) => setSelectedAppointmentId(e.target.value)}
                  options={[
                    { value: '', label: '不关联预约' },
                    ...myAppointments.map((a) => ({
                      value: String(a.id),
                      label: `${a.appointment_date} ${a.appointment_time} - ${a.counselor_name}（${getStatusLabel(a.status)}）`,
                    })),
                  ]}
                />
                <p className="text-xs text-gray-500 mt-2">💡 关联预约后，咨询师可以在对应预约中查看您的评估结果</p>
              </div>
            )}

            <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2">
              {scale.questions.map((q, i) => (
                <div key={i} className="p-4 bg-gray-50 rounded-lg">
                  <p className="font-medium mb-3">{i + 1}. {q}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {scale.options.map((opt, j) => (
                      <label
                        key={j}
                        className={`flex items-center justify-center p-2 rounded-lg border cursor-pointer transition-colors ${
                          answers[i] === scale.optionValues[j]
                            ? 'bg-blue-50 border-blue-400 text-blue-700 font-medium'
                            : 'bg-white border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        <input
                          type="radio"
                          name={`q-${i}`}
                          className="sr-only"
                          checked={answers[i] === scale.optionValues[j]}
                          onChange={() => {
                            const next = [...answers];
                            next[i] = scale.optionValues[j];
                            setAnswers(next);
                          }}
                        />
                        <span className="text-sm">{opt}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => setModalOpen(false)}>取消</Button>
              <Button onClick={handleSubmit}>提交评估</Button>
            </div>
          </div>
        ) : (
          <p>加载中...</p>
        )}
      </Modal>
    </div>
  );
}

function getStatusLabel(status: string) {
  const map: Record<string, string> = {
    pending: '待确认',
    confirmed: '已确认',
    completed: '已完成',
    cancelled: '已取消',
    no_show: '爽约',
  };
  return map[status] || status;
}
