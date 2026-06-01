'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Supplier } from '@/types';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({ name: '', address: '', contactNumber: '', gstinNumber: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res: any = await apiClient.getSuppliers();
        setSuppliers(res.data || []);
      } catch (error: any) {
        toast.error(error.message || 'Failed to load suppliers');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filteredSuppliers = suppliers.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.contactNumber.includes(searchTerm) ||
    (s.gstinNumber && s.gstinNumber.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.address || !formData.contactNumber) {
      toast.error('Please fill all required fields');
      return;
    }
    setIsLoading(true);
    try {
      if (editingSupplier) {
        const res: any = await apiClient.updateSupplier(editingSupplier._id || editingSupplier.id, formData);
        setSuppliers(prev => prev.map(s => (s._id || s.id) === (editingSupplier._id || editingSupplier.id) ? res.data : s));
        toast.success('Supplier updated successfully');
      } else {
        const res: any = await apiClient.createSupplier(formData);
        setSuppliers(prev => [...prev, res.data]);
        toast.success('Supplier added successfully');
      }
      setFormData({ name: '', address: '', contactNumber: '', gstinNumber: '' });
      setShowAddForm(false);
      setEditingSupplier(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to save supplier');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setFormData({ name: supplier.name, address: supplier.address, contactNumber: supplier.contactNumber, gstinNumber: supplier.gstinNumber || '' });
    setShowAddForm(true);
  };

  const handleDelete = async (supplierId: string) => {
    if (confirm('Are you sure you want to delete this supplier?')) {
      try {
        await apiClient.deleteSupplier(supplierId);
        setSuppliers(prev => prev.filter(s => (s._id || s.id) !== supplierId));
        toast.success('Supplier deleted successfully');
      } catch (error: any) {
        toast.error(error.message || 'Failed to delete supplier');
      }
    }
  };

  const cancelForm = () => {
    setFormData({ name: '', address: '', contactNumber: '', gstinNumber: '' });
    setShowAddForm(false);
    setEditingSupplier(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-[var(--brand-blue)] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--brand-blue)]">Suppliers</h1>
          <p className="text-[var(--foreground)]/70 mt-1">Manage your medicine suppliers</p>
        </div>
        <Button onClick={() => setShowAddForm(true)} disabled={showAddForm}>Add New Supplier</Button>
      </div>

      {showAddForm && (
        <Card>
          <CardHeader><CardTitle>{editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Supplier Name *</Label>
                  <Input id="name" value={formData.name} onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))} placeholder="Enter supplier name" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactNumber">Contact Number *</Label>
                  <Input id="contactNumber" value={formData.contactNumber} onChange={(e) => setFormData(prev => ({ ...prev, contactNumber: e.target.value }))} placeholder="Enter contact number" required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address *</Label>
                <Textarea id="address" value={formData.address} onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))} placeholder="Enter complete address" rows={3} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gstinNumber">GSTIN Number (Optional)</Label>
                <Input id="gstinNumber" value={formData.gstinNumber} onChange={(e) => setFormData(prev => ({ ...prev, gstinNumber: e.target.value }))} placeholder="Enter GSTIN number" />
              </div>
              <div className="flex space-x-3">
                <Button type="submit" disabled={isLoading}>{isLoading ? 'Saving...' : editingSupplier ? 'Update Supplier' : 'Add Supplier'}</Button>
                <Button type="button" variant="outline" onClick={cancelForm}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <Input placeholder="Search suppliers by name, contact, or GSTIN..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <Badge variant="secondary">{filteredSuppliers.length} supplier{filteredSuppliers.length !== 1 ? 's' : ''}</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>All Suppliers</CardTitle></CardHeader>
        <CardContent>
          {filteredSuppliers.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">{searchTerm ? 'No suppliers found matching your search' : 'No suppliers added yet'}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredSuppliers.map((supplier) => {
                const id = supplier._id || supplier.id;
                return (
                  <div key={id} className="border rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="font-semibold text-lg">{supplier.name}</h3>
                          {supplier.gstinNumber && <Badge variant="outline">GST Registered</Badge>}
                        </div>
                        <div className="space-y-1 text-sm text-gray-600">
                          <p><strong>Address:</strong> {supplier.address}</p>
                          <p><strong>Contact:</strong> {supplier.contactNumber}</p>
                          {supplier.gstinNumber && <p><strong>GSTIN:</strong> {supplier.gstinNumber}</p>}
                          {supplier.createdAt && <p><strong>Added:</strong> {new Date(supplier.createdAt).toLocaleDateString()}</p>}
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                            </svg>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(supplier)}>Edit Supplier</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDelete(id)} className="text-red-600">Delete Supplier</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
