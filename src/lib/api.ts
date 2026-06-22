const BASE_URL = '/api';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  conflict_intercepted?: boolean;
}

const getAuthHeaders = (): Record<string, string> => {
  const user = localStorage.getItem('user');
  if (!user) return {};
  try {
    const parsed = JSON.parse(user);
    return {
      'x-user-id': String(parsed.id),
      'x-user-role': parsed.role,
      'x-user-name': parsed.name,
      'x-user-username': parsed.username,
    };
  } catch {
    return {};
  }
};

export const request = async <T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> => {
  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
        ...(options.headers || {}),
      },
    });
    const data = await response.json();
    return data;
  } catch (error) {
    return { success: false, error: '网络请求失败' };
  }
};

export const api = {
  auth: {
    register: (data: any) => request<any>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
    login: (data: any) => request<any>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
    logout: () => request<any>('/auth/logout', { method: 'POST' }),
    me: () => request<any>('/auth/me'),
  },
  counselors: {
    list: (params?: any) => {
      const query = params ? '?' + new URLSearchParams(params).toString() : '';
      return request<any[]>(`/counselors${query}`);
    },
    get: (id: number) => request<any>(`/counselors/${id}`),
    create: (data: any) => request<any>('/counselors', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) => request<any>(`/counselors/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    toggle: (id: number) => request<any>(`/counselors/${id}/toggle`, { method: 'PATCH' }),
    remove: (id: number) => request<any>(`/counselors/${id}`, { method: 'DELETE' }),
  },
  clients: {
    list: () => request<any[]>('/clients'),
    me: () => request<any>('/clients/me'),
    get: (id: number) => request<any>(`/clients/${id}`),
    history: (id: number) => request<any>(`/clients/${id}/history`),
    updateMe: (data: any) => request<any>('/clients/me', { method: 'PUT', body: JSON.stringify(data) }),
    update: (id: number, data: any) => request<any>(`/clients/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  },
  appointments: {
    list: (params?: any) => {
      const query = params ? '?' + new URLSearchParams(params).toString() : '';
      return request<any[]>(`/appointments${query}`);
    },
    get: (id: number) => request<any>(`/appointments/${id}`),
    create: (data: any) => request<any>('/appointments', { method: 'POST', body: JSON.stringify(data) }),
    confirm: (id: number) => request<any>(`/appointments/${id}/confirm`, { method: 'PUT' }),
    reject: (id: number, data: any) => request<any>(`/appointments/${id}/reject`, { method: 'PUT', body: JSON.stringify(data) }),
    cancel: (id: number, data: any) => request<any>(`/appointments/${id}/cancel`, { method: 'PUT', body: JSON.stringify(data) }),
    complete: (id: number) => request<any>(`/appointments/${id}/complete`, { method: 'PUT' }),
    noShow: (id: number) => request<any>(`/appointments/${id}/no_show`, { method: 'PUT' }),
    remove: (id: number) => request<any>(`/appointments/${id}`, { method: 'DELETE' }),
    logs: (id: number) => request<any[]>(`/appointments/${id}/logs`),
    reschedule: (id: number, data: any) => request<any>(`/appointments/${id}/reschedule`, { method: 'POST', body: JSON.stringify(data) }),
    rescheduleRequests: (id: number) => request<any[]>(`/appointments/${id}/reschedule-requests`),
    approveReschedule: (requestId: number, data?: any) => request<any>(`/appointments/reschedule/${requestId}/approve`, { method: 'PUT', body: JSON.stringify(data || {}) }),
    rejectReschedule: (requestId: number, data?: any) => request<any>(`/appointments/reschedule/${requestId}/reject`, { method: 'PUT', body: JSON.stringify(data || {}) }),
    pendingReschedules: () => request<any[]>('/appointments/reschedule/pending'),
  },
  schedules: {
    list: (counselorId: number) => request<any>(`/schedules?counselor_id=${counselorId}`),
    getSchedules: (counselorId: number) => request<any[]>(`/schedules/${counselorId}/schedules`),
    addSchedule: (counselorId: number, data: any) => request<any>(`/schedules/${counselorId}/schedules`, { method: 'POST', body: JSON.stringify(data) }),
    updateSchedule: (counselorId: number, scheduleId: number, data: any) => request<any>(`/schedules/${counselorId}/schedules/${scheduleId}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteSchedule: (counselorId: number, scheduleId: number) => request<any>(`/schedules/${counselorId}/schedules/${scheduleId}`, { method: 'DELETE' }),
    getUnavailableDates: (counselorId: number) => request<any[]>(`/schedules/${counselorId}/unavailable-dates`),
    addUnavailableDate: (counselorId: number, data: any) => request<any>(`/schedules/${counselorId}/unavailable-dates`, { method: 'POST', body: JSON.stringify(data) }),
    deleteUnavailableDate: (counselorId: number, dateId: number) => request<any>(`/schedules/${counselorId}/unavailable-dates/${dateId}`, { method: 'DELETE' }),
  },
  assessments: {
    scales: () => request<any>('/assessments/scales'),
    list: (params?: any) => {
      const query = params ? '?' + new URLSearchParams(params).toString() : '';
      return request<any[]>(`/assessments${query}`);
    },
    trend: (clientId: number, params?: any) => {
      const query = params ? '?' + new URLSearchParams(params).toString() : '';
      return request<any[]>(`/assessments/trend/${clientId}${query}`);
    },
    highRisk: (days?: number) => request<any[]>(`/assessments/high_risk${days ? `?days=${days}` : ''}`),
    create: (data: any) => request<any>('/assessments', { method: 'POST', body: JSON.stringify(data) }),
    get: (id: number) => request<any>(`/assessments/${id}`),
  },
  sessionRecords: {
    list: (params?: any) => {
      const query = params ? '?' + new URLSearchParams(params).toString() : '';
      return request<any[]>(`/session-records${query}`);
    },
    get: (id: number) => request<any>(`/session-records/${id}`),
    create: (data: any) => request<any>('/session-records', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) => request<any>(`/session-records/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id: number) => request<any>(`/session-records/${id}`, { method: 'DELETE' }),
  },
  statistics: {
    overview: () => request<any>('/statistics'),
  },
};
