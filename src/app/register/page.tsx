'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    ownerName: '',
    shopName: '',
    contactNumber: '',
    address: '',
    gstin: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email || !formData.password || !formData.ownerName || !formData.shopName || !formData.contactNumber) {
      toast.error('Please fill all required fields');
      return;
    }
    setIsLoading(true);
    try {
      const response: any = await apiClient.register({
        email: formData.email,
        password: formData.password,
        ownerName: formData.ownerName,
        shopName: formData.shopName,
        contactNumber: formData.contactNumber,
        address: formData.address,
        gstin: formData.gstin,
      });

      if (response.success && response.token) {
        localStorage.setItem('authToken', response.token);
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('userEmail', response.user?.email || formData.email);
        localStorage.setItem('userName', response.user?.ownerName || formData.ownerName);
        localStorage.setItem('userProfile', JSON.stringify(response.user));
        toast.success('Registration successful!');
        router.push('/');
      } else {
        toast.error(response.message || 'Registration failed');
      }
    } catch (error: any) {
      toast.error(error.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center mb-4">
            <div className="w-12 h-12 bg-gradient-to-r from-[var(--brand-deep-blue)] to-[var(--brand-blue)] rounded-lg flex items-center justify-center text-white font-bold text-xl">M</div>
          </div>
          <CardTitle className="text-2xl font-bold text-[var(--brand-blue)]">Create Account</CardTitle>
          <p className="text-gray-600">Register your medical store</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ownerName">Owner Name *</Label>
              <Input id="ownerName" value={formData.ownerName} onChange={(e) => handleChange('ownerName', e.target.value)} placeholder="Enter owner name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shopName">Shop Name *</Label>
              <Input id="shopName" value={formData.shopName} onChange={(e) => handleChange('shopName', e.target.value)} placeholder="Enter shop name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input id="email" type="email" value={formData.email} onChange={(e) => handleChange('email', e.target.value)} placeholder="Enter email" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password *</Label>
              <Input id="password" type="password" value={formData.password} onChange={(e) => handleChange('password', e.target.value)} placeholder="Enter password" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactNumber">Contact Number *</Label>
              <Input id="contactNumber" type="tel" value={formData.contactNumber} onChange={(e) => handleChange('contactNumber', e.target.value)} placeholder="Enter contact number" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input id="address" value={formData.address} onChange={(e) => handleChange('address', e.target.value)} placeholder="Enter shop address" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gstin">GSTIN (Optional)</Label>
              <Input id="gstin" value={formData.gstin} onChange={(e) => handleChange('gstin', e.target.value)} placeholder="Enter GSTIN number" />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Creating Account...' : 'Create Account'}
            </Button>
          </form>
          <div className="text-center text-sm text-gray-600 mt-4">
            Already have an account?{' '}
            <Link href="/login" className="text-[var(--brand-blue)] hover:underline">Sign in</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
