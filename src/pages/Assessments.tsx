import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { ClipboardList, Plus, AlertTriangle, TrendingUp } from 'lucide-react';

interface ScaleDef {
  name: string;
  description: string;
  questions: string[];
  options: string[];
  optionValues: number[];
}

export default function Assessments() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const isClient = user?.role === 'client';
  const [list, setList] = useState<any[]>([]);
  const [scales, setScales] = useState<Record<string, ScaleDef>>({});
  const [loading, setLoading] = useState(true);
  const [highRisk, setHighRisk] = useState<any[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedScale, setSelectedScale] = useState('');
  const [answers, setAnswers] = useState<number[]>([]);
  const [result, setResult] = useState<any>(null);

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

  useEffect(() => {
    loadList();
    loadScales();
  }, []);

  const startAssessment = (type: string) => {
    setSelectedScale(type);
    const scale = scales[type];
    if (scale) {
      setAnswers(new Array(scale.questions.length).fill(0));
    }
    setResult(null);
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    const res = await api.assessments.create({
      scale_type: selectedScale,
      answers,
    });
    if (res.success && res.data) {
      setResult(res.data);
      loadList();
    }
  };

  const scale = scales[selectedScale];

  if (loading) return <div className="text-center py-12">加载中...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold">量表评估</h1>
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
                    <p className="font-medium">{item.client_name}</p>
                    <Badge variant="danger">{item.scale_type}</Badge>
                  </div>
                  <p className="text-sm text-gray-600">{item.level}（{item.score}分）</p>
                  <p className="text-xs text-gray-400 mt-1">{new Date(item.created_at).toLocaleString()}</p>
                  {item.client_phone && <p className="text-xs text-gray-500 mt-1">电话: {item.client_phone}</p>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {isClient && Object.keys(scales).length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(scales).map(([key, s]) => (
            <Card key={key} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => startAssessment(key)}>
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-purple-100 rounded-xl">
                    <ClipboardList className="w-8 h-8 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold">{s.name}</h3>
                    <p className="text-sm text-gray-500 mt-1">{s.description}</p>
                    <p className="text-xs text-gray-400 mt-2">{s.questions.length}道题 · 约5分钟</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

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
                    <th className="text-left py-3 px-4 font-medium text-gray-600">评估时间</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((a) => (
                    <tr key={a.id} className="border-b border-gray-100 hover:bg-gray-50">
                      {!isClient && <td className="py-3 px-4">{a.client_name}</td>}
                      <td className="py-3 px-4 font-medium">{a.scale_type}</td>
                      <td className="py-3 px-4">
                        <span className={`font-bold ${a.is_high_risk ? 'text-red-600' : ''}`}>{a.score}分</span>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={a.is_high_risk ? 'danger' : 'info'}>{a.level}</Badge>
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
                <Button onClick={() => navigate('/appointments')}>
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
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              {scale.questions.map((q, i) => (
                <div key={i} className="p-4 bg-gray-50 rounded-lg">
                  <p className="font-medium mb-3">{i + 1}. {q}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {scale.options.map((opt, j) => (
                      <label
                        key={j}
                        className={`flex items-center justify-center p-2 rounded-lg border cursor-pointer transition-colors ${
                          answers[i] === scale.optionValues[j]
                            ? 'bg-blue-50 border-blue-400 text-blue-700'
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
