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
import { PrescriptionUploadDialog } from '@/components/PrescriptionUploadDialog';
import { sellFormSchema, SellFormData } from '@/lib/validations';
import { apiClient } from '@/lib/api-client';
import { Medicine, TransactionItem } from '@/types';
import { formatCurrency, generateInvoiceNumber } from '@/lib/export-utils';
import { toast } from 'sonner';

interface SelectedMedicine {
  medicine?: Medicine;
  gstRate: number;
  discount: number;
}

export function MultiMedicineSellForm() {
  const [selectedMedicines, setSelectedMedicines] = useState<SelectedMedicine[]>([{ gstRate: 12, discount: 0 }]);
  const [scheduleHMedicines, setScheduleHMedicines] = useState<string[]>([]);
  const [showPrescriptionDialog, setShowPrescriptionDialog] = useState(false);
  const [prescriptionFiles, setPrescriptionFiles] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<SellFormData>({
    resolver: zodResolver(sellFormSchema),
    defaultValues: { items: [{ medicineId: '', quantity: 1, price: 0 }], paymentMethod: 'cash' }
  });

  const { register, handleSubmit, formState: { errors }, setValue, reset, control, watch } = form;
  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  const addMedicine = () => {
    append({ medicineId: '', quantity: 1, price: 0 });
    setSelectedMedicines(prev => [...prev, { gstRate: 12, discount: 0 }]);
  };

  const removeMedicine = (index: number) => {
    if (fields.length > 1) {
      remove(index);
      setSelectedMedicines(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleMedicineSelect = (index: number, medicine: Medicine) => {
    const id = medicine._id || medicine.id;
    setValue(`items.${index}.medicineId`, id);
    setValue(`items.${index}.price`, medicine.mrp || medicine.price);
    const updated = [...selectedMedicines];
    updated[index] = { ...updated[index], medicine, gstRate: medicine.gstRate || 12 };
    setSelectedMedicines(updated);
    if (medicine.isScheduleH) setScheduleHMedicines(prev => [...new Set([...prev, id])]);
  };

  const handleDiscountChange = (index: number, discountPct: number) => {
    const medicine = selectedMedicines[index]?.medicine;
    if (!medicine) return;
    const originalPrice = medicine.mrp || medicine.price;
    const discountedPrice = originalPrice * (1 - discountPct / 100);
    if (discountedPrice < medicine.price) {
      toast.warning(`Discounted price (${formatCurrency(discountedPrice)}) is below purchase price (${formatCurrency(medicine.price)})`);
    }
    const updated = [...selectedMedicines];
    updated[index] = { ...updated[index], discount: discountPct };
    setSelectedMedicines(updated);
    setValue(`items.${index}.price`, discountedPrice);
  };

  const calculateGSTBreakdown = (items: any[]) => {
    let sgst = 0, cgst = 0;
    items.forEach((item, i) => {
      const gstRate = selectedMedicines[i]?.gstRate || 18;
      const total = item.quantity * item.price;
      sgst += (total * (gstRate / 2)) / 100;
      cgst += (total * (gstRate / 2)) / 100;
    });
    return { sgst, cgst, total: sgst + cgst };
  };

  const onSubmit = async (data: SellFormData) => {
    try {
      setIsSubmitting(true);
      const hasScheduleH = data.items.some(item => scheduleHMedicines.includes(item.medicineId));
      if (hasScheduleH && prescriptionFiles.length === 0) {
        setShowPrescriptionDialog(true);
        setIsSubmitting(false);
        return;
      }

      const subtotal = data.items.reduce((sum, item) => sum + item.quantity * item.price, 0);
      const gstBreakdown = calculateGSTBreakdown(data.items);
      const totalAmount = subtotal + gstBreakdown.total;

      const transactionItems: TransactionItem[] = data.items.map((item, i) => {
        const med = selectedMedicines[i]?.medicine;
        return {
          medicineId: item.medicineId,
          medicineName: med?.name || '',
          quantity: item.quantity,
          price: item.price,
          batchNo: med?.batchNo || '',
          expiryDate: med?.expiryDate || '',
        };
      });

      await apiClient.createTransaction({
        type: 'sell',
        items: transactionItems,
        totalAmount,
        date: new Date().toISOString(),
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        prescriptionFiles: prescriptionFiles.length > 0 ? prescriptionFiles : undefined,
        gstAmount: gstBreakdown.total,
        invoiceNumber: generateInvoiceNumber('sell'),
        paymentMethod: data.paymentMethod,
      });

      toast.success('Sale completed successfully!');
      reset();
      setSelectedMedicines([{ gstRate: 12, discount: 0 }]);
      setScheduleHMedicines([]);
      setPrescriptionFiles([]);
    } catch (error: any) {
      toast.error(error.message || 'Failed to process sale. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrescriptionUpload = (files: string[]) => {
    setPrescriptionFiles(files);
    setShowPrescriptionDialog(false);
    handleSubmit(onSubmit)();
  };

  const items = watch('items');
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.price, 0);
  const gstBreakdown = calculateGSTBreakdown(items);
  const total = subtotal + gstBreakdown.total;

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="customerName">Customer Name (Optional)</Label>
            <Input id="customerName" {...register('customerName')} placeholder="Enter customer name" />
          </div>
          <div>
            <Label htmlFor="customerPhone">Customer Phone (Optional)</Label>
            <Input id="customerPhone" {...register('customerPhone')} placeholder="Enter phone number" />
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Select Medicines</h3>
            <Button type="button" onClick={addMedicine} variant="outline" size="sm">Add Medicine</Button>
          </div>

          {fields.map((field, index) => (
            <Card key={field.id} className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div className="md:col-span-2">
                  <Label>Medicine</Label>
                  <MedicineSearch onSelect={(medicine) => handleMedicineSelect(index, medicine)} placeholder="Search and select medicine" />
                  {errors.items?.[index]?.medicineId && <p className="text-sm text-red-600 mt-1">{errors.items[index]?.medicineId?.message}</p>}
                </div>
                <div>
                  <Label htmlFor={`quantity-${index}`}>Quantity</Label>
                  <Input id={`quantity-${index}`} type="number" min="1" {...register(`items.${index}.quantity`, { valueAsNumber: true })} />
                  {errors.items?.[index]?.quantity && <p className="text-sm text-red-600 mt-1">{errors.items[index]?.quantity?.message}</p>}
                </div>
                <div className="flex items-end space-x-2">
                  <div className="flex-1">
                    <Label>Price: {formatCurrency(watch(`items.${index}.price`))}</Label>
                    <p className="text-sm text-gray-600">Total: {formatCurrency(watch(`items.${index}.quantity`) * watch(`items.${index}.price`))}</p>
                  </div>
                  {fields.length > 1 && (
                    <Button type="button" variant="outline" size="sm" onClick={() => removeMedicine(index)} className="text-red-600 hover:text-red-700">Remove</Button>
                  )}
                </div>
              </div>

              {watch(`items.${index}.medicineId`) && (
                <div className="mt-4">
                  <Label htmlFor={`discount-${index}`}>Discount (%)</Label>
                  <Input
                    id={`discount-${index}`}
                    type="number" min="0" max="100" step="0.1"
                    value={selectedMedicines[index]?.discount || ''}
                    onChange={(e) => handleDiscountChange(index, parseFloat(e.target.value) || 0)}
                    placeholder="Enter discount percentage"
                    className="w-48"
                  />
                </div>
              )}

              {scheduleHMedicines.includes(watch(`items.${index}.medicineId`)) && (
                <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <span className="text-orange-600">⚠️</span>
                    <div>
                      <p className="text-sm font-medium text-orange-800">Schedule H Drug</p>
                      <p className="text-xs text-orange-600">This medicine requires a prescription as per Indian medical regulations</p>
                    </div>
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
          <CardHeader><CardTitle>Bill Summary</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between"><span>Subtotal:</span><span>{formatCurrency(subtotal)}</span></div>
            <div className="flex justify-between"><span>SGST:</span><span>{formatCurrency(gstBreakdown.sgst)}</span></div>
            <div className="flex justify-between"><span>CGST:</span><span>{formatCurrency(gstBreakdown.cgst)}</span></div>
            <div className="flex justify-between font-bold text-lg border-t pt-2"><span>Total:</span><span>{formatCurrency(total)}</span></div>
          </CardContent>
        </Card>

        <Button type="submit" className="w-full" disabled={isSubmitting || subtotal === 0}>
          {isSubmitting ? 'Processing Sale...' : `Complete Sale - ${formatCurrency(total)}`}
        </Button>
      </form>

      <PrescriptionUploadDialog
        open={showPrescriptionDialog}
        onClose={() => setShowPrescriptionDialog(false)}
        onUpload={handlePrescriptionUpload}
        onSkip={() => { setShowPrescriptionDialog(false); handleSubmit(onSubmit)(); }}
        scheduleHMedicines={scheduleHMedicines.map(id => selectedMedicines.find(m => (m.medicine?._id || m.medicine?.id) === id)?.medicine?.name || '')}
      />
    </div>
  );
}
