'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';

export default function ProfilePage() {
  const [profile, setProfile] = useState({
    shopName: '',
    address: '',
    gstin: '',
    contactNumber: '',
    email: '',
    ownerName: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setIsLoadingProfile(true);
      const response: any = await apiClient.getProfile();
      if (response.success && response.data) {
        setProfile(response.data);
      }
    } catch (error: any) {
      const savedProfile = localStorage.getItem('userProfile');
      if (savedProfile) {
        setProfile(JSON.parse(savedProfile));
      } else {
        setProfile(prev => ({
          ...prev,
          email: localStorage.getItem('userEmail') || '',
          ownerName: localStorage.getItem('userName') || ''
        }));
      }
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const response: any = await apiClient.updateProfile({
        shopName: profile.shopName,
        address: profile.address,
        gstin: profile.gstin,
        contactNumber: profile.contactNumber,
        ownerName: profile.ownerName
      });
      if (response.success) {
        localStorage.setItem('userProfile', JSON.stringify(response.data));
        toast.success(response.message || 'Profile updated successfully!');
      } else {
        toast.error(response.message || 'Failed to update profile');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to update profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  if (isLoadingProfile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-[var(--brand-blue)] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--brand-blue)]">My Profile</h1>
        <p className="text-[var(--foreground)]/70 mt-1">Manage your medical store information</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Personal Information</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ownerName">Owner Name</Label>
              <Input id="ownerName" value={profile.ownerName} onChange={(e) => handleInputChange('ownerName', e.target.value)} placeholder="Enter owner name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input id="email" type="email" value={profile.email} onChange={(e) => handleInputChange('email', e.target.value)} placeholder="Enter email address" disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactNumber">Contact Number</Label>
              <Input id="contactNumber" type="tel" value={profile.contactNumber} onChange={(e) => handleInputChange('contactNumber', e.target.value)} placeholder="Enter contact number" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Store Information</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="shopName">Medical Shop Name</Label>
              <Input id="shopName" value={profile.shopName} onChange={(e) => handleInputChange('shopName', e.target.value)} placeholder="Enter shop name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gstin">GSTIN Number</Label>
              <Input id="gstin" value={profile.gstin} onChange={(e) => handleInputChange('gstin', e.target.value)} placeholder="Enter GSTIN number" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Shop Address</Label>
              <Textarea id="address" value={profile.address} onChange={(e) => handleInputChange('address', e.target.value)} placeholder="Enter complete shop address" rows={4} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isLoading} className="px-8">
          {isLoading ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}
