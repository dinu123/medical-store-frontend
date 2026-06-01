'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { PrescriptionUploadDialog } from '@/components/PrescriptionUploadDialog';
import { apiClient } from '@/lib/api-client';
import { InventoryItem, Medicine } from '@/types';
import { formatCurrency, generateInvoiceNumber } from '@/lib/export-utils';
import { toast } from 'sonner';

function medicineId(medicine: Medicine | InventoryItem['medicine'], fallbackId?: string): string {
  return (
    (typeof medicine._id === 'string' ? medicine._id : medicine._id?.toString?.()) ||
    medicine.id ||
    fallbackId ||
    ''
  );
}

interface SaleItem {
  medicineId: string;
  medicineName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  batchNumber?: string;
  expiryDate?: string;
  isScheduleH: boolean;
}

export default function QuickSellPage() {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'upi'>('cash');
  const [items, setItems] = useState<SaleItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPrescriptionDialog, setShowPrescriptionDialog] = useState(false);
  const [pendingScheduleHItem, setPendingScheduleHItem] = useState<any>(null);
  const [showInvoice, setShowInvoice] = useState(false);
  const [lastInvoiceData, setLastInvoiceData] = useState<any>(null);
  const [profile, setProfile] = useState<any>({});
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(true);
  const [prescriptionFiles, setPrescriptionFiles] = useState<string[]>([]);

  const loadInventory = async () => {
    try {
      setLoadingInventory(true);
      const res: { data?: InventoryItem[] } = await apiClient.getInventory();
      setInventory(res.data || []);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to load inventory');
      setInventory([]);
    } finally {
      setLoadingInventory(false);
    }
  };

  useEffect(() => {
    loadInventory();
    const savedProfile = localStorage.getItem('userProfile');
    if (savedProfile) {
      setProfile(JSON.parse(savedProfile));
    }
  }, []);

  const filteredInventory = inventory.filter(
    (item) =>
      item.medicine.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.medicine.manufacturer.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const findInventoryItem = (id: string) => inventory.find((item) => item.medicineId === id);

  const addItemDirectly = (inventoryItem: InventoryItem, quantity: number = 1) => {
    const medicine = { ...inventoryItem.medicine, id: inventoryItem.medicineId };
    if (!inventoryItem || inventoryItem.quantity < quantity) {
      toast.error('Insufficient stock available');
      return;
    }

    // Check if it's a Schedule H drug
    if (medicine.isScheduleH) {
      setPendingScheduleHItem({ medicine, quantity });
      setShowPrescriptionDialog(true);
      return;
    }

    addItemToCart(medicine, quantity);
  };

  const addItemToCart = (medicine: Medicine, quantity: number) => {
    const id = medicineId(medicine);
    const existingItemIndex = items.findIndex((item) => item.medicineId === id);

    if (existingItemIndex >= 0) {
      const updatedItems = [...items];
      const newQty = updatedItems[existingItemIndex].quantity + quantity;
      const stock = findInventoryItem(id)?.quantity ?? 0;
      if (newQty > stock) {
        toast.error('Insufficient stock available');
        return;
      }
      updatedItems[existingItemIndex].quantity = newQty;
      updatedItems[existingItemIndex].totalPrice =
        updatedItems[existingItemIndex].quantity * updatedItems[existingItemIndex].unitPrice;
      setItems(updatedItems);
    } else {
      const newItem: SaleItem = {
        medicineId: id,
        medicineName: medicine.name,
        quantity: quantity,
        unitPrice: medicine.mrp || medicine.price,
        totalPrice: quantity * (medicine.mrp || medicine.price),
        batchNumber: medicine.batchNo,
        expiryDate: medicine.expiryDate,
        isScheduleH: medicine.isScheduleH
      };
      setItems([...items, newItem]);
    }

    setSearchTerm('');
    toast.success('Item added to sale');
  };

  const handlePrescriptionUpload = (files: string[]) => {
    setPrescriptionFiles((prev) => [...prev, ...files]);
    if (pendingScheduleHItem) {
      toast.success('Prescription uploaded successfully. Item added to sale.');
      addItemToCart(pendingScheduleHItem.medicine, pendingScheduleHItem.quantity);
      setPendingScheduleHItem(null);
      setShowPrescriptionDialog(false);
    }
  };

  const handlePrescriptionSkip = () => {
    if (pendingScheduleHItem) {
      toast.warning('Proceeding without prescription upload.');
      addItemToCart(pendingScheduleHItem.medicine, pendingScheduleHItem.quantity);
      setPendingScheduleHItem(null);
      setShowPrescriptionDialog(false);
    }
  };

  const removeItem = (medicineId: string) => {
    setItems(items.filter(item => item.medicineId !== medicineId));
    toast.success('Item removed from sale');
  };

  const updateItemQuantity = (medicineId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeItem(medicineId);
      return;
    }

    const stock = findInventoryItem(medicineId)?.quantity ?? 0;
    if (newQuantity > stock) {
      toast.error('Insufficient stock available');
      return;
    }

    const updatedItems = items.map((item) => {
      if (item.medicineId === medicineId) {
        return {
          ...item,
          quantity: newQuantity,
          totalPrice: newQuantity * item.unitPrice,
        };
      }
      return item;
    });
    setItems(updatedItems);
  };

  const calculateTotal = () => {
    return items.reduce((total, item) => total + item.totalPrice, 0);
  };

const calculateTax = () => {
    let totalSgst = 0;
    let totalCgst = 0;
    
    items.forEach((item) => {
      const medicine = findInventoryItem(item.medicineId)?.medicine;
      const gstRate = medicine?.gstRate || 18;
      const itemTotal = item.totalPrice;
      const itemSgst = (itemTotal * (gstRate / 2)) / 100;
      const itemCgst = (itemTotal * (gstRate / 2)) / 100;
      
      totalSgst += itemSgst;
      totalCgst += itemCgst;
    });
    
    return { sgst: totalSgst, cgst: totalCgst };
  };

const calculateGrandTotal = () => {
    const { sgst, cgst } = calculateTax(); // Get SGST and CGST
    return calculateTotal() + sgst + cgst; // Add SGST and CGST to the total
  };

  const completeSale = async () => {
    if (items.length === 0) {
      toast.error('Please add items to the sale');
      return;
    }

    setIsLoading(true);

    try {
      const invoiceNumber = generateInvoiceNumber('sell');
      const { sgst, cgst } = calculateTax();
      const gstAmount = sgst + cgst;
      const totalAmount = calculateGrandTotal();

      const transactionPayload = {
        type: 'sell' as const,
        invoiceNumber,
        date: new Date().toISOString(),
        customerName: customerName || undefined,
        customerPhone: customerPhone || undefined,
        items: items.map((item) => ({
          medicineId: item.medicineId,
          medicineName: item.medicineName,
          quantity: item.quantity,
          price: item.unitPrice,
          batchNo: item.batchNumber || '',
          expiryDate: item.expiryDate || '',
        })),
        totalAmount,
        gstAmount,
        paymentMethod,
        prescriptionFiles: prescriptionFiles.length > 0 ? prescriptionFiles : undefined,
      };

      const res: { data?: { invoiceNumber?: string } } = await apiClient.createTransaction(transactionPayload);
      const savedInvoiceNumber = res.data?.invoiceNumber || invoiceNumber;

      setLastInvoiceData({
        ...transactionPayload,
        invoiceNumber: savedInvoiceNumber,
        customerName: customerName || 'Walk-in Customer',
        items,
        subtotal: calculateTotal(),
        tax: { sgst, cgst },
        grandTotal: totalAmount,
        profile,
      });

      await loadInventory();

      toast.success(`Sale completed! Invoice: ${savedInvoiceNumber}`);
      setShowInvoice(true);

      setItems([]);
      setCustomerName('');
      setCustomerPhone('');
      setPaymentMethod('cash');
      setPrescriptionFiles([]);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to complete sale');
    } finally {
      setIsLoading(false);
    }
  };

  const printInvoice = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow && lastInvoiceData) {
      const invoiceHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Invoice - ${lastInvoiceData.invoiceNumber}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .shop-info { margin-bottom: 20px; }
            .invoice-info { margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            .total-row { font-weight: bold; }
            .terms { font-size: 10px; margin-top: 30px; }
            .text-right { text-align: right; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${lastInvoiceData.profile.shopName || 'MediStore Pro'}</h1>
            <p>${lastInvoiceData.profile.address || 'Shop Address'}</p>
            <p>Contact: ${lastInvoiceData.profile.contactNumber || 'Contact Number'}</p>
            ${lastInvoiceData.profile.gstin ? `<p>GSTIN: ${lastInvoiceData.profile.gstin}</p>` : ''}
          </div>
          
          <div class="invoice-info">
            <p><strong>Invoice No:</strong> ${lastInvoiceData.invoiceNumber}</p>
            <p><strong>Date:</strong> ${new Date(lastInvoiceData.date).toLocaleDateString()}</p>
            <p><strong>Customer:</strong> ${lastInvoiceData.customerName}</p>
            ${lastInvoiceData.customerPhone ? `<p><strong>Phone:</strong> ${lastInvoiceData.customerPhone}</p>` : ''}
            <p><strong>Payment Method:</strong> ${lastInvoiceData.paymentMethod.toUpperCase()}</p>
          </div>

          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>GST %</th>
                <th>Batch</th>
                <th>Qty</th>
                <th>Rate</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              ${lastInvoiceData.items.map((item: any) => {
                const medicine = findInventoryItem(item.medicineId)?.medicine;
                const gstRate = medicine?.gstRate || 18;
                return `
                <tr>
                  <td>${item.medicineName}${item.isScheduleH ? ' (Schedule H)' : ''}</td>
                  <td>${gstRate}%</td>
                  <td>${item.batchNumber || '-'}</td>
                  <td>${item.quantity}</td>
                  <td>${formatCurrency(item.unitPrice)}</td>
                  <td>${formatCurrency(item.totalPrice)}</td>
                </tr>
              `;
              }).join('')}
            </tbody>
          </table>

          <div class="text-right">
            <p><strong>Subtotal: ${formatCurrency(lastInvoiceData.subtotal)}</strong></p>
            <p><strong>SGST: ${formatCurrency(lastInvoiceData.tax.sgst)}</strong></p>
            <p><strong>CGST: ${formatCurrency(lastInvoiceData.tax.cgst)}</strong></p>
            <p class="text-xs text-gray-600">GST calculated based on individual medicine rates</p>
            <p class="total-row"><strong>Total: ${formatCurrency(lastInvoiceData.grandTotal)}</strong></p>
          </div>

          <div class="terms">
            <h4>Terms & Conditions:</h4>
            <p>1. All medicines sold are subject to expiry date mentioned on the package.</p>
            <p>2. No returns or exchanges without valid reason and original receipt.</p>
            <p>3. Schedule H drugs are sold as per prescription only.</p>
            <p>4. Please check the medicines before leaving the store.</p>
            <p>5. For any queries, please contact us within 7 days of purchase.</p>
          </div>
        </body>
        </html>
      `;
      
      printWindow.document.write(invoiceHTML);
      printWindow.document.close();
      printWindow.print();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--brand-blue)]">Quick Sell</h1>
        <p className="text-[var(--foreground)]/70 mt-1">Process sales transactions quickly</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Medicine Search & Add */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Search & Add Medicine</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Search Medicine</Label>
                <Input
                  placeholder="Search by name or manufacturer..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {loadingInventory && searchTerm && (
                <p className="text-sm text-gray-500">Loading inventory...</p>
              )}
              {searchTerm && !loadingInventory && (
                <div className="max-h-60 overflow-y-auto border rounded-md">
                  {filteredInventory.length === 0 ? (
                    <p className="p-3 text-sm text-gray-500">No medicines found</p>
                  ) : (
                    filteredInventory.map((inventoryItem) => {
                      const medicine = inventoryItem.medicine;
                      return (
                        <div
                          key={inventoryItem.medicineId}
                          className="p-3 border-b hover:bg-gray-50"
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-1">
                                <h4 className="font-medium">{medicine.name}</h4>
                                {medicine.isScheduleH && (
                                  <Badge variant="destructive" className="text-xs">
                                    Schedule H
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-gray-600">{medicine.manufacturer}</p>
                              <div className="flex items-center space-x-4 mt-1">
                                <p className="text-sm text-green-600">
                                  MRP: {formatCurrency(medicine.mrp || medicine.price)}
                                </p>
                                <Badge
                                  variant={inventoryItem.quantity > 0 ? 'default' : 'destructive'}
                                >
                                  Stock: {inventoryItem.quantity}
                                </Badge>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              onClick={() => addItemDirectly(inventoryItem, 1)}
                              disabled={inventoryItem.quantity === 0}
                            >
                              Add Item
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sale Items */}
          <Card>
            <CardHeader>
              <CardTitle>Sale Items</CardTitle>
            </CardHeader>
            <CardContent>
              {items.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No items added yet</p>
              ) : (
                <div className="space-y-3">
                  {items.map((item) => (
                    <div key={item.medicineId} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h4 className="font-medium">{item.medicineName}</h4>
                          {item.isScheduleH && (
                            <Badge variant="destructive" className="text-xs">Schedule H</Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">
                          {formatCurrency(item.unitPrice)} × {item.quantity} = {formatCurrency(item.totalPrice)}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateItemQuantity(item.medicineId, parseInt(e.target.value) || 0)}
                          className="w-20"
                        />
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => removeItem(item.medicineId)}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Customer & Payment */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Customer Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Customer Name (Optional)</Label>
                <Input
                  placeholder="Enter customer name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Phone Number (Optional)</Label>
                <Input
                  placeholder="Enter phone number"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Select value={paymentMethod} onValueChange={(value: any) => setPaymentMethod(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 pt-4 border-t">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(calculateTotal())}</span>
                </div>
                <div className="flex justify-between">
                  <span>SGST:</span>
                  <span>{formatCurrency(calculateTax().sgst)}</span>
                </div>
                <div className="flex justify-between">
                  <span>CGST:</span>
                  <span>{formatCurrency(calculateTax().cgst)}</span>
                </div>
                {items.length > 0 && (
                  <div className="text-xs text-gray-500 mt-1">
                    GST rates:{' '}
                    {Array.from(
                      new Set(
                        items.map((item) => findInventoryItem(item.medicineId)?.medicine?.gstRate || 18)
                      )
                    ).join('%, ')}
                    %
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg">
                  <span>Total:</span>
                  <span>{formatCurrency(calculateGrandTotal())}</span>
                </div>
              </div>

              <Button
                onClick={completeSale}
                disabled={isLoading || items.length === 0}
                className="w-full"
                size="lg"
              >
                {isLoading ? 'Processing...' : 'Complete Sale'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Schedule H Prescription Dialog */}
      <PrescriptionUploadDialog
        open={showPrescriptionDialog}
        onClose={() => setShowPrescriptionDialog(false)}
        onUpload={handlePrescriptionUpload}
        onSkip={handlePrescriptionSkip}
        scheduleHMedicines={pendingScheduleHItem ? [pendingScheduleHItem.medicine?.name] : []}
      />

      {/* Invoice Dialog */}
      <Dialog open={showInvoice} onOpenChange={setShowInvoice}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Sale Completed Successfully!</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p>Invoice <strong>{lastInvoiceData?.invoiceNumber}</strong> has been generated.</p>
            <div className="flex space-x-3">
              <Button onClick={printInvoice}>
                Print Invoice
              </Button>
              <Button variant="outline" onClick={() => setShowInvoice(false)}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
