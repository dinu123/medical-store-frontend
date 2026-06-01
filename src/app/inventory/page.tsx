'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { apiClient } from '@/lib/api-client';
import { InventoryItem } from '@/types';
import { formatCurrency, formatDate } from '@/lib/export-utils';
import { toast } from 'sonner';
import { useRouter, useSearchParams } from 'next/navigation';

export default function InventoryPage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [filteredInventory, setFilteredInventory] = useState<InventoryItem[]>([]);
  const [orderItems, setOrderItems] = useState<InventoryItem[]>([]);
  const [orderLaterItems, setOrderLaterItems] = useState<string[]>([]);
  const [filters, setFilters] = useState({
    search: '',
    category: 'all',
    stockStatus: 'all'
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(15);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const load = async () => {
      try {
        const res: any = await apiClient.getInventory();
        const inventoryData: InventoryItem[] = res.data || [];
        setInventory(inventoryData);
        setFilteredInventory(inventoryData);
        const filterParam = searchParams.get('filter');
        if (filterParam === 'low-stock') setFilters(prev => ({ ...prev, stockStatus: 'low' }));
        const lowStockItems = inventoryData.filter(item => item.isLowStock);
        if (lowStockItems.length > 0) toast.warning(`${lowStockItems.length} medicines are running low on stock!`);
      } catch (error: any) {
        toast.error(error.message || 'Failed to load inventory');
      }
    };
    load();
  }, [searchParams]);

  useEffect(() => {
    let filtered = [...inventory];

    // Filter by search term
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      filtered = filtered.filter(item => 
        item.medicine.name.toLowerCase().includes(searchTerm) ||
        item.medicine.manufacturer.toLowerCase().includes(searchTerm) ||
        item.medicine.category.toLowerCase().includes(searchTerm) ||
        item.medicine.batchNo.toLowerCase().includes(searchTerm)
      );
    }

    // Filter by category
    if (filters.category !== 'all') {
      filtered = filtered.filter(item => 
        item.medicine.category.toLowerCase() === filters.category.toLowerCase()
      );
    }

    // Filter by stock status
    if (filters.stockStatus !== 'all') {
      switch (filters.stockStatus) {
        case 'low':
          filtered = filtered.filter(item => item.isLowStock);
          break;
        case 'out':
          filtered = filtered.filter(item => item.quantity === 0);
          break;
        case 'adequate':
          filtered = filtered.filter(item => !item.isLowStock && item.quantity > 0);
          break;
      }
    }

    // Sort by stock status (low stock first) then by name
    filtered.sort((a, b) => {
      if (a.isLowStock && !b.isLowStock) return -1;
      if (!a.isLowStock && b.isLowStock) return 1;
      return a.medicine.name.localeCompare(b.medicine.name);
    });

    setFilteredInventory(filtered);
    setCurrentPage(1);
  }, [inventory, filters]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      category: 'all',
      stockStatus: 'all'
    });
  };

  const handleExport = async () => {
    try {
      await apiClient.exportInventory();
      toast.success('Inventory report exported successfully');
    } catch (error) {
      toast.error('Failed to export inventory report');
    }
  };

  const handleAddNewMedicine = () => {
    router.push('/transactions/purchase');
  };

  const handleAddForOrdering = (medicineId: string) => {
    try {
      const item = filteredInventory.find(item => (item.medicine._id || item.medicine.id) === medicineId || item.medicineId === medicineId);
      if (item) {
        setOrderItems(prev => [...prev, item]);
        setFilteredInventory(prev => prev.filter(i => i.medicineId !== medicineId));
        setInventory(prev => prev.filter(i => i.medicineId !== medicineId));
        toast.success(`${item.medicine.name} added to order list`);
      }
    } catch (error) {
      toast.error('Failed to add item for ordering');
    }
  };

  const handleOrderLater = (medicineId: string) => {
    try {
      const item = filteredInventory.find(item => item.medicineId === medicineId);
      if (item) {
        // Add to order later list
        setOrderLaterItems(prev => [...prev, medicineId]);
        toast.success(`${item.medicine.name} marked to order later`);
      }
    } catch (error) {
      toast.error('Failed to mark item for order later');
    }
  };

  const handleEditMedicine = (medicineId: string) => {
    toast.info('Medicine edit functionality would be implemented here');
  };

  const handleDeleteMedicine = async (medicineId: string) => {
    if (confirm('Are you sure you want to delete this medicine from inventory?')) {
      try {
        await apiClient.deleteMedicine(medicineId);
        setInventory(prev => prev.filter(i => i.medicineId !== medicineId));
        toast.success('Medicine deleted from inventory');
      } catch (error: any) {
        toast.error(error.message || 'Failed to delete medicine');
      }
    }
  };

  // Get unique categories for filter
  const categories = [...new Set(inventory.map(item => item.medicine.category))];

  // Calculate summary stats
  const totalItems = filteredInventory.length;
  const lowStockCount = filteredInventory.filter(item => item.isLowStock).length;
  const outOfStockCount = filteredInventory.filter(item => item.quantity === 0).length;
  const totalValue = filteredInventory.reduce((sum, item) => 
    sum + (item.quantity * (item.medicine.price || 0)), 0
  );

  // Pagination
  const totalPages = Math.ceil(filteredInventory.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentItems = filteredInventory.slice(startIndex, endIndex);

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--brand-blue)]">Inventory Management</h1>
          <p className="text-[var(--foreground)]/70 mt-1">Monitor stock levels and manage inventory</p>
        </div>
        <div className="flex space-x-3 mt-4 sm:mt-0">
          <Button onClick={handleExport} variant="outline">
            Export Report
          </Button>
          <Button onClick={() => router.push('/inventory/bulk-upload')} variant="outline">
            Bulk Upload
          </Button>
          <Button onClick={handleAddNewMedicine}>
            Add New Medicine
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {lowStockCount > 0 && (
        <Alert className="border-orange-200 bg-orange-50">
          <AlertDescription className="text-orange-800">
            <strong>Low Stock Alert:</strong> {lowStockCount} medicines are running low on stock and need restocking.
          </AlertDescription>
        </Alert>
      )}

      {outOfStockCount > 0 && (
        <Alert className="border-red-200 bg-red-50">
          <AlertDescription className="text-red-800">
            <strong>Out of Stock:</strong> {outOfStockCount} medicines are completely out of stock.
          </AlertDescription>
        </Alert>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Items</CardTitle>
            <span className="text-2xl">📦</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalItems}</div>
            <p className="text-xs text-muted-foreground">
              Unique medicines in stock
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock</CardTitle>
            <span className="text-2xl">⚠️</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{lowStockCount}</div>
            <p className="text-xs text-muted-foreground">
              Need restocking
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Out of Stock</CardTitle>
            <span className="text-2xl">❌</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{outOfStockCount}</div>
            <p className="text-xs text-muted-foreground">
              Completely depleted
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <span className="text-2xl">💰</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalValue)}</div>
            <p className="text-xs text-muted-foreground">
              Current inventory value
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters & Search</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="search">Search</Label>
              <Input
                id="search"
                placeholder="Medicine name, manufacturer, batch..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
              />
            </div>

            <div>
              <Label>Category</Label>
              <Select value={filters.category} onValueChange={(value) => handleFilterChange('category', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map(category => (
                    <SelectItem key={category} value={category.toLowerCase()}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Stock Status</Label>
              <Select value={filters.stockStatus} onValueChange={(value) => handleFilterChange('stockStatus', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Items</SelectItem>
                  <SelectItem value="adequate">Adequate Stock</SelectItem>
                  <SelectItem value="low">Low Stock</SelectItem>
                  <SelectItem value="out">Out of Stock</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-between items-center mt-4">
            <Button variant="outline" onClick={clearFilters}>
              Clear Filters
            </Button>
            <p className="text-sm text-gray-600">
              Showing {filteredInventory.length} of {inventory.length} items
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Inventory Table */}
      <Card>
        <CardHeader>
          <CardTitle>Inventory Items</CardTitle>
        </CardHeader>
        <CardContent>
          {currentItems.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No inventory items found</p>
              <p className="text-sm text-gray-400 mt-1">
                Try adjusting your filters or search terms
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Medicine</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Batch/Expiry</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead>Purchase Price</TableHead>
                      <TableHead>MRP</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentItems.map((item) => (
                      <TableRow key={item.medicineId} className={item.isLowStock ? 'bg-orange-50' : ''}>
                        <TableCell>
                          <div>
                            <div className="flex items-center space-x-2">
                              <p className="font-medium">{item.medicine.name}</p>
                              {item.medicine.isScheduleH && (
                                <Badge variant="destructive" className="text-xs">
                                  Schedule H
                                </Badge>
                              )}
                              {orderLaterItems.includes(item.medicineId) && (
                                <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800">
                                  Order Later
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-gray-600">{item.medicine.manufacturer}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{item.medicine.category}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p>Batch: {item.medicine.batchNo}</p>
                            <p className={`${
                              item.daysToExpiry <= 30 ? 'text-red-600' : 
                              item.daysToExpiry <= 90 ? 'text-orange-600' : 'text-gray-600'
                            }`}>
                              Exp: {formatDate(item.medicine.expiryDate)}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p className={`font-medium ${
                              item.quantity === 0 ? 'text-red-600' :
                              item.isLowStock ? 'text-orange-600' : 'text-green-600'
                            }`}>
                              {item.quantity}
                            </p>
                            <p className="text-gray-500">Min: {item.medicine.minStockLevel}</p>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(item.medicine.price || 0)}
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(item.medicine.mrp || item.medicine.price || 0)}
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(item.quantity * (item.medicine.price || 0))}
                        </TableCell>
                        <TableCell>
                          {item.quantity === 0 ? (
                            <Badge variant="destructive">Out of Stock</Badge>
                          ) : item.isLowStock ? (
                            <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                              Low Stock
                            </Badge>
                          ) : (
                            <Badge variant="default" className="bg-green-100 text-green-800">
                              In Stock
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                                </svg>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleAddForOrdering(item.medicineId)}>
                                Add for Ordering
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleOrderLater(item.medicineId)}>
                                Order Later
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEditMedicine(item.medicineId)}>
                                Edit Medicine
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleDeleteMedicine(item.medicineId)}
                                className="text-red-600"
                              >
                                Delete Medicine
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-gray-600">
                    Showing {startIndex + 1} to {Math.min(endIndex, filteredInventory.length)} of{' '}
                    {filteredInventory.length} items
                  </p>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => goToPage(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <span className="flex items-center px-3 py-1 text-sm">
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
            </>
          )}
        </CardContent>
      </Card>

      {/* Order Items Section */}
      {orderItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Order Items ({orderItems.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Medicine</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Current Stock</TableHead>
                    <TableHead>Min Stock Level</TableHead>
                    <TableHead>Purchase Price</TableHead>
                    <TableHead>MRP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orderItems.map((item) => (
                    <TableRow key={item.medicineId}>
                      <TableCell>
                        <div>
                          <div className="flex items-center space-x-2">
                            <p className="font-medium">{item.medicine.name}</p>
                            {item.medicine.isScheduleH && (
                              <Badge variant="destructive" className="text-xs">
                                Schedule H
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-600">{item.medicine.manufacturer}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.medicine.category}</Badge>
                      </TableCell>
                      <TableCell className="text-gray-600">{item.medicine.supplier}</TableCell>
                      <TableCell>
                        <span className={`font-medium ${
                          item.quantity === 0 ? 'text-red-600' :
                          item.isLowStock ? 'text-orange-600' : 'text-green-600'
                        }`}>
                          {item.quantity}
                        </span>
                      </TableCell>
                      <TableCell className="text-gray-600">{item.medicine.minStockLevel}</TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(item.medicine.price || 0)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(item.medicine.mrp || item.medicine.price || 0)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
