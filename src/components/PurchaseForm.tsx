'use client';

import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MedicineSearch } from '@/components/MedicineSearch';
import { purchaseFormSchema, PurchaseFormData } from '@/lib/validations';
import { apiClient } from '@/lib/api-client';
import { Medicine, TransactionItem } from '@/types';
import { formatCurrency, generateInvoiceNumber } from '@/lib/export-utils';
import { toast } from 'sonner';

interface PurchaseItem {
  medicineId: string;
  medicine?: Medicine;
  quantity: number;
  price: number;
  gstRate: number;
}

export function PurchaseForm() {
  const [selectedMedicines, setSelectedMedicines] = useState<PurchaseItem[]>([
    { medicineId: '', quantity: 1, price: 0, gstRate: 12 }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<PurchaseFormData>({
    resolver: zodResolver(purchaseFormSchema),
    defaultValues: { items: [{ medicineId: '', quantity: 1, price: 0 }], paymentMethod: 'cash' }
  });

  const { register, handleSubmit, formState: { errors }, setValue, reset, control } = form;
  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  const addMedicine = () => {
    append({ medicineId: '', quantity: 1, price: 0 });
    setSelectedMedicines(prev => [...prev, { medicineId: '', quantity: 1, price: 0, gstRate: 12 }]);
  };

  const removeMedicine = (index: number) => {
    if (selectedMedicines.length > 1) {
      remove(index);
      setSelectedMedicines(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleMedicineSelect = (index: number, medicine: Medicine) => {
    const id = medicine._id || medicine.id;
    const purchasePrice = medicine.price * 0.8;
    const updated = [...selectedMedicines];
    updated[index] = { ...updated[index], medicineId: id, medicine, price: purchasePrice, gstRate: medicine.gstRate || 12 };
    setSelectedMedicines(updated);
    setValue(`items.${index}.medicineId`, id);
    setValue(`items.${index}.price`, purchasePrice);
  };

  const calculateGSTAmount = () => {
    let sgst = 0, cgst = 0;
    selectedMedicines.forEach(item => {
      const gstRate = item.gstRate || 12;
      const total = item.quantity * item.price;
      sgst += (total * (gstRate / 2)) / 100;
      cgst += (total * (gstRate / 2)) / 100;
    });
    return { sgst, cgst, total: sgst + cgst };
  };

  const onSubmit = async (data: PurchaseFormData) => {
    try {
      setIsSubmitting(true);
      const subtotal = selectedMedicines.reduce((sum, item) => sum + item.quantity * item.price, 0);
      const gstData = calculateGSTAmount();
      const totalAmount = subtotal + gstData.total;

      const transactionItems: TransactionItem[] = selectedMedicines.map(item => ({
        medicineId: item.medicineId,
        medicineName: item.medicine?.name || '',
        quantity: item.quantity,
        price: item.price,
        batchNo: item.medicine?.batchNo || '',
        expiryDate: item.medicine?.expiryDate || '',
      }));

      await apiClient.createTransaction({
        type: 'purchase',
        items: transactionItems,
        totalAmount,
        date: new Date().toISOString(),
        gstAmount: gstData.total,
        invoiceNumber: data.invoiceNumber,
        paymentMethod: data.paymentMethod,
        supplierName: data.supplierName,
      });

      toast.success('Purchase recorded successfully!');
      reset();
      setSelectedMedicines([{ medicineId: '', quantity: 1, price: 0, gstRate: 12 }]);
    } catch (error: any) {
      toast.error(error.message || 'Failed to process purchase. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const subtotal = selectedMedicines.reduce((sum, item) => sum + item.quantity * item.price, 0);
  const gstData = calculateGSTAmount();
  const total = subtotal + gstData.total;

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="supplierName">Supplier Name *</Label>
            <Input id="supplierName" {...register('supplierName')} placeholder="Enter supplier name" />
            {errors.supplierName && <p className="text-sm text-red-600 mt-1">{errors.supplierName.message}</p>}
          </div>
          <div>
            <Label htmlFor="invoiceNumber">Invoice Number *</Label>
            <Input id="invoiceNumber" {...register('invoiceNumber')} placeholder="Enter supplier invoice number" />
            {errors.invoiceNumber && <p className="text-sm text-red-600 mt-1">{errors.invoiceNumber.message}</p>}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Purchase Items</h3>
            <Button type="button" onClick={addMedicine} variant="outline">Add Medicine</Button>
          </div>

          {selectedMedicines.map((item, index) => (
            <Card key={index} className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
                <div className="md:col-span-2">
                  <Label>Medicine</Label>
                  <MedicineSearch onSelect={(medicine) => handleMedicineSelect(index, medicine)} placeholder="Search and select medicine" />
                  {errors.items?.[index]?.medicineId && <p className="text-sm text-red-600 mt-1">{errors.items[index]?.medicineId?.message}</p>}
                </div>
                <div>
                  <Label htmlFor={`quantity-${index}`}>Quantity</Label>
                  <Input
                    id={`quantity-${index}`} type="number" min="1"
                    value={item.quantity}
                    onChange={(e) => {
                      const updated = [...selectedMedicines];
                      updated[index].quantity = parseInt(e.target.value) || 1;
                      setSelectedMedicines(updated);
                      setValue(`items.${index}.quantity`, updated[index].quantity);
                    }}
                  />
                </div>
                <div>
                  <Label htmlFor={`price-${index}`}>Unit Price</Label>
                  <Input
                    id={`price-${index}`} type="number" step="0.01" min="0"
                    value={item.price}
                    onChange={(e) => {
                      const updated = [...selectedMedicines];
                      updated[index].price = parseFloat(e.target.value) || 0;
                      setSelectedMedicines(updated);
                      setValue(`items.${index}.price`, updated[index].price);
                    }}
                  />
                </div>
                <div>
                  <Label>GST Rate (%)</Label>
                  <Select value={item.gstRate.toString()} onValueChange={(value) => {
                    const updated = [...selectedMedicines];
                    updated[index].gstRate = parseInt(value);
                    setSelectedMedicines(updated);
                  }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5%</SelectItem>
                      <SelectItem value="12">12%</SelectItem>
                      <SelectItem value="18">18%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end space-x-2">
                  <div className="flex-1">
                    <Label>Total</Label>
                    <p className="text-sm font-medium">{formatCurrency(item.quantity * item.price)}</p>
                  </div>
                  {selectedMedicines.length > 1 && (
                    <Button type="button" variant="outline" size="sm" onClick={() => removeMedicine(index)} className="text-red-600 hover:text-red-700">Remove</Button>
                  )}
                </div>
              </div>

              {item.medicine && (
                <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                    <div><span className="text-gray-600">Category:</span><p className="font-medium">{item.medicine.category}</p></div>
                    <div><span className="text-gray-600">Manufacturer:</span><p className="font-medium">{item.medicine.manufacturer}</p></div>
                    <div><span className="text-gray-600">Current Stock:</span><p className="font-medium">{item.medicine.stockQuantity}</p></div>
                    <div><span className="text-gray-600">MRP:</span><p className="font-medium">{formatCurrency(item.medicine.mrp || item.medicine.price)}</p></div>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>

        <div>
          <Label>Payment Method</Label>
          <Select onValueChange={(value) => setValue('paymentMethod', value as any)}>
            <SelectTrigger><SelectValue placeholder="Select payment method" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="card">Card</SelectItem>
              <SelectItem value="upi">UPI</SelectItem>
            </SelectContent>
          </Select>
          {errors.paymentMethod && <p className="text-sm text-red-600 mt-1">{errors.paymentMethod.message}</p>}
        </div>

        <Card className="bg-gray-50">
          <CardHeader><CardTitle>Purchase Summary</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between"><span>Subtotal:</span><span>{formatCurrency(subtotal)}</span></div>
            <div className="flex justify-between"><span>SGST:</span><span>{formatCurrency(gstData.sgst)}</span></div>
            <div className="flex justify-between"><span>CGST:</span><span>{formatCurrency(gstData.cgst)}</span></div>
            <div className="flex justify-between font-bold text-lg border-t pt-2"><span>Total:</span><span>{formatCurrency(total)}</span></div>
            <p className="text-sm text-gray-600 mt-2">Items will be added to inventory after purchase confirmation</p>
          </CardContent>
        </Card>

        <Button type="submit" className="w-full" disabled={isSubmitting || subtotal === 0}>
          {isSubmitting ? 'Recording Purchase...' : `Record Purchase - ${formatCurrency(total)}`}
        </Button>
      </form>
    </div>
  );
}
