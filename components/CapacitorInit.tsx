'use client';
import { useEffect } from 'react';
import { initCapacitor } from '@/lib/capacitor-init';

export function CapacitorInit() {
  useEffect(() => {
    void initCapacitor();
  }, []);
  return null;
}
