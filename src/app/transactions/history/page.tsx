'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';
import { Transaction } from '@/types';
import { formatCurrency, formatDate } from '@/lib/export-utils';
import { toast } from 'sonner';

function normalizeTransaction(txn: Record<string, unknown>): Transaction {
  const id =
    (typeof txn._id === 'string' ? txn._id : (txn._id as { toString?: () => string })?.toString?.()) ||
    (txn.id as string) ||
    '';
  return { ...(txn as Transaction), id };
}

export default function TransactionHistoryPage() {
  const searchParams = useSearchParams();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    type: searchParams.get('type') || 'all',
    startDate: searchParams.get('startDate') || '',
    endDate: searchParams.get('endDate') || '',
    paymentMethod: 'all',
    searchTerm: ''
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  const loadTransactions = useCallback(async (startDate: string, endDate: string, type: string) => {
    try {
      setLoading(true);
      const apiType = type !== 'all' ? type : undefined;
      const res: { data?: unknown[] } = await apiClient.getTransactions(
        apiType,
        startDate || undefined,
        endDate || undefined
      );
      const data = (res.data || []).map((txn) => normalizeTransaction(txn as Record<string, unknown>));
      setTransactions(data);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to load transactions');
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const today = new Date();
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(today.getMonth() - 1);

    const startDate = filters.startDate || oneMonthAgo.toISOString().split('T')[0];
    const endDate = filters.endDate || today.toISOString().split('T')[0];

    if (!filters.startDate || !filters.endDate) {
      setFilters((prev) => ({
        ...prev,
        startDate,
        endDate,
      }));
      return;
    }

    loadTransactions(startDate, endDate, filters.type);
  }, [filters.startDate, filters.endDate, filters.type, loadTransactions]);

  useEffect(() => {
    let filtered = [...transactions];

    if (filters.paymentMethod !== 'all') {
      filtered = filtered.filter((txn) => txn.paymentMethod === filters.paymentMethod);
    }

    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase();
      filtered = filtered.filter(
        (txn) =>
          txn.invoiceNumber?.toLowerCase().includes(searchLower) ||
          (txn.customerName && txn.customerName.toLowerCase().includes(searchLower)) ||
          txn.items.some((item) => item.medicineName.toLowerCase().includes(searchLower))
      );
    }

    filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    setFilteredTransactions(filtered);
    setCurrentPage(1);
  }, [transactions, filters.paymentMethod, filters.searchTerm]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const clearFilters = () => {
    const today = new Date();
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(today.getMonth() - 1);

    setFilters({
      type: 'all',
      startDate: oneMonthAgo.toISOString().split('T')[0],
      endDate: today.toISOString().split('T')[0],
      paymentMethod: 'all',
      searchTerm: '',
    });
  };

  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentTransactions = filteredTransactions.slice(startIndex, endIndex);

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const calculateTotals = () => {
    const sales = filteredTransactions.filter((txn) => txn.type === 'sell');
    const purchases = filteredTransactions.filter((txn) => txn.type === 'purchase');

    return {
      totalSales: sales.reduce((sum, txn) => sum + txn.totalAmount, 0),
      totalPurchases: purchases.reduce((sum, txn) => sum + txn.totalAmount, 0),
      salesCount: sales.length,
      purchasesCount: purchases.length,
    };
  };

  const totals = calculateTotals();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--brand-blue)]">Transaction History</h1>
        <p className="text-[var(--foreground)]/70 mt-1">View and manage all transactions</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-gray-600">Total Sales</div>
            <div className="text-xl font-bold text-green-600">{formatCurrency(totals.totalSales)}</div>
            <div className="text-xs text-gray-500">{totals.salesCount} transactions</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-gray-600">Total Purchases</div>
            <div className="text-xl font-bold text-blue-600">{formatCurrency(totals.totalPurchases)}</div>
            <div className="text-xs text-gray-500">{totals.purchasesCount} transactions</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-gray-600">Net Profit</div>
            <div
              className={`text-xl font-bold ${totals.totalSales - totals.totalPurchases >= 0 ? 'text-green-600' : 'text-red-600'}`}
            >
              {formatCurrency(totals.totalSales - totals.totalPurchases)}
            </div>
            <div className="text-xs text-gray-500">For selected period</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-gray-600">Total Transactions</div>
            <div className="text-xl font-bold">{filteredTransactions.length}</div>
            <div className="text-xs text-gray-500">In selected period</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div className="space-y-2">
              <Label>Transaction Type</Label>
              <Select value={filters.type} onValueChange={(value) => handleFilterChange('type', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="sell">Sales</SelectItem>
                  <SelectItem value="purchase">Purchases</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select
                value={filters.paymentMethod}
                onValueChange={(value) => handleFilterChange('paymentMethod', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Methods</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Search</Label>
              <Input
                placeholder="Invoice, customer, medicine..."
                value={filters.searchTerm}
                onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>&nbsp;</Label>
              <Button variant="outline" onClick={clearFilters} className="w-full">
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Transactions ({filteredTransactions.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Loading transactions...</p>
            </div>
          ) : currentTransactions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No transactions found for the selected filters</p>
            </div>
          ) : (
            <div className="space-y-4">
              {currentTransactions.map((transaction) => (
                <div key={transaction.id} className="border rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <Badge variant={transaction.type === 'sell' ? 'default' : 'secondary'}>
                          {transaction.type.toUpperCase()}
                        </Badge>
                        <span className="font-medium">{transaction.invoiceNumber}</span>
                        <span className="text-sm text-gray-500">{formatDate(transaction.date)}</span>
                      </div>

                      {transaction.customerName && (
                        <p className="text-sm text-gray-600 mb-1">Customer: {transaction.customerName}</p>
                      )}

                      <div className="text-sm text-gray-600">
                        <span>{transaction.items.length} item(s)</span>
                        <span className="mx-2">•</span>
                        <span className="capitalize">{transaction.paymentMethod}</span>
                      </div>

                      <div className="mt-2">
                        <details className="text-sm">
                          <summary className="cursor-pointer text-blue-600 hover:text-blue-800">
                            View Items
                          </summary>
                          <div className="mt-2 pl-4 border-l-2 border-gray-200">
                            {transaction.items.map((item, index) => (
                              <div key={index} className="py-1">
                                <span className="font-medium">{item.medicineName}</span>
                                <span className="text-gray-500 ml-2">
                                  {item.quantity} × {formatCurrency(item.price)} ={' '}
                                  {formatCurrency(item.quantity * item.price)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </details>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-lg font-bold">{formatCurrency(transaction.totalAmount)}</div>
                      <div className="text-sm text-gray-500">GST: {formatCurrency(transaction.gstAmount)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <div className="text-sm text-gray-600">
                Showing {startIndex + 1} to {Math.min(endIndex, filteredTransactions.length)} of{' '}
                {filteredTransactions.length} transactions
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <span className="text-sm">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
