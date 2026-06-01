'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiClient } from '@/lib/api-client';
import { Transaction } from '@/types';
import { formatCurrency, formatDate, exportTransactions } from '@/lib/export-utils';
import { toast } from 'sonner';

export function TransactionHistory() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ type: 'all', dateFrom: '', dateTo: '', search: '' });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res: any = await apiClient.getTransactions();
        const data: Transaction[] = res.data || [];
        setTransactions(data);
        setFilteredTransactions(data);
      } catch (error: any) {
        toast.error(error.message || 'Failed to load transactions');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    let filtered = [...transactions];
    if (filters.type !== 'all') filtered = filtered.filter(txn => txn.type === filters.type);
    if (filters.dateFrom) filtered = filtered.filter(txn => new Date(txn.date) >= new Date(filters.dateFrom));
    if (filters.dateTo) filtered = filtered.filter(txn => new Date(txn.date) <= new Date(filters.dateTo));
    if (filters.search) {
      const term = filters.search.toLowerCase();
      filtered = filtered.filter(txn =>
        txn.invoiceNumber?.toLowerCase().includes(term) ||
        txn.customerName?.toLowerCase().includes(term) ||
        txn.items.some(item => item.medicineName.toLowerCase().includes(term))
      );
    }
    filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setFilteredTransactions(filtered);
    setCurrentPage(1);
  }, [transactions, filters]);

  const handleFilterChange = (key: string, value: string) => setFilters(prev => ({ ...prev, [key]: value }));

  const clearFilters = () => setFilters({ type: 'all', dateFrom: '', dateTo: '', search: '' });

  const handleExport = (type?: 'sell' | 'purchase') => {
    try {
      const data = type ? filteredTransactions.filter(txn => txn.type === type) : filteredTransactions;
      if (data.length === 0) { toast.error('No transactions to export'); return; }
      exportTransactions(data, type);
      toast.success('Transactions exported successfully');
    } catch {
      toast.error('Failed to export transactions');
    }
  };

  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentTransactions = filteredTransactions.slice(startIndex, startIndex + itemsPerPage);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-[var(--brand-blue)] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Filters & Search</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>Transaction Type</Label>
              <Select value={filters.type} onValueChange={(v) => handleFilterChange('type', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Transactions</SelectItem>
                  <SelectItem value="sell">Sales Only</SelectItem>
                  <SelectItem value="purchase">Purchases Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="dateFrom">From Date</Label>
              <Input id="dateFrom" type="date" value={filters.dateFrom} onChange={(e) => handleFilterChange('dateFrom', e.target.value)} />
            </div>
            <div>
              <Label htmlFor="dateTo">To Date</Label>
              <Input id="dateTo" type="date" value={filters.dateTo} onChange={(e) => handleFilterChange('dateTo', e.target.value)} />
            </div>
            <div>
              <Label htmlFor="search">Search</Label>
              <Input id="search" placeholder="Invoice, customer, medicine..." value={filters.search} onChange={(e) => handleFilterChange('search', e.target.value)} />
            </div>
          </div>
          <div className="flex justify-between items-center mt-4">
            <Button variant="outline" onClick={clearFilters}>Clear Filters</Button>
            <div className="flex space-x-2">
              <Button variant="outline" onClick={() => handleExport()}>Export All</Button>
              <Button variant="outline" onClick={() => handleExport('sell')}>Export Sales</Button>
              <Button variant="outline" onClick={() => handleExport('purchase')}>Export Purchases</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{filteredTransactions.length}</p><p className="text-sm text-[var(--foreground)]/70">Total Transactions</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-[var(--success)]">{filteredTransactions.filter(t => t.type === 'sell').length}</p><p className="text-sm text-[var(--foreground)]/70">Sales</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-[var(--brand-blue)]">{filteredTransactions.filter(t => t.type === 'purchase').length}</p><p className="text-sm text-[var(--foreground)]/70">Purchases</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{formatCurrency(filteredTransactions.reduce((sum, t) => sum + t.totalAmount, 0))}</p><p className="text-sm text-[var(--foreground)]/70">Total Value</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Transaction History ({filteredTransactions.length} transactions)</CardTitle></CardHeader>
        <CardContent>
          {currentTransactions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-[var(--foreground)]/70">No transactions found</p>
              <p className="text-sm text-[var(--foreground)]/60 mt-1">Try adjusting your filters or search terms</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Customer/Supplier</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Payment</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentTransactions.map((transaction) => (
                      <TableRow key={transaction._id || transaction.id}>
                        <TableCell className="font-medium">{transaction.invoiceNumber}</TableCell>
                        <TableCell>{formatDate(transaction.date)}</TableCell>
                        <TableCell><Badge variant={transaction.type === 'sell' ? 'default' : 'secondary'}>{transaction.type.toUpperCase()}</Badge></TableCell>
                        <TableCell>{transaction.customerName || transaction.supplierName || 'Walk-in Customer'}</TableCell>
                        <TableCell>
                          <div className="max-w-xs">
                            {transaction.items.slice(0, 2).map((item, i) => (
                              <p key={i} className="text-sm truncate">{item.medicineName} ({item.quantity})</p>
                            ))}
                            {transaction.items.length > 2 && <p className="text-xs text-[var(--foreground)]/60">+{transaction.items.length - 2} more</p>}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{formatCurrency(transaction.totalAmount)}</TableCell>
                        <TableCell><Badge variant="outline" className="capitalize">{transaction.paymentMethod}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-[var(--foreground)]/70">Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredTransactions.length)} of {filteredTransactions.length} transactions</p>
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Previous</Button>
                    <span className="flex items-center px-3 py-1 text-sm">Page {currentPage} of {totalPages}</span>
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
