'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { apiClient } from '@/lib/api-client';
import { formatDate } from '@/lib/export-utils';

interface Notification {
  id: string;
  type: 'low-stock' | 'expiry' | 'transaction' | 'system';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  priority: 'high' | 'medium' | 'low';
}

interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NotificationPanel({ isOpen, onClose }: NotificationPanelProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (isOpen) generateNotifications();
  }, [isOpen]);

  const generateNotifications = async () => {
    try {
      const [inventoryRes, expiringRes, txnRes]: any[] = await Promise.all([
        apiClient.getInventory(),
        apiClient.getExpiringMedicines(30),
        apiClient.getTransactions(),
      ]);

      const inventory = inventoryRes.data || [];
      const expiringMedicines = expiringRes.data || [];
      const transactions = txnRes.data || [];

      const list: Notification[] = [];

      // Low stock notifications
      inventory
        .filter((item: any) => item.isLowStock)
        .forEach((item: any, index: number) => {
          list.push({
            id: `low-stock-${index}`,
            type: 'low-stock',
            title: 'Low Stock Alert',
            message: `${item.medicine.name} is running low (${item.quantity} left)`,
            timestamp: new Date(),
            read: false,
            priority: 'high',
          });
        });

      // Expiry notifications
      expiringMedicines.forEach((medicine: any, index: number) => {
        list.push({
          id: `expiry-${index}`,
          type: 'expiry',
          title: 'Expiry Alert',
          message: `${medicine.name} expires on ${formatDate(medicine.expiryDate)} (${medicine.daysToExpiry} days left)`,
          timestamp: new Date(),
          read: false,
          priority: medicine.daysToExpiry <= 7 ? 'high' : 'medium',
        });
      });

      // Recent transaction notifications
      [...transactions]
        .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 3)
        .forEach((txn: any, index: number) => {
          list.push({
            id: `transaction-${index}`,
            type: 'transaction',
            title: 'Transaction',
            message: `${txn.type === 'sell' ? 'Sale' : 'Purchase'} completed - ${txn.invoiceNumber}`,
            timestamp: new Date(txn.date),
            read: true,
            priority: 'low',
          });
        });

      // System notification
      list.push({
        id: 'system-1',
        type: 'system',
        title: 'System',
        message: 'MediStore Pro is running normally',
        timestamp: new Date(),
        read: true,
        priority: 'low',
      });

      list.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      setNotifications(list);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
  };

  const markAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const clearNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'low-stock': return '⚠️';
      case 'expiry': return '📅';
      case 'transaction': return '💰';
      default: return '🔔';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 border-red-200';
      case 'medium': return 'bg-yellow-100 border-yellow-200';
      default: return 'bg-blue-100 border-blue-200';
    }
  };

  if (!isOpen) return null;

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="fixed inset-0 z-50 bg-black/20" onClick={onClose}>
      <div
        className="absolute top-16 right-4 w-96 max-h-[80vh] bg-white rounded-lg shadow-xl border overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Notifications</CardTitle>
            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="sm" onClick={markAllAsRead} className="text-xs">Mark all read</Button>
              <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">✕</Button>
            </div>
          </div>
          {unreadCount > 0 && <Badge variant="secondary" className="w-fit">{unreadCount} unread</Badge>}
        </CardHeader>

        <CardContent className="p-0 max-h-96 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-6 text-center text-gray-500">No notifications</div>
          ) : (
            <div className="space-y-1">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={`p-4 border-l-4 hover:bg-gray-50 cursor-pointer ${n.read ? 'opacity-60' : ''} ${getPriorityColor(n.priority)}`}
                  onClick={() => markAsRead(n.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 flex-1">
                      <span className="text-lg">{getIcon(n.type)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <h4 className="text-sm font-medium text-gray-900 truncate">{n.title}</h4>
                          {!n.read && <div className="w-2 h-2 bg-blue-500 rounded-full"></div>}
                        </div>
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">{n.message}</p>
                        <p className="text-xs text-gray-400 mt-1">{formatDate(n.timestamp.toISOString())}</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost" size="sm"
                      onClick={(e) => { e.stopPropagation(); clearNotification(n.id); }}
                      className="text-gray-400 hover:text-gray-600 p-1 h-auto"
                    >
                      ✕
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </div>
    </div>
  );
}
