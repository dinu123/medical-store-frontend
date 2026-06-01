'use client';

import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';
import { Medicine } from '@/types';
import { formatCurrency } from '@/lib/export-utils';

interface MedicineSearchProps {
  onSelect: (medicine: Medicine) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function MedicineSearch({ onSelect, placeholder = 'Search medicines...', disabled = false }: MedicineSearchProps) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Medicine[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.length < 1) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res: any = await apiClient.searchMedicines(query);
        const results: Medicine[] = (res.data || []).slice(0, 10);
        setSuggestions(results);
        setShowSuggestions(true);
        setSelectedIndex(-1);
      } catch {
        setSuggestions([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const handleMedicineSelect = (medicine: Medicine) => {
    setQuery(medicine.name);
    setShowSuggestions(false);
    onSelect(medicine);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : suggestions.length - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0) handleMedicineSelect(suggestions[selectedIndex]);
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;
    }
  };

  const handleBlur = (e: React.FocusEvent) => {
    setTimeout(() => {
      if (!suggestionsRef.current?.contains(e.relatedTarget as Node)) setShowSuggestions(false);
    }, 150);
  };

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        onFocus={() => query.length > 0 && setShowSuggestions(true)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full"
      />

      {showSuggestions && suggestions.length > 0 && (
        <Card ref={suggestionsRef} className="absolute z-50 w-full mt-1 max-h-80 overflow-y-auto bg-white border shadow-lg">
          <div className="p-2">
            {suggestions.map((medicine, index) => (
              <div
                key={medicine._id || medicine.id}
                className={`p-3 rounded-lg cursor-pointer transition-colors ${index === selectedIndex ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50'}`}
                onClick={() => handleMedicineSelect(medicine)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <h4 className="font-medium text-gray-900">{medicine.name}</h4>
                      {medicine.isScheduleH && <Badge variant="destructive" className="text-xs">Schedule H</Badge>}
                    </div>
                    <div className="mt-1 space-y-1">
                      <p className="text-sm text-gray-600">{medicine.manufacturer} • {medicine.category}</p>
                      <p className="text-sm text-gray-500">Batch: {medicine.batchNo} • Exp: {new Date(medicine.expiryDate).toLocaleDateString('en-IN')}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-green-600">{formatCurrency(medicine.price)}</span>
                        <span className={`text-sm ${medicine.stockQuantity <= medicine.minStockLevel ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                          Stock: {medicine.stockQuantity}{medicine.stockQuantity <= medicine.minStockLevel && ' (Low)'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                {medicine.stockQuantity === 0 && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">Out of stock</div>
                )}
                {medicine.stockQuantity > 0 && medicine.stockQuantity <= medicine.minStockLevel && (
                  <div className="mt-2 p-2 bg-orange-50 border border-orange-200 rounded text-xs text-orange-700">Low stock - only {medicine.stockQuantity} left</div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {showSuggestions && query.length > 0 && suggestions.length === 0 && (
        <Card className="absolute z-50 w-full mt-1 bg-white border shadow-lg">
          <div className="p-4 text-center text-gray-500">
            <p>No medicines found for "{query}"</p>
            <p className="text-sm mt-1">Try searching with a different term</p>
          </div>
        </Card>
      )}
    </div>
  );
}
