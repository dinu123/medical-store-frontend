'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { apiClient } from '@/lib/api-client';
import { Supplier, Medicine } from '@/types';
import { formatCurrency } from '@/lib/export-utils';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

interface NewMedicine {
  name: string;
  manufacturer: string;
  category: string;
  isScheduleH: boolean;
  minStockLevel: number;
}

interface PurchaseItem {
  medicineId?: string;
  medicineName: string;
  isNewMedicine: boolean;
  newMedicineData?: NewMedicine;
  quantity: number;
  unitPrice: number;
  mrp: number;
  totalPrice: number;
  batchNumber: string;
  expiryDate: string;
  manufacturer: string;
  gstRate: number;
}

export default function PurchaseStockPage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [supplierName, setSupplierName] = useState('');
  const [supplierSuggestions, setSupplierSuggestions] = useState<Supplier[]>([]);
  const [showSupplierSuggestions, setShowSupplierSuggestions] = useState(false);
  const [newSupplierData, setNewSupplierData] = useState({ address: '', contactNumber: '', gstinNumber: '' });

  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'upi'>('cash');
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Medicine search states
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [medicineSearchTerm, setMedicineSearchTerm] = useState('');
  const [medicineSuggestions, setMedicineSuggestions] = useState<Medicine[]>([]);
  const [showMedicineSuggestions, setShowMedicineSuggestions] = useState(false);
  const [selectedMedicine, setSelectedMedicine] = useState<Medicine | null>(null);
  const [isAddingNewMedicine, setIsAddingNewMedicine] = useState(false);
  const medicineDropdownRef = useRef(false);
  const supplierDropdownRef = useRef(false);

  const [currentItem, setCurrentItem] = useState<Partial<PurchaseItem>>({
    quantity: 1, unitPrice: 0, mrp: 0, batchNumber: '', expiryDate: '', gstRate: 12, isNewMedicine: false
  });

  const [newMedicineData, setNewMedicineData] = useState<NewMedicine>({
    name: '', manufacturer: '', category: '', isScheduleH: false, minStockLevel: 10
  });

  // Load suppliers from BE on mount
  useEffect(() => {
    const load = async () => {
      try {
        const res: any = await apiClient.getSuppliers();
        setSuppliers(res.data || []);
      } catch {
        toast.error('Failed to load suppliers');
      }
    };
    load();
  }, []);

  // Filter supplier suggestions
  useEffect(() => {
    if (supplierName.length > 0) {
      const filtered = suppliers.filter(s =>
        s.name.toLowerCase().includes(supplierName.toLowerCase())
      );
      setSupplierSuggestions(filtered);
      setShowSupplierSuggestions(filtered.length > 0);
    } else {
      setSupplierSuggestions([]);
      setShowSupplierSuggestions(false);
      setSelectedSupplier(null);
    }
  }, [supplierName, suppliers]);

  // Search medicines from BE with debounce
  useEffect(() => {
    if (medicineSearchTerm.length < 1 || isAddingNewMedicine) {
      setMedicineSuggestions([]);
      setShowMedicineSuggestions(false);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res: any = await apiClient.searchMedicines(medicineSearchTerm);
        setMedicineSuggestions(res.data || []);
        setShowMedicineSuggestions(true);
      } catch {
        setMedicineSuggestions([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [medicineSearchTerm, isAddingNewMedicine]);

  const selectSupplier = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setSupplierName(supplier.name);
    setNewSupplierData({
      address: supplier.address,
      contactNumber: supplier.contactNumber,
      gstinNumber: supplier.gstinNumber || ''
    });
    setShowSupplierSuggestions(false);
    supplierDropdownRef.current = false;
  };

  const selectMedicine = (medicine: Medicine) => {
    setSelectedMedicine(medicine);
    setMedicineSearchTerm('');
    setCurrentItem(prev => ({
      ...prev,
      medicineId: medicine._id || medicine.id,
      medicineName: medicine.name,
      manufacturer: medicine.manufacturer,
      gstRate: medicine.gstRate || 12,
      unitPrice: medicine.price || 0,
      mrp: medicine.mrp || 0,
      batchNumber: medicine.batchNo || '',
      expiryDate: medicine.expiryDate || '',
      quantity: 1,
      isNewMedicine: false
    }));
    setShowMedicineSuggestions(false);
    setIsAddingNewMedicine(false);
    medicineDropdownRef.current = false;
  };

  const handleAddNewMedicine = () => {
    setIsAddingNewMedicine(true);
    setSelectedMedicine(null);
    setMedicineSearchTerm('');
    setShowMedicineSuggestions(false);
    setCurrentItem(prev => ({ ...prev, medicineId: undefined, medicineName: '', manufacturer: '', isNewMedicine: true }));
  };

  const addItemToPurchase = async () => {
    if (!supplierName) { toast.error('Please select or enter supplier'); return; }
    if (isAddingNewMedicine) {
      if (!newMedicineData.name || !newMedicineData.manufacturer || !newMedicineData.category) {
        toast.error('Please fill all required medicine details'); return;
      }
    } else if (!selectedMedicine) {
      toast.error('Please select a medicine'); return;
    }
    if (!currentItem.quantity || currentItem.quantity <= 0 ||
      !currentItem.unitPrice || currentItem.unitPrice <= 0 ||
      !currentItem.mrp || currentItem.mrp <= 0 ||
      !currentItem.batchNumber || !currentItem.expiryDate) {
      toast.error('Please fill all required fields'); return;
    }

    let medicineId = isAddingNewMedicine ? undefined : (selectedMedicine?._id || selectedMedicine?.id);

    // If new medicine, create it in BE immediately
    if (isAddingNewMedicine) {
      try {
        const res: any = await apiClient.createMedicine({
          name: newMedicineData.name,
          manufacturer: newMedicineData.manufacturer,
          category: newMedicineData.category,
          isScheduleH: newMedicineData.isScheduleH,
          minStockLevel: newMedicineData.minStockLevel,
          expiryDate: currentItem.expiryDate,
          batchNo: currentItem.batchNumber,
          supplier: supplierName,
          price: currentItem.unitPrice,
          mrp: currentItem.mrp,
          stockQuantity: currentItem.quantity,
          gstRate: currentItem.gstRate,
        });
        medicineId = res.data?._id || res.data?.id;
        toast.success(`Medicine "${newMedicineData.name}" created in database`);
      } catch (error: any) {
        toast.error(error.message || 'Failed to create medicine');
        return;
      }
    }

    const newItem: PurchaseItem = {
      medicineId,
      medicineName: isAddingNewMedicine ? newMedicineData.name : selectedMedicine!.name,
      isNewMedicine: isAddingNewMedicine,
      quantity: currentItem.quantity!,
      unitPrice: currentItem.unitPrice!,
      mrp: currentItem.mrp!,
      totalPrice: currentItem.quantity! * currentItem.unitPrice!,
      batchNumber: currentItem.batchNumber!,
      expiryDate: currentItem.expiryDate!,
      manufacturer: isAddingNewMedicine ? newMedicineData.manufacturer : selectedMedicine!.manufacturer,
      gstRate: currentItem.gstRate!
    };

    setItems(prev => [...prev, newItem]);
    setCurrentItem({ quantity: 1, unitPrice: 0, mrp: 0, batchNumber: '', expiryDate: '', gstRate: 12, isNewMedicine: false });
    setSelectedMedicine(null);
    setMedicineSearchTerm('');
    setIsAddingNewMedicine(false);
    setNewMedicineData({ name: '', manufacturer: '', category: '', isScheduleH: false, minStockLevel: 10 });
    toast.success('Item added to purchase');
  };

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
    toast.success('Item removed');
  };

  const calculateSubtotal = () => items.reduce((sum, item) => sum + item.totalPrice, 0);

  const calculateTax = () => {
    let sgst = 0, cgst = 0, totalGstRate = 0;
    items.forEach(item => {
      const tax = (item.totalPrice * item.gstRate) / 100;
      sgst += tax / 2;
      cgst += tax / 2;
      totalGstRate += item.gstRate;
    });
    return { sgst, cgst, total: sgst + cgst, avgRate: items.length ? totalGstRate / items.length : 0 };
  };

  const completePurchase = async () => {
    if (items.length === 0) { toast.error('Please add items to the purchase'); return; }
    if (!supplierName || !invoiceNumber) { toast.error('Please fill supplier name and invoice number'); return; }
    if (!selectedSupplier && (!newSupplierData.contactNumber || !newSupplierData.address)) {
      toast.error('Please fill supplier contact details'); return;
    }

    setIsLoading(true);
    try {
      // Create new supplier in BE if not existing
      if (!selectedSupplier) {
        const res: any = await apiClient.createSupplier({
          name: supplierName,
          address: newSupplierData.address,
          contactNumber: newSupplierData.contactNumber,
          gstinNumber: newSupplierData.gstinNumber || undefined,
        });
        setSuppliers(prev => [...prev, res.data]);
      }

      // Create purchase transaction in BE
      const tax = calculateTax();
      await apiClient.createTransaction({
        type: 'purchase',
        invoiceNumber,
        date: new Date().toISOString(),
        supplierName,
        supplierContact: newSupplierData.contactNumber,
        supplierGstin: newSupplierData.gstinNumber,
        items: items.map(item => ({
          medicineId: item.medicineId || '',
          medicineName: item.medicineName,
          quantity: item.quantity,
          price: item.unitPrice,
          batchNo: item.batchNumber,
          expiryDate: item.expiryDate,
        })),
        totalAmount: calculateSubtotal() + tax.total,
        gstAmount: tax.total,
        paymentMethod,
      });

      // Reset form
      setItems([]);
      setSelectedSupplier(null);
      setSupplierName('');
      setNewSupplierData({ address: '', contactNumber: '', gstinNumber: '' });
      setInvoiceNumber('');
      setPaymentMethod('cash');
      setNotes('');

      toast.success(`Purchase completed! Invoice: ${invoiceNumber}`);
      router.push('/inventory');
    } catch (error: any) {
      toast.error(error.message || 'Failed to complete purchase');
    } finally {
      setIsLoading(false);
    }
  };

  const tax = calculateTax();
  const grandTotal = calculateSubtotal() + tax.total;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--brand-blue)]">Purchase Stock</h1>
          <p className="text-[var(--foreground)]/70 mt-1">Add new inventory to your stock</p>
        </div>
        <Button onClick={() => router.push('/inventory/bulk-upload')} variant="outline">Bulk Upload</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">

          {/* Supplier */}
          <Card>
            <CardHeader><CardTitle>Supplier Information</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 relative">
                <Label>Supplier Name *</Label>
                <Input
                  placeholder="Type to search suppliers..."
                  value={supplierName}
                  onChange={(e) => { setSupplierName(e.target.value); setSelectedSupplier(null); }}
                  onFocus={() => supplierSuggestions.length > 0 && setShowSupplierSuggestions(true)}
                  onBlur={() => { if (!supplierDropdownRef.current) setShowSupplierSuggestions(false); }}
                />
                {showSupplierSuggestions && (
                  <div className="absolute z-10 w-full bg-white border rounded-md shadow-lg max-h-40 overflow-y-auto">
                    {supplierSuggestions.map((supplier) => (
                      <div
                        key={supplier._id || supplier.id}
                        className="p-3 hover:bg-gray-50 cursor-pointer border-b"
                        onMouseDown={() => { supplierDropdownRef.current = true; }}
                        onClick={() => selectSupplier(supplier)}
                      >
                        <p className="font-medium">{supplier.name}</p>
                        <p className="text-sm text-gray-600">{supplier.contactNumber}</p>
                        <p className="text-xs text-gray-500">{supplier.address}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {!selectedSupplier && supplierName && (
                <Alert>
                  <AlertDescription>New supplier detected. Please fill in the details below.</AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Contact Number *</Label>
                  <Input placeholder="Enter contact number" value={newSupplierData.contactNumber}
                    onChange={(e) => setNewSupplierData(prev => ({ ...prev, contactNumber: e.target.value }))}
                    disabled={!!selectedSupplier} />
                </div>
                <div className="space-y-2">
                  <Label>GSTIN Number</Label>
                  <Input placeholder="Enter GSTIN number" value={newSupplierData.gstinNumber}
                    onChange={(e) => setNewSupplierData(prev => ({ ...prev, gstinNumber: e.target.value }))}
                    disabled={!!selectedSupplier} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Address *</Label>
                <Textarea placeholder="Enter supplier address" value={newSupplierData.address}
                  onChange={(e) => setNewSupplierData(prev => ({ ...prev, address: e.target.value }))}
                  disabled={!!selectedSupplier} rows={2} />
              </div>
            </CardContent>
          </Card>

          {/* Medicine */}
          <Card>
            <CardHeader><CardTitle>Add Medicine</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {!isAddingNewMedicine ? (
                <div className="space-y-2 relative">
                  <Label>Search Medicine</Label>
                  <div className="flex space-x-2">
                    <Input
                      placeholder="Search by name or manufacturer..."
                      value={medicineSearchTerm}
                      onChange={(e) => { setMedicineSearchTerm(e.target.value); setSelectedMedicine(null); }}
                      onBlur={() => { if (!medicineDropdownRef.current) setShowMedicineSuggestions(false); }}
                      className="flex-1"
                    />
                    <Button variant="outline" onClick={handleAddNewMedicine} type="button">Add New Medicine</Button>
                  </div>
                  {showMedicineSuggestions && medicineSuggestions.length > 0 && (
                    <div className="absolute z-10 w-full bg-white border rounded-md shadow-lg max-h-60 overflow-y-auto">
                      {medicineSuggestions.map((medicine) => (
                        <div
                          key={medicine._id || medicine.id}
                          className="p-3 hover:bg-gray-50 cursor-pointer border-b"
                          onMouseDown={() => { medicineDropdownRef.current = true; }}
                          onClick={() => selectMedicine(medicine)}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium">{medicine.name}</p>
                              <p className="text-sm text-gray-600">{medicine.manufacturer}</p>
                              <p className="text-xs text-gray-500">Category: {medicine.category}</p>
                            </div>
                            <div className="text-right">
                              <Badge variant="outline">GST: {medicine.gstRate}%</Badge>
                              <p className="text-xs text-gray-500 mt-1">Stock: {medicine.stockQuantity}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {showMedicineSuggestions && medicineSuggestions.length === 0 && medicineSearchTerm.length > 0 && (
                    <div className="absolute z-10 w-full bg-white border rounded-md shadow-lg p-4 text-center text-gray-500">
                      No medicines found. <button className="text-blue-600 underline" onMouseDown={handleAddNewMedicine}>Add as new medicine</button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-lg">New Medicine Details</Label>
                    <Button variant="outline" size="sm" onClick={() => setIsAddingNewMedicine(false)}>Cancel</Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Medicine Name *</Label>
                      <Input placeholder="Enter medicine name" value={newMedicineData.name}
                        onChange={(e) => setNewMedicineData(prev => ({ ...prev, name: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Manufacturer *</Label>
                      <Input placeholder="Enter manufacturer" value={newMedicineData.manufacturer}
                        onChange={(e) => setNewMedicineData(prev => ({ ...prev, manufacturer: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Category *</Label>
                      <Input placeholder="Enter category" value={newMedicineData.category}
                        onChange={(e) => setNewMedicineData(prev => ({ ...prev, category: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Min Stock Level</Label>
                      <Input type="number" min="1" value={newMedicineData.minStockLevel}
                        onChange={(e) => setNewMedicineData(prev => ({ ...prev, minStockLevel: parseInt(e.target.value) || 10 }))} />
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input type="checkbox" id="scheduleH" checked={newMedicineData.isScheduleH}
                      onChange={(e) => setNewMedicineData(prev => ({ ...prev, isScheduleH: e.target.checked }))} />
                    <Label htmlFor="scheduleH">Schedule H Medicine (Requires Prescription)</Label>
                  </div>
                </div>
              )}

              {(selectedMedicine || isAddingNewMedicine) && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4 border-t">
                  {selectedMedicine && (
                    <div className="md:col-span-2 lg:col-span-3 flex items-center justify-between">
                      <p className="text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded px-3 py-1">
                        ✓ Selected: {selectedMedicine.name} — {selectedMedicine.manufacturer}
                      </p>
                      <button className="text-xs text-gray-500 hover:text-red-600" onClick={() => { setSelectedMedicine(null); setMedicineSearchTerm(''); setCurrentItem({ quantity: 1, unitPrice: 0, mrp: 0, batchNumber: '', expiryDate: '', gstRate: 12, isNewMedicine: false }); }}>
                        ✕ Change
                      </button>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Quantity *</Label>
                    <Input type="number" min="1" value={currentItem.quantity}
                      onChange={(e) => setCurrentItem(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Unit Price *</Label>
                    <Input type="number" min="0" step="0.01" value={currentItem.unitPrice}
                      onChange={(e) => setCurrentItem(prev => ({ ...prev, unitPrice: parseFloat(e.target.value) || 0 }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>MRP *</Label>
                    <Input type="number" min="0" step="0.01" value={currentItem.mrp}
                      onChange={(e) => setCurrentItem(prev => ({ ...prev, mrp: parseFloat(e.target.value) || 0 }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Batch Number *</Label>
                    <Input value={currentItem.batchNumber} placeholder="Enter batch number"
                      onChange={(e) => setCurrentItem(prev => ({ ...prev, batchNumber: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Expiry Date *</Label>
                    <Input type="date" value={currentItem.expiryDate}
                      onChange={(e) => setCurrentItem(prev => ({ ...prev, expiryDate: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>GST Rate *</Label>
                    <Select value={currentItem.gstRate?.toString()}
                      onValueChange={(v) => setCurrentItem(prev => ({ ...prev, gstRate: parseInt(v) }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5%</SelectItem>
                        <SelectItem value="12">12%</SelectItem>
                        <SelectItem value="18">18%</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-2 lg:col-span-3">
                    <Button onClick={addItemToPurchase} className="w-full">Add Item to Purchase</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Items List */}
          <Card>
            <CardHeader><CardTitle>Purchase Items ({items.length})</CardTitle></CardHeader>
            <CardContent>
              {items.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No items added yet</p>
              ) : (
                <div className="space-y-3">
                  {items.map((item, index) => (
                    <div key={index} className="p-4 border rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <h4 className="font-medium">{item.medicineName}</h4>
                            {item.isNewMedicine && <Badge variant="secondary">New Medicine</Badge>}
                            <Badge variant="outline">GST: {item.gstRate}%</Badge>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">{item.manufacturer} | Batch: {item.batchNumber} | Expiry: {item.expiryDate}</p>
                          <p className="text-sm text-gray-600">{formatCurrency(item.unitPrice)} × {item.quantity} = {formatCurrency(item.totalPrice)}</p>
                          <p className="text-sm text-gray-600">MRP: {formatCurrency(item.mrp)}</p>
                        </div>
                        <Button variant="destructive" size="sm" onClick={() => removeItem(index)}>Remove</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Purchase Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Invoice Number *</Label>
                <Input placeholder="Enter invoice number" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Select value={paymentMethod} onValueChange={(v: any) => setPaymentMethod(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea placeholder="Add any notes..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Purchase Summary</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between"><span>Subtotal:</span><span>{formatCurrency(calculateSubtotal())}</span></div>
              <div className="flex justify-between"><span>SGST ({(tax.avgRate / 2).toFixed(1)}%):</span><span>{formatCurrency(tax.sgst)}</span></div>
              <div className="flex justify-between"><span>CGST ({(tax.avgRate / 2).toFixed(1)}%):</span><span>{formatCurrency(tax.cgst)}</span></div>
              <div className="flex justify-between font-bold text-lg border-t pt-2"><span>Total:</span><span>{formatCurrency(grandTotal)}</span></div>
              <Button onClick={completePurchase} disabled={isLoading || items.length === 0} className="w-full" size="lg">
                {isLoading ? 'Processing...' : 'Complete Purchase'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
