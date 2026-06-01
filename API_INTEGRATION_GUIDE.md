# Backend Integration Guide

## Overview

This guide explains how the Medical Store management system has been successfully migrated from a frontend-only (localStorage-based) application to a full-stack solution with a Node.js/Express backend and MongoDB database.

## Architecture

```
┌─────────────────────────────────┐
│     Frontend (Next.js)          │
│  - React Components             │
│  - API Client (api-client.ts)   │
│  - localStorage (cache)         │
└──────────────┬──────────────────┘
               │ HTTP/REST API
┌──────────────▼──────────────────┐
│    Backend (Node.js/Express)    │
│  - API Routes                   │
│  - Controllers                  │
│  - Business Logic               │
│  - Middleware (Auth, Validation)│
└──────────────┬──────────────────┘
               │ Mongoose ODM
┌──────────────▼──────────────────┐
│   MongoDB Database              │
│  - Users                        │
│  - Medicines                    │
│  - Transactions                 │
│  - Suppliers                    │
└─────────────────────────────────┘
```

## Setup Instructions

### Backend Setup

1. **Install MongoDB**
   - Download from https://www.mongodb.com/try/download/community
   - Or use MongoDB Atlas (cloud): https://www.mongodb.com/cloud/atlas

2. **Start Backend Server**
   ```bash
   cd Medical-Store-Backend
   npm install
   npm run dev
   ```
   Server runs at: `http://localhost:5000`

3. **Verify Backend is Running**
   ```bash
   curl http://localhost:5000/api/health
   ```
   Expected response:
   ```json
   {
     "status": "OK",
     "message": "Medical Store Backend is running"
   }
   ```

### Frontend Setup

1. **Configure Environment**
   ```bash
   cd Medical-Store
   # Update .env.local
   NEXT_PUBLIC_API_URL=http://localhost:5000/api
   ```

2. **Install & Start Frontend**
   ```bash
   npm install
   npm run dev
   ```
   Frontend runs at: `http://localhost:3000`

## API Integration Points

### 1. Authentication (`/api/auth`)

**Previously**: Stored in localStorage with mock data
**Now**: Authenticated with backend JWT tokens

#### Login Flow
```javascript
// Frontend
const response = await apiClient.login({
  email: 'user@example.com',
  password: 'password123'
});

// Response
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "64f1a2b3c4d5e6f7g8h9i0j",
    "email": "user@example.com",
    "shopName": "My Medical Store",
    "ownerName": "John Doe"
  }
}

// Token stored in localStorage
localStorage.setItem('authToken', response.token);
```

**Key Changes**:
- Removed mock authentication
- Added JWT token generation
- Added password hashing with bcrypt
- Added user registration

### 2. Medicines Management (`/api/medicines`)

**Previously**: Mocked with mock-data.ts
**Now**: Persisted in MongoDB

#### Examples

```javascript
// Get all medicines
const medicines = await apiClient.getMedicines();

// Search medicines
const results = await apiClient.searchMedicines('paracetamol');

// Create medicine
const medicine = await apiClient.createMedicine({
  name: 'Paracetamol 500mg',
  expiryDate: '2025-12-31',
  batchNo: 'PCM001',
  supplier: 'Cipla Ltd',
  price: 25.50,
  mrp: 30.00,
  stockQuantity: 150,
  gstRate: 5
});

// Bulk upload
const medicines = await apiClient.bulkUploadMedicines([
  { name: 'Medicine 1', ... },
  { name: 'Medicine 2', ... }
]);
```

**Key Changes**:
- Data persistence in MongoDB
- FIFO inventory tracking
- Batch management
- Search functionality

### 3. Transactions (`/api/transactions`)

**Previously**: Mocked transactions in memory
**Now**: Persistent transaction history with inventory updates

```javascript
// Create sell transaction
const transaction = await apiClient.createTransaction({
  type: 'sell',
  items: [
    {
      medicineId: '64f1a2b3c4d5e6f7g8h9i0j',
      medicineName: 'Paracetamol 500mg',
      quantity: 10,
      price: 30,
      batchNo: 'PCM001',
      expiryDate: '2025-12-31'
    }
  ],
  totalAmount: 300,
  gstAmount: 54,
  customerName: 'John',
  paymentMethod: 'cash'
});

// Get tax data
const taxData = await apiClient.getTaxData(
  '2024-01-01',
  '2024-12-31'
);

// Get dashboard stats
const stats = await apiClient.getDashboardStats();
```

**Key Changes**:
- Real inventory updates (stocks decrease on sell)
- Tax calculation with GST tracking
- Invoice generation
- Transaction history persistence

### 4. Suppliers (`/api/suppliers`)

**Previously**: Mocked supplier list
**Now**: Managed suppliers with full CRUD

```javascript
// Create supplier
const supplier = await apiClient.createSupplier({
  name: 'Cipla Ltd',
  address: 'Mumbai, India',
  contactNumber: '9876543210',
  gstinNumber: '27AABCU1234A1Z0'
});

// Get all suppliers
const suppliers = await apiClient.getSuppliers();

// Update supplier
const updated = await apiClient.updateSupplier(supplierId, {
  contactNumber: '9876543211'
});
```

**Key Changes**:
- Supplier management persistence
- GSTIN tracking
- Contact information management

## Data Migration

### For Existing Users

If you have existing data in localStorage, you'll need to manually migrate it:

```javascript
// Export data from localStorage
const medicines = JSON.parse(localStorage.getItem('bulkUploadedMedicines') || '[]');

// Import to backend
await apiClient.bulkUploadMedicines(medicines);
```

### For New Users

Just start using the system - all data will be saved to the backend automatically.

## Error Handling

### Authentication Errors

```javascript
try {
  await apiClient.login(credentials);
} catch (error) {
  // Invalid credentials
  // Network error
  // Server error
}
```

### API Error Responses

```json
{
  "success": false,
  "message": "Invalid credentials",
  "error": "User not found"
}
```

## Updated Components

### Profile Page (`src/app/profile/page.tsx`)
- ✅ Uses `apiClient.getProfile()`
- ✅ Uses `apiClient.updateProfile()`
- ✅ Fallback to localStorage

### Login Page (`src/app/login/page.tsx`)
- ✅ Uses `apiClient.login()`
- ✅ Uses `apiClient.socialLogin()`
- ✅ Stores JWT token
- ✅ Stores user info

### Dashboard Components
- These can be updated to use the API following the same pattern

## Next Steps - Component Updates Required

The following components need updating to use the backend API:

### High Priority
1. **Dashboard.tsx** - Use `apiClient.getDashboardStats()`
2. **MedicineSearch.tsx** - Use `apiClient.searchMedicines()`
3. **TransactionHistory.tsx** - Use `apiClient.getTransactions()`
4. **MultiMedicineSellForm.tsx** - Use `apiClient.createTransaction()`

### Medium Priority
5. **PurchaseForm.tsx** - Use `apiClient.createTransaction()`
6. **Inventory pages** - Use `apiClient.getInventory()`, `apiClient.getExpiringMedicines()`
7. **Tax filing page** - Use `apiClient.getTaxData()`
8. **Suppliers page** - Use `apiClient.getSuppliers()`

## Example: Updating a Component

### Before (with mock data)
```typescript
import { DataStore } from '@/lib/mock-data';

export default function InventoryPage() {
  useEffect(() => {
    const inventory = DataStore.getInventory();
    setData(inventory);
  }, []);
}
```

### After (with API)
```typescript
import { apiClient } from '@/lib/api-client';

export default function InventoryPage() {
  useEffect(() => {
    const loadInventory = async () => {
      try {
        const response = await apiClient.getInventory();
        if (response.success) {
          setData(response.data);
        }
      } catch (error) {
        toast.error('Failed to load inventory');
      }
    };
    loadInventory();
  }, []);
}
```

## Troubleshooting

### Backend not connecting
- Ensure MongoDB is running
- Check `MONGODB_URI` in `.env`
- Verify backend is running on port 5000
- Check firewall settings

### Authentication issues
- Clear localStorage and login again
- Check that `authToken` is being saved
- Verify JWT token is valid in Authorization header

### API calls failing
- Check Network tab in browser DevTools
- Verify CORS is configured correctly
- Check that frontend `NEXT_PUBLIC_API_URL` is set

## Security Notes

1. **JWT Tokens**: Never expose JWT_SECRET
2. **Password**: All passwords are hashed with bcrypt
3. **CORS**: Configure allowed origins in production
4. **Environment Variables**: Use `.env` file, never commit secrets

## Performance Tips

1. **Caching**: Results are cached in localStorage temporarily
2. **Pagination**: For large datasets, implement pagination in future
3. **Indexing**: Database indexes are created on search fields

## Future Enhancements

- [ ] Add pagination for large lists
- [ ] Implement Redis caching
- [ ] Add file upload for prescriptions
- [ ] Implement real-time notifications
- [ ] Add advanced analytics
- [ ] Multi-location support
- [ ] API rate limiting
- [ ] Comprehensive logging

## Support

For issues or questions:
1. Check the API documentation in Backend README
2. Review error messages in browser console
3. Check MongoDB connection
4. Verify environment variables
