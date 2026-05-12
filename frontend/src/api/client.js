const BASE = '/api';

function getToken() {
  return localStorage.getItem('kvitto_token');
}

async function request(method, path, body, isFormData = false) {
  const token = getToken();
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!isFormData && body) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: isFormData ? body : (body ? JSON.stringify(body) : undefined),
  });

  if (res.status === 401) {
    localStorage.removeItem('kvitto_token');
    localStorage.removeItem('kvitto_user');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const api = {
  // Auth
  login: (body) => request('POST', '/auth/login', body),
  register: (body) => request('POST', '/auth/register', body),
  me: () => request('GET', '/auth/me'),

  // Expenses
  getExpenses: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request('GET', `/expenses${q ? '?' + q : ''}`);
  },
  getExpense: (id) => request('GET', `/expenses/${id}`),
  createExpense: (formData) => request('POST', '/expenses', formData, true),
  updateExpense: (id, formData) => request('PUT', `/expenses/${id}`, formData, true),
  deleteExpense: (id) => request('DELETE', `/expenses/${id}`),
  deleteReceipt: (id) => request('DELETE', `/expenses/${id}/receipt`),

  // Reports
  getReports: () => request('GET', '/reports'),
  getReport: (id) => request('GET', `/reports/${id}`),
  getReportSummary: (id) => request('GET', `/reports/${id}/summary`),
  createReport: (body) => request('POST', '/reports', body),
  updateReport: (id, body) => request('PUT', `/reports/${id}`, body),
  deleteReport: (id) => request('DELETE', `/reports/${id}`),

  // Currencies — cache rates i localStorage til offline-brug
  getCurrencies: async () => {
    const data = await request('GET', '/currencies');
    try {
      const rateMap = {};
      data.forEach(r => { rateMap[r.currency] = parseFloat(r.rate_to_dkk); });
      localStorage.setItem('kvitto_rates', JSON.stringify(rateMap));
      localStorage.setItem('kvitto_rates_ts', Date.now().toString());
    } catch {}
    return data;
  },
  convert: (amount, from) => {
    // Prøv offline-cache først
    if (!navigator.onLine) {
      try {
        const rates = JSON.parse(localStorage.getItem('kvitto_rates') || '{}');
        const rate = rates[from] || 1;
        const amount_dkk = Math.round(parseFloat(amount) * rate * 100) / 100;
        return Promise.resolve({ amount_dkk, rate });
      } catch {}
    }
    return request('GET', `/currencies/convert?amount=${amount}&from=${from}`);
  },

  // PDF
  downloadReportPDF: async (id, name) => {
    const token = getToken();
    const res = await fetch(`${BASE}/pdf/reports/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('PDF generation failed');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Rapport_${name}_${new Date().toISOString().slice(0, 10)}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  },
};

// Appended: admin + password endpoints
Object.assign(api, {
  changePassword: (body) => request('POST', '/auth/change-password', body),

  // Admin
  getUsers: () => request('GET', '/admin/users'),
  resetUserPassword: (id) => request('POST', `/admin/users/${id}/reset-password`),
  toggleAdmin: (id) => request('POST', `/admin/users/${id}/toggle-admin`),
  deleteUser: (id) => request('DELETE', `/admin/users/${id}`),
});

// Approve all expenses in a report
api.approveAllExpenses = (id) => request('POST', `/reports/${id}/approve-all`);
api.setReportStatus = (id, status, comment) => request('PATCH', `/reports/${id}/status`, { status, comment });

// Invites
api.getInvites    = ()            => request('GET',    '/admin/invites');
api.sendInvite    = (email)       => request('POST',   '/admin/invite', { email });
api.revokeInvite  = (id)          => request('DELETE', `/admin/invites/${id}`);
api.getInvite     = (token)       => request('GET',    `/auth/invite/${token}`);
api.acceptInvite  = (token, body) => request('POST',   `/auth/invite/${token}`, body);

// Password reset
api.forgotPassword   = (email)          => request('POST', '/auth/forgot-password', { email });
api.verifyResetToken = (token)          => request('GET',  `/auth/reset-password/${token}`);
api.resetPassword    = (token, password) => request('POST', `/auth/reset-password/${token}`, { password });

// Byg receipt URL med token så <img src> virker
export function receiptUrl(filename) {
  if (!filename) return null;
  const token = localStorage.getItem('kvitto_token');
  return `/api/receipts/${encodeURIComponent(filename)}${token ? `?token=${token}` : ''}`;
}

// Notifikationspræference
api.setNotifications = (emailNotifications) =>
  request('PATCH', '/auth/notifications', { emailNotifications });

// Tilbagevendende udgifter
api.getRecurring    = ()       => request('GET',    '/recurring');
api.createRecurring = (body)   => request('POST',   '/recurring', body);
api.updateRecurring = (id, b)  => request('PUT',    `/recurring/${id}`, b);
api.toggleRecurring = (id)     => request('PATCH',  `/recurring/${id}/toggle`);
api.deleteRecurring = (id)     => request('DELETE', `/recurring/${id}`);

// Aktivitetslog
api.getActivity = (params = {}) => {
  const q = new URLSearchParams(params).toString();
  return request('GET', `/activity${q ? '?' + q : ''}`);
};

// Bulk-tilknytning
api.bulkAssign = (expense_ids, report_id) =>
  request('POST', '/expenses/bulk-assign', { expense_ids, report_id });

// Excel eksport
api.downloadExpensesExcel = async () => {
  const token = localStorage.getItem('kvitto_token');
  const res = await fetch('/api/export/expenses.xlsx', {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error('Eksport fejlede');
  const blob = await res.blob();
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `Udgifter_${new Date().toISOString().slice(0,10)}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
};

api.downloadReportExcel = async (id, name) => {
  const token = localStorage.getItem('kvitto_token');
  const res = await fetch(`/api/export/report/${id}.xlsx`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error('Eksport fejlede');
  const blob = await res.blob();
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `Rapport_${name}_${new Date().toISOString().slice(0,10)}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
};

// System update
api.checkUpdate  = ()  => request('GET',  '/admin/update/check');
api.deployUpdate = ()  => request('POST', '/admin/update/deploy');
api.getDeployLog = ()  => request('GET',  '/admin/update/log');
