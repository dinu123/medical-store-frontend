'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';
import { DashboardStats, Transaction, ExpiringMedicine } from '@/types';
import { formatCurrency, formatDate } from '@/lib/export-utils';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { NotificationPanel } from './NotificationPanel';
import { UserMenu } from './UserMenu';

import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

type TimeRange = 'day' | 'week' | 'month';

export function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [expiringMedicines, setExpiringMedicines] = useState<ExpiringMedicine[]>([]);
  const [lowStockMedicines, setLowStockMedicines] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>('month');
  const [dateRange, setDateRange] = useState<string>('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const processChartData = (transactions: Transaction[], timeRange: TimeRange) => {
    const salesTransactions = transactions.filter(t => t.type === 'sell');
    const purchaseTransactions = transactions.filter(t => t.type === 'purchase');

    let formatKey: (dateStr: string) => string;
    let displayFormat: (key: string) => string;
    let getDateForRange: (key: string) => Date;

    if (timeRange === 'month') {
      formatKey = (dateStr) => {
        const d = new Date(dateStr);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      };
      displayFormat = (key) => {
        const d = new Date(key + '-01');
        return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      };
      getDateForRange = (key) => new Date(key + '-01');
    } else if (timeRange === 'week') {
      formatKey = (dateStr) => {
        const d = new Date(dateStr);
        const start = new Date(d);
        start.setDate(d.getDate() - d.getDay());
        return start.toISOString().split('T')[0];
      };
      displayFormat = (key) => {
        const d = new Date(key);
        return `Week ${Math.ceil(d.getDate() / 7)} '${d.getFullYear().toString().slice(-2)}`;
      };
      getDateForRange = (key) => new Date(key);
    } else {
      formatKey = (dateStr) => {
        const d = new Date(dateStr);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      };
      displayFormat = (key) => new Date(key).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
      getDateForRange = (key) => new Date(key);
    }

    const byPeriod: Record<string, { totalRevenue: number; totalSales: number; purchaseCost: number }> = {};

    salesTransactions.forEach(txn => {
      const key = formatKey(txn.date);
      if (!byPeriod[key]) byPeriod[key] = { totalRevenue: 0, totalSales: 0, purchaseCost: 0 };
      byPeriod[key].totalSales += txn.totalAmount;
    });

    purchaseTransactions.forEach(txn => {
      const key = formatKey(txn.date);
      if (!byPeriod[key]) byPeriod[key] = { totalRevenue: 0, totalSales: 0, purchaseCost: 0 };
      byPeriod[key].purchaseCost += txn.totalAmount;
    });

    Object.keys(byPeriod).forEach(key => {
      byPeriod[key].totalRevenue = byPeriod[key].totalSales - byPeriod[key].purchaseCost;
    });

    return Object.entries(byPeriod)
      .map(([period, amounts]) => ({
        period: displayFormat(period),
        totalRevenue: amounts.totalRevenue,
        totalSales: amounts.totalSales,
        purchaseCost: amounts.purchaseCost,
        sortDate: getDateForRange(period),
      }))
      .sort((a, b) => a.sortDate.getTime() - b.sortDate.getTime())
      .slice(-12);
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [statsRes, txnRes, expiringRes, inventoryRes]: any[] = await Promise.all([
          apiClient.getDashboardStats(),
          apiClient.getTransactions(),
          apiClient.getExpiringMedicines(15),
          apiClient.getInventory(),
        ]);

        const dashStats = statsRes.data;
        const transactions: Transaction[] = txnRes.data || [];
        const expiring: ExpiringMedicine[] = expiringRes.data || [];
        const inventory = inventoryRes.data || [];
        const lowStock = inventory.filter((item: any) => item.isLowStock);

        setStats(dashStats);
        setAllTransactions(transactions);
        setRecentTransactions([...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5));
        setExpiringMedicines(expiring);
        setLowStockMedicines(lowStock);
        setNotificationCount(lowStock.length + expiring.length + 1);

        const processed = processChartData(transactions, selectedTimeRange);
        setChartData(processed);
        if (processed.length > 0) {
          const first = processed[0].sortDate;
          const last = processed[processed.length - 1].sortDate;
          const fmt = (d: Date) => d.toLocaleDateString('en-US', { day: '2-digit', month: '2-digit', year: 'numeric' });
          setDateRange(`${fmt(first)} - ${fmt(last)}`);
        }
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    if (allTransactions.length > 0) {
      const processed = processChartData(allTransactions, selectedTimeRange);
      setChartData(processed);
      if (processed.length > 0) {
        const first = processed[0].sortDate;
        const last = processed[processed.length - 1].sortDate;
        const fmt = (d: Date) => d.toLocaleDateString('en-US', { day: '2-digit', month: '2-digit', year: 'numeric' });
        setDateRange(`${fmt(first)} - ${fmt(last)}`);
      }
    }
  }, [selectedTimeRange]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const isProfit = data.totalRevenue >= 0;
      return (
        <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900 mb-2">{label}</p>
          <div className="space-y-1">
            <p className="text-sm"><span className="text-cyan-600">Sales: </span><span className="font-medium">{formatCurrency(data.totalSales)}</span></p>
            <p className="text-sm"><span className="text-gray-600">Purchases: </span><span className="font-medium">{formatCurrency(data.purchaseCost)}</span></p>
            <div className="border-t pt-1">
              <p className="text-sm">
                <span className={isProfit ? 'text-green-600' : 'text-red-600'}>{isProfit ? 'Profit: ' : 'Loss: '}</span>
                <span className={`font-medium ${isProfit ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(Math.abs(data.totalRevenue))}</span>
              </p>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-[var(--brand-blue)] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[var(--foreground)]/70">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--brand-blue)]">Dashboard</h1>
          <p className="text-[var(--foreground)]/70 mt-1">Welcome to MediStore Pro</p>
        </div>
        <div className="flex items-center space-x-3 mt-4 sm:mt-0">
          <Link href="/transactions/quick-sell"><Button size="sm">New Transaction</Button></Link>
          <Link href="/inventory"><Button variant="outline" size="sm">View Inventory</Button></Link>
          <div className="relative">
            <Button variant="ghost" size="sm" onClick={() => setShowNotifications(!showNotifications)} className="relative p-3">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {notificationCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {notificationCount > 9 ? '9+' : notificationCount}
                </span>
              )}
            </Button>
          </div>
          <div className="relative">
            <Button variant="ghost" size="sm" onClick={() => setShowUserMenu(!showUserMenu)} className="relative p-3">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </Button>
          </div>
        </div>
      </div>

      <NotificationPanel isOpen={showNotifications} onClose={() => setShowNotifications(false)} />
      <UserMenu isOpen={showUserMenu} onClose={() => setShowUserMenu(false)} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push('/transactions/history?type=sell')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Sales</CardTitle>
            <span className="text-2xl">💰</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats?.totalRevenue || 0)}</div>
            <p className="text-xs text-muted-foreground">Revenue this month</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push('/transactions/history?type=purchase')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
            <span className="text-2xl">📦</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalTransactions || 0}</div>
            <p className="text-xs text-muted-foreground">All time transactions</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push('/inventory?filter=low-stock')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
            <span className="text-2xl">⚠️</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[var(--warning)]">{stats?.lowStockMedicines || 0}</div>
            <p className="text-xs text-muted-foreground">Need restocking</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push('/expiring')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
            <span className="text-2xl">📅</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[var(--error)]">{stats?.expiringSoon || 0}</div>
            <p className="text-xs text-muted-foreground">Within 30 days</p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between mb-6 space-y-4 lg:space-y-0">
              <div className="flex flex-col sm:flex-row gap-6">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full bg-[#4F46E5]"></div>
                    <span className="text-sm font-medium text-[#4F46E5]">Profit/Loss</span>
                  </div>
                  <div className="text-xs text-gray-500">{dateRange}</div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full bg-[#06B6D4]"></div>
                    <span className="text-sm font-medium text-[#06B6D4]">Total Sales</span>
                  </div>
                </div>
              </div>
              <div className="flex bg-gray-100 rounded-lg p-1">
                {(['day', 'week', 'month'] as TimeRange[]).map((range) => (
                  <button
                    key={range}
                    onClick={() => setSelectedTimeRange(range)}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${selectedTimeRange === range ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                  >
                    {range.charAt(0).toUpperCase() + range.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={400}>
                <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="period" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCurrency(v)} width={70} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area key="totalRevenue" type="linear" dataKey="totalRevenue" fill="#4F46E5" fillOpacity={0.1} stroke="#4F46E5" strokeWidth={3} dot={{ fill: '#4F46E5', strokeWidth: 2, r: 5 }} activeDot={{ r: 7, fill: '#4F46E5' }} />
                  <Area key="totalSales" type="linear" dataKey="totalSales" fill="#06B6D4" fillOpacity={0.1} stroke="#06B6D4" strokeWidth={2} dot={{ fill: '#06B6D4', strokeWidth: 2, r: 4 }} activeDot={{ r: 6, fill: '#06B6D4' }} />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-8">
                <p className="text-[var(--foreground)]/70 text-sm">No transactional data available to display.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Transactions</CardTitle>
            <Link href="/transactions/history"><Button variant="outline" size="sm">View All</Button></Link>
          </CardHeader>
          <CardContent>
            {recentTransactions.length === 0 ? (
              <p className="text-[var(--foreground)]/70 text-center py-4">No recent transactions</p>
            ) : (
              <div className="space-y-3">
                {recentTransactions.map((transaction) => (
                  <div key={transaction.id} className="flex items-center justify-between p-3 bg-[var(--panel-bg)] rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <Badge variant={transaction.type === 'sell' ? 'default' : 'secondary'}>{transaction.type.toUpperCase()}</Badge>
                        <span className="text-sm font-medium">{transaction.invoiceNumber}</span>
                      </div>
                      <p className="text-sm text-[var(--foreground)]/70 mt-1">{transaction.items.length} item(s) • {formatDate(transaction.date)}</p>
                      {transaction.customerName && <p className="text-xs text-[var(--foreground)]/60">{transaction.customerName}</p>}
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(transaction.totalAmount)}</p>
                      <p className="text-xs text-[var(--foreground)]/60 capitalize">{transaction.paymentMethod}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Alerts & Notifications</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-4">
              {lowStockMedicines.length > 0 && (
                <div className="p-3 bg-[var(--warning)]/10 border border-[var(--warning)]/20 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-[var(--warning)]">Low Stock Alert</h4>
                      <p className="text-sm text-[var(--warning)]/80">{lowStockMedicines.length} medicines need restocking</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => router.push('/inventory?filter=low-stock')}>View</Button>
                  </div>
                  <div className="mt-2 space-y-1">
                    {lowStockMedicines.slice(0, 3).map((item: any) => (
                      <p key={item.medicineId} className="text-xs text-[var(--warning)]/90">• {item.medicine.name} ({item.quantity} left)</p>
                    ))}
                    {lowStockMedicines.length > 3 && <p className="text-xs text-[var(--warning)]/80">+{lowStockMedicines.length - 3} more items</p>}
                  </div>
                </div>
              )}

              {expiringMedicines.length > 0 && (
                <div className="p-3 bg-[var(--error)]/10 border border-[var(--error)]/20 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-[var(--error)]">Expiring Soon</h4>
                      <p className="text-sm text-[var(--error)]/80">{expiringMedicines.length} medicines expiring within 15 days</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => router.push('/expiring')}>View</Button>
                  </div>
                  <div className="mt-2 space-y-1">
                    {expiringMedicines.slice(0, 3).map((medicine) => (
                      <p key={medicine.id} className="text-xs text-[var(--error)]/90">• {medicine.name} (expires {formatDate(medicine.expiryDate)})</p>
                    ))}
                    {expiringMedicines.length > 3 && <p className="text-xs text-[var(--error)]/80">+{expiringMedicines.length - 3} more medicines</p>}
                  </div>
                </div>
              )}

              {lowStockMedicines.length === 0 && expiringMedicines.length === 0 && (
                <div className="p-3 bg-[var(--success)]/10 border border-[var(--success)]/20 rounded-lg">
                  <div className="flex items-center">
                    <span className="text-[var(--success)] mr-2">✓</span>
                    <div>
                      <h4 className="font-medium text-[var(--success)]">All Good!</h4>
                      <p className="text-sm text-[var(--success)]/80">No critical alerts at this time</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
