// API Client for Medical Store Backend

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

interface RequestOptions extends RequestInit {
  headers?: Record<string, string>;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private getAuthToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('authToken');
    }
    return null;
  }

  private async request<T>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const token = this.getAuthToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `HTTP Error: ${response.status}`);
    }

    return response.json();
  }

  // Auth endpoints
  async register(data: {
    email?: string;
    password?: string;
    phone?: string;
    shopName: string;
    contactNumber: string;
    ownerName: string;
    address?: string;
    gstin?: string;
  }) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async login(data: {
    email?: string;
    password?: string;
    phone?: string;
  }) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async socialLogin(data: {
    email?: string;
    phone?: string;
    provider: string;
    shopName?: string;
    ownerName?: string;
  }) {
    return this.request('/auth/social-login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getProfile() {
    return this.request('/auth/profile', {
      method: 'GET',
    });
  }

  async updateProfile(data: {
    shopName?: string;
    address?: string;
    contactNumber?: string;
    ownerName?: string;
    gstin?: string;
  }) {
    return this.request('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Medicine endpoints
  async getMedicines() {
    return this.request('/medicines', {
      method: 'GET',
    });
  }

  async getMedicineById(id: string) {
    return this.request(`/medicines/${id}`, {
      method: 'GET',
    });
  }

  async createMedicine(data: any) {
    return this.request('/medicines', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateMedicine(id: string, data: any) {
    return this.request(`/medicines/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteMedicine(id: string) {
    return this.request(`/medicines/${id}`, {
      method: 'DELETE',
    });
  }

  async searchMedicines(query: string) {
    return this.request(`/medicines/search?query=${encodeURIComponent(query)}`, {
      method: 'GET',
    });
  }

  async getInventory() {
    return this.request('/medicines/inventory', {
      method: 'GET',
    });
  }

  async exportInventory() {
    const url = `${this.baseUrl}/medicines/inventory/export`;
    const token = this.getAuthToken();
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
      },
    });
    if (!response.ok) throw new Error('Failed to export inventory');
    const blob = await response.blob();
    const filename = `inventory-report-${new Date().toISOString().split('T')[0]}.csv`;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  async getExpiringMedicines(days: number = 30) {
    return this.request(`/medicines/expiring?days=${days}`, {
      method: 'GET',
    });
  }

  async bulkUploadMedicines(medicines: any[]) {
    return this.request('/medicines/bulk-upload', {
      method: 'POST',
      body: JSON.stringify({ medicines }),
    });
  }

  // Transaction endpoints
  async createTransaction(data: any) {
    return this.request('/transactions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getTransactions(type?: string, startDate?: string, endDate?: string) {
    let query = '';
    if (type) query += `type=${type}&`;
    if (startDate) query += `startDate=${startDate}&`;
    if (endDate) query += `endDate=${endDate}&`;

    return this.request(`/transactions?${query}`, {
      method: 'GET',
    });
  }

  async getTransactionById(id: string) {
    return this.request(`/transactions/${id}`, {
      method: 'GET',
    });
  }

  async getTaxData(startDate?: string, endDate?: string) {
    let query = '';
    if (startDate) query += `startDate=${startDate}&`;
    if (endDate) query += `endDate=${endDate}&`;

    return this.request(`/transactions/tax-data?${query}`, {
      method: 'GET',
    });
  }

  async getDashboardStats() {
    return this.request('/transactions/dashboard-stats', {
      method: 'GET',
    });
  }

  // Supplier endpoints
  async getSuppliers() {
    return this.request('/suppliers', {
      method: 'GET',
    });
  }

  async getSupplierById(id: string) {
    return this.request(`/suppliers/${id}`, {
      method: 'GET',
    });
  }

  async createSupplier(data: {
    name: string;
    address: string;
    contactNumber: string;
    gstinNumber?: string;
  }) {
    return this.request('/suppliers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateSupplier(id: string, data: any) {
    return this.request(`/suppliers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteSupplier(id: string) {
    return this.request(`/suppliers/${id}`, {
      method: 'DELETE',
    });
  }
}

export const apiClient = new ApiClient();
