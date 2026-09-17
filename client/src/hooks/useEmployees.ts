import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/axios';

export function useEmployees(filters: Record<string, any> = {}) {
  return useQuery({
    queryKey: ['employees', filters],
    queryFn: () => api.get('/employees', { params: filters }).then(r => r.data),
    staleTime: 30_000,
  });
}

export function useEmployee(id: string) {
  return useQuery({
    queryKey: ['employee', id],
    queryFn: () => api.get(`/employees/${id}`).then(r => r.data),
    enabled: !!id,
  });
}

export function useCreateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.post('/employees', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employees'] }),
  });
}

export function useUpdateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: any) => api.put(`/employees/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employees'] }),
  });
}

export function useDepartments() {
  return useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get('/departments').then(r => r.data),
    staleTime: 60_000,
  });
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.get('/dashboard/stats').then(r => r.data),
    staleTime: 30_000,
  });
}

export function useAttendance(filters: Record<string, any> = {}) {
  return useQuery({
    queryKey: ['attendance', filters],
    queryFn: () => api.get('/attendance', { params: filters }).then(r => r.data),
    staleTime: 30_000,
  });
}

export function useTodayAttendance() {
  return useQuery({
    queryKey: ['attendance-today'],
    queryFn: () => api.get('/attendance/today').then(r => r.data),
    staleTime: 15_000,
  });
}

export function useCheckIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (employeeId: string) => api.post('/attendance/checkin', { employeeId }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['attendance-today'] }),
  });
}

export function useCheckOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (employeeId: string) => api.post('/attendance/checkout', { employeeId }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['attendance-today'] }),
  });
}

export function useLeaves(filters: Record<string, any> = {}) {
  return useQuery({
    queryKey: ['leaves', filters],
    queryFn: () => api.get('/leaves', { params: filters }).then(r => r.data),
    staleTime: 30_000,
  });
}

export function useApplyLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.post('/leaves', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leaves'] }),
  });
}

export function useUpdateLeaveStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.put(`/leaves/${id}`, { status }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leaves'] }),
  });
}

export function usePayrolls(filters: Record<string, any> = {}) {
  return useQuery({
    queryKey: ['payrolls', filters],
    queryFn: () => api.get('/payroll', { params: filters }).then(r => r.data),
    staleTime: 30_000,
  });
}

export function useGeneratePayroll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.post('/payroll', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payrolls'] }),
  });
}

export function useUpdatePayrollStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.put(`/payroll/${id}`, { status }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payrolls'] }),
  });
}

export function usePerformanceReviews(filters: Record<string, any> = {}) {
  return useQuery({
    queryKey: ['performance', filters],
    queryFn: () => api.get('/performance', { params: filters }).then(r => r.data),
    staleTime: 30_000,
  });
}

export function useDashboardAnalytics() {
  return useQuery({
    queryKey: ['dashboard-analytics'],
    queryFn: () => api.get('/dashboard/analytics').then(r => r.data),
    staleTime: 30_000,
  });
}

export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications').then(r => r.data),
    refetchInterval: 60_000,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.put(`/notifications/${id}/read`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

export function useMyLeaveBalances() {
  return useQuery({
    queryKey: ['leave-balances'],
    queryFn: () => api.get('/leaves').then(r => r.data?.balances || []),
    staleTime: 30_000,
  });
}
