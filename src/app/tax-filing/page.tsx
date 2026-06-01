'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiClient } from '@/lib/api-client';
import { TaxData, Transaction } from '@/types';
import { formatCurrency, formatDate, generateTaxReport, exportTaxReport, exportDetailedTaxReport } from '@/lib/export-utils';
import { toast } from 'sonner';

export default function TaxFilingPage() {
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), 3, 1).toISOString().split('T')[0], // April 1st (Indian FY start)
    endDate: new Date().toISOString().split('T')[0]
  });
  const [taxData, setTaxData] = useState<TaxData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    generateReport();
  }, []);

  const generateReport = async () => {
    setIsGenerating(true);
    try {
      const res: any = await apiClient.getTaxData(dateRange.startDate, dateRange.endDate);
      if (res.success && res.data) {
        setTaxData(res.data);
      }
    } catch (error) {
      console.error('Error generating tax report:', error);
      toast.error('Failed to generate tax report');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDateChange = (field: 'startDate' | 'endDate', value: string) => {
    setDateRange(prev => ({ ...prev, [field]: value }));
  };

  const handleExportSummary = () => {
    if (!taxData) return;
    try {
      exportTaxReport(taxData);
      toast.success('Tax summary exported successfully');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export tax summary');
    }
  };

  const handleExportDetailed = () => {
    if (!taxData) return;
    try {
      exportDetailedTaxReport(taxData);
      toast.success('Detailed tax report exported successfully');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export detailed report');
    }
  };

  if (!taxData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-[var(--brand-blue)] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[var(--foreground)]/70">Generating tax report...</p>
        </div>
      </div>
    );
  }

  const salesTransactions = taxData.transactions.filter(txn => txn.type === 'sell');
  const purchaseTransactions = taxData.transactions.filter(txn => txn.type === 'purchase');
  const netGSTLiability = taxData.gstCollected - taxData.gstPaid;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--brand-blue)]">Tax Filing & CA Reports</h1>
          <p className="text-[var(--foreground)]/70 mt-1">Generate comprehensive tax reports for CA and IT filing</p>
        </div>
        <div className="flex space-x-3 mt-4 sm:mt-0">
          <Button onClick={handleExportSummary} variant="outline">
            Export Summary
          </Button>
          <Button onClick={handleExportDetailed}>
            Export Detailed Report
          </Button>
        </div>
      </div>

      {/* Date Range Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Report Period</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <Label htmlFor="startDate">From Date</Label>
              <Input
                id="startDate"
                type="date"
                value={dateRange.startDate}
                onChange={(e) => handleDateChange('startDate', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="endDate">To Date</Label>
              <Input
                id="endDate"
                type="date"
                value={dateRange.endDate}
                onChange={(e) => handleDateChange('endDate', e.target.value)}
              />
            </div>
            <div>
              <Button onClick={generateReport} disabled={isGenerating} className="w-full">
                {isGenerating ? 'Generating...' : 'Generate Report'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
            <span className="text-2xl">💰</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[var(--success)]">{formatCurrency(taxData.totalSales)}</div>
            <p className="text-xs text-muted-foreground">
              {salesTransactions.length} transactions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Purchases</CardTitle>
            <span className="text-2xl">📦</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[var(--brand-blue)]">{formatCurrency(taxData.totalPurchases)}</div>
            <p className="text-xs text-muted-foreground">
              {purchaseTransactions.length} transactions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">GST Collected</CardTitle>
            <span className="text-2xl">📋</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[var(--warning)]">{formatCurrency(taxData.gstCollected)}</div>
            <p className="text-xs text-muted-foreground">
              Output GST on sales
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net GST Liability</CardTitle>
            <span className="text-2xl">🧾</span>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${netGSTLiability >= 0 ? 'text-[var(--error)]' : 'text-[var(--success)]'}`}>
              {formatCurrency(Math.abs(netGSTLiability))}
            </div>
            <p className="text-xs text-muted-foreground">
              {netGSTLiability >= 0 ? 'Payable' : 'Refundable'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Reports */}
      <Tabs defaultValue="summary" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="sales">Sales Details</TabsTrigger>
          <TabsTrigger value="purchases">Purchase Details</TabsTrigger>
          <TabsTrigger value="gst">GST Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Financial Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Revenue & Expenses</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span>Total Sales Revenue:</span>
                      <span className="font-medium text-[var(--success)]">{formatCurrency(taxData.totalSales)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Purchase Cost:</span>
                      <span className="font-medium text-[var(--brand-blue)]">{formatCurrency(taxData.totalPurchases)}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className="font-semibold">Gross Profit:</span>
                      <span className={`font-bold ${taxData.netProfit >= 0 ? 'text-[var(--success)]' : 'text-[var(--error)]'}`}>
                        {formatCurrency(taxData.netProfit)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Profit Margin:</span>
                      <span className="font-medium">
                        {taxData.totalSales > 0 ? ((taxData.netProfit / taxData.totalSales) * 100).toFixed(2) : 0}%
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">GST Summary</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span>GST Collected (Output):</span>
                      <span className="font-medium text-[var(--warning)]">{formatCurrency(taxData.gstCollected)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>GST Paid (Input):</span>
                      <span className="font-medium text-[var(--brand-blue)]">{formatCurrency(taxData.gstPaid)}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className="font-semibold">Net GST Liability:</span>
                      <span className={`font-bold ${netGSTLiability >= 0 ? 'text-[var(--error)]' : 'text-[var(--success)]'}`}>
                        {formatCurrency(Math.abs(netGSTLiability))} {netGSTLiability >= 0 ? '(Payable)' : '(Refund)'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Effective GST Rate:</span>
                      <span className="font-medium">
                        {taxData.totalSales > 0 ? ((taxData.gstCollected / (taxData.totalSales - taxData.gstCollected)) * 100).toFixed(2) : 0}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sales" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Sales Transactions ({salesTransactions.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Invoice No.</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>Taxable Amount</TableHead>
                      <TableHead>GST Amount</TableHead>
                      <TableHead>Total Amount</TableHead>
                      <TableHead>Payment</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {salesTransactions.map((transaction) => {
                      const taxableAmount = transaction.totalAmount - transaction.gstAmount;
                      return (
                        <TableRow key={transaction.id}>
                          <TableCell>{formatDate(transaction.date)}</TableCell>
                          <TableCell className="font-medium">{transaction.invoiceNumber}</TableCell>
                          <TableCell>{transaction.customerName || 'Walk-in Customer'}</TableCell>
                          <TableCell>
                            <div className="max-w-xs">
                              {transaction.items.slice(0, 2).map((item, index) => (
                                <p key={index} className="text-sm truncate">
                                  {item.medicineName} ({item.quantity})
                                </p>
                              ))}
                              {transaction.items.length > 2 && (
                                <p className="text-xs text-[var(--foreground)]/60">+{transaction.items.length - 2} more</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{formatCurrency(taxableAmount)}</TableCell>
                          <TableCell>{formatCurrency(transaction.gstAmount)}</TableCell>
                          <TableCell className="font-medium">{formatCurrency(transaction.totalAmount)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">{transaction.paymentMethod}</Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="purchases" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Purchase Transactions ({purchaseTransactions.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Invoice No.</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>Taxable Amount</TableHead>
                      <TableHead>GST Amount</TableHead>
                      <TableHead>Total Amount</TableHead>
                      <TableHead>Payment</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchaseTransactions.map((transaction) => {
                      const taxableAmount = transaction.totalAmount - transaction.gstAmount;
                      return (
                        <TableRow key={transaction.id}>
                          <TableCell>{formatDate(transaction.date)}</TableCell>
                          <TableCell className="font-medium">{transaction.invoiceNumber}</TableCell>
                          <TableCell>Supplier</TableCell>
                          <TableCell>
                            <div className="max-w-xs">
                              {transaction.items.slice(0, 2).map((item, index) => (
                                <p key={index} className="text-sm truncate">
                                  {item.medicineName} ({item.quantity})
                                </p>
                              ))}
                              {transaction.items.length > 2 && (
                                <p className="text-xs text-[var(--foreground)]/60">+{transaction.items.length - 2} more</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{formatCurrency(taxableAmount)}</TableCell>
                          <TableCell>{formatCurrency(transaction.gstAmount)}</TableCell>
                          <TableCell className="font-medium">{formatCurrency(transaction.totalAmount)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">{transaction.paymentMethod}</Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="gst" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>GST Analysis & Compliance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Monthly GST Breakdown</h3>
                  <div className="space-y-3">
                    <div className="p-4 bg-[var(--success)]/10 border border-[var(--success)]/20 rounded-lg">
                      <h4 className="font-medium text-[var(--success)]">Output GST (Sales)</h4>
                      <p className="text-2xl font-bold text-[var(--success)]">{formatCurrency(taxData.gstCollected)}</p>
                      <p className="text-sm text-[var(--success)]/80">CGST: {formatCurrency(taxData.gstCollected / 2)}</p>
                      <p className="text-sm text-[var(--success)]/80">SGST: {formatCurrency(taxData.gstCollected / 2)}</p>
                    </div>
                    <div className="p-4 bg-[var(--brand-blue)]/10 border border-[var(--brand-blue)]/20 rounded-lg">
                      <h4 className="font-medium text-[var(--brand-blue)]">Input GST (Purchases)</h4>
                      <p className="text-2xl font-bold text-[var(--brand-blue)]">{formatCurrency(taxData.gstPaid)}</p>
                      <p className="text-sm text-[var(--brand-blue)]/80">CGST: {formatCurrency(taxData.gstPaid / 2)}</p>
                      <p className="text-sm text-[var(--brand-blue)]/80">SGST: {formatCurrency(taxData.gstPaid / 2)}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Compliance Status</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-[var(--panel-bg)] rounded-lg">
                      <span>GST Registration Required:</span>
                      <Badge variant={taxData.totalSales > 2000000 ? "destructive" : "default"}>
                        {taxData.totalSales > 2000000 ? "Yes" : "No"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-[var(--panel-bg)] rounded-lg">
                      <span>Annual Turnover:</span>
                      <span className="font-medium">{formatCurrency(taxData.totalSales)}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-[var(--panel-bg)] rounded-lg">
                      <span>Quarterly Return Filing:</span>
                      <Badge variant="outline">Required</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-[var(--panel-bg)] rounded-lg">
                      <span>TDS Applicable:</span>
                      <Badge variant={taxData.totalPurchases > 5000000 ? "destructive" : "default"}>
                        {taxData.totalPurchases > 5000000 ? "Yes" : "No"}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 p-4 bg-[var(--warning)]/10 border border-[var(--warning)]/20 rounded-lg">
                <h4 className="font-medium text-[var(--warning)] mb-2">Important Notes for CA:</h4>
                <ul className="text-sm text-[var(--warning)]/90 space-y-1">
                  <li>• All transactions are recorded with proper GST calculations</li>
                  <li>• Schedule H drug sales are tracked separately for compliance</li>
                  <li>• Prescription records are maintained for audit purposes</li>
                  <li>• Inventory valuation follows FIFO method</li>
                  <li>• All supplier invoices and customer receipts are digitally stored</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
