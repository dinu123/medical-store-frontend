'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import { formatCurrency } from '@/lib/export-utils';

import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

export default function AnalyticsPage() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [lineChartData, setLineChartData] = useState<any[]>([]);
  const [monthlySalesData, setMonthlySalesData] = useState<any[]>([]);
  const [monthlyPurchasesData, setMonthlyPurchasesData] = useState<any[]>([]);
  const [dateRange, setDateRange] = useState<string>('');
  const [error, setError] = useState<string>('');

  const [allTransactions, setAllTransactions] = useState<any[]>([]);

  // Set default date range (last 6 months)
  useEffect(() => {
    const today = new Date();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(today.getMonth() - 6);
    setStartDate(sixMonthsAgo.toISOString().split('T')[0]);
    setEndDate(today.toISOString().split('T')[0]);
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const res: any = await apiClient.getTransactions();
        setAllTransactions(res.data || []);
      } catch (error) {
        console.error('Failed to load transactions:', error);
      }
    };
    load();
  }, []);

  const processLineChartData = (start: string, end: string) => {
    if (!start || !end) return [];
    const startD = new Date(start);
    const endD = new Date(end);
    const filtered = allTransactions.filter(t => new Date(t.date) >= startD && new Date(t.date) <= endD);
    const salesTransactions = filtered.filter(t => t.type === 'sell');
    const purchaseTransactions = filtered.filter(t => t.type === 'purchase');
    
    const transactionsByMonth: Record<string, { totalRevenue: number; totalSales: number; purchaseCost: number }> = {};
    
    // Process sales transactions
    salesTransactions.forEach(txn => {
      const date = new Date(txn.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!transactionsByMonth[monthKey]) {
        transactionsByMonth[monthKey] = { totalRevenue: 0, totalSales: 0, purchaseCost: 0 };
      }
      transactionsByMonth[monthKey].totalSales += txn.totalAmount;
    });
    
    // Process purchase transactions
    purchaseTransactions.forEach(txn => {
      const date = new Date(txn.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!transactionsByMonth[monthKey]) {
        transactionsByMonth[monthKey] = { totalRevenue: 0, totalSales: 0, purchaseCost: 0 };
      }
      transactionsByMonth[monthKey].purchaseCost += txn.totalAmount;
    });

    // Calculate total revenue as sales - purchase cost
    Object.keys(transactionsByMonth).forEach(key => {
      transactionsByMonth[key].totalRevenue = transactionsByMonth[key].totalSales - transactionsByMonth[key].purchaseCost;
    });

    return Object.entries(transactionsByMonth)
      .map(([month, amounts]) => ({
        month: new Date(month + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        totalRevenue: amounts.totalRevenue,
        totalSales: amounts.totalSales,
        sortDate: new Date(month + '-01')
      }))
      .sort((a, b) => a.sortDate.getTime() - b.sortDate.getTime());
  };

  const processMonthlySalesData = (start: string, end: string) => {
    if (!start || !end) return [];
    const startD = new Date(start);
    const endD = new Date(end);
    const salesTransactions = allTransactions.filter(t => t.type === 'sell' && new Date(t.date) >= startD && new Date(t.date) <= endD);
    const salesByMonth: Record<string, number> = {};
    
    salesTransactions.forEach(txn => {
      const date = new Date(txn.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!salesByMonth[monthKey]) {
        salesByMonth[monthKey] = 0;
      }
      salesByMonth[monthKey] += txn.totalAmount;
    });

    return Object.entries(salesByMonth)
      .map(([month, amount]) => ({
        month: new Date(month + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        sales: amount,
        sortDate: new Date(month + '-01')
      }))
      .sort((a, b) => a.sortDate.getTime() - b.sortDate.getTime());
  };

  const processMonthlyPurchasesData = (start: string, end: string) => {
    if (!start || !end) return [];
    const startD = new Date(start);
    const endD = new Date(end);
    const purchaseTransactions = allTransactions.filter(t => t.type === 'purchase' && new Date(t.date) >= startD && new Date(t.date) <= endD);
    const purchasesByMonth: Record<string, number> = {};
    
    purchaseTransactions.forEach(txn => {
      const date = new Date(txn.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!purchasesByMonth[monthKey]) {
        purchasesByMonth[monthKey] = 0;
      }
      purchasesByMonth[monthKey] += txn.totalAmount;
    });

    return Object.entries(purchasesByMonth)
      .map(([month, amount]) => ({
        month: new Date(month + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        purchases: amount,
        sortDate: new Date(month + '-01')
      }))
      .sort((a, b) => a.sortDate.getTime() - b.sortDate.getTime());
  };

  const handleApplyDateRange = () => {
    setError('');
    
    if (!startDate || !endDate) {
      setError('Please select both start and end dates');
      return;
    }
    
    if (new Date(startDate) > new Date(endDate)) {
      setError('Start date cannot be later than end date');
      return;
    }

    const lineData = processLineChartData(startDate, endDate);
    const salesData = processMonthlySalesData(startDate, endDate);
    const purchasesData = processMonthlyPurchasesData(startDate, endDate);
    
    setLineChartData(lineData);
    setMonthlySalesData(salesData);
    setMonthlyPurchasesData(purchasesData);
    
    const startFormatted = new Date(startDate).toLocaleDateString('en-US', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
    const endFormatted = new Date(endDate).toLocaleDateString('en-US', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
    setDateRange(`${startFormatted} - ${endFormatted}`);
  };

  // Load initial data
  useEffect(() => {
    if (startDate && endDate && allTransactions.length >= 0) {
      handleApplyDateRange();
    }
  }, [startDate, endDate, allTransactions]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--brand-blue)]">Analytics</h1>
        <p className="text-[var(--foreground)]/70 mt-1">Advanced insights and data visualization</p>
      </div>

      {/* Date Range Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Date Range Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1">
              <label htmlFor="startDate" className="block text-sm font-medium mb-2">
                Start Date
              </label>
              <input
                type="date"
                id="startDate"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex-1">
              <label htmlFor="endDate" className="block text-sm font-medium mb-2">
                End Date
              </label>
              <input
                type="date"
                id="endDate"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <Button onClick={handleApplyDateRange} className="px-6">
              Apply
            </Button>
          </div>
          {error && (
            <p className="text-red-500 text-sm mt-2">{error}</p>
          )}
          {dateRange && (
            <p className="text-gray-600 text-sm mt-2">
              Showing data for: {dateRange}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Revenue & Sales Line Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue & Sales Trend</CardTitle>
        </CardHeader>
        <CardContent>
          {lineChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={lineChartData} margin={{ top: 20, right: 30, left: 20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis 
                  dataKey="month" 
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis 
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) => formatCurrency(value)}
                  width={70}
                />
                <Tooltip 
                  formatter={(value: number, name: string) => [
                    formatCurrency(value), 
                    name === 'totalRevenue' ? 'Total Revenue' : 'Total Sales'
                  ]}
                  labelStyle={{ color: '#1e293b' }}
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <Line 
                  type="linear" 
                  dataKey="totalRevenue" 
                  stroke="#4F46E5" 
                  strokeWidth={2}
                  dot={{ fill: '#4F46E5', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, fill: '#4F46E5' }}
                />
                <Line 
                  type="linear" 
                  dataKey="totalSales" 
                  stroke="#06B6D4" 
                  strokeWidth={2}
                  dot={{ fill: '#06B6D4', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, fill: '#06B6D4' }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500 text-sm">
                No data available for the selected date range.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bar Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Sales Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Monthly Sales</CardTitle>
          </CardHeader>
          <CardContent>
            {monthlySalesData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlySalesData} margin={{ top: 20, right: 30, left: 20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="month" 
                    tick={{ fontSize: 12, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis 
                    tick={{ fontSize: 12, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) => formatCurrency(value)}
                    width={70}
                  />
                  <Tooltip 
                    formatter={(value: number) => [formatCurrency(value), 'Sales']}
                    labelStyle={{ color: '#1e293b' }}
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                  <Bar 
                    dataKey="sales" 
                    fill="#06B6D4"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500 text-sm">
                  No sales data available for the selected date range.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Monthly Purchases Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Monthly Purchases</CardTitle>
          </CardHeader>
          <CardContent>
            {monthlyPurchasesData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyPurchasesData} margin={{ top: 20, right: 30, left: 20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="month" 
                    tick={{ fontSize: 12, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis 
                    tick={{ fontSize: 12, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) => formatCurrency(value)}
                    width={70}
                  />
                  <Tooltip 
                    formatter={(value: number) => [formatCurrency(value), 'Purchases']}
                    labelStyle={{ color: '#1e293b' }}
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                  <Bar 
                    dataKey="purchases" 
                    fill="#F04438"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500 text-sm">
                  No purchase data available for the selected date range.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
