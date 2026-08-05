import React, { createContext, useContext, useState, useEffect } from 'react';
import { ConfiguracaoEmpresa } from '../types';
import { doc, onSnapshot } from '../services/resilientFirestoreClient';
import { db } from '../firebase';

interface CompanyContextType {
  companyConfig: ConfiguracaoEmpresa | null;
  loading: boolean;
  refreshConfig: () => Promise<void>;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const [companyConfig, setCompanyConfig] = useState<ConfiguracaoEmpresa | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Use onSnapshot for real-time updates and better quota management
    const unsub = onSnapshot(doc(db, 'configuracoes', 'empresa'), (snap) => {
      if (snap.exists()) {
        setCompanyConfig({ id: snap.id, ...snap.data() } as ConfiguracaoEmpresa);
      } else {
        setCompanyConfig(null);
      }
      setLoading(false);
    }, (error) => {
      console.error('Error in CompanyContext listener:', error);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const refreshConfig = async () => {
    // Snapshots handle refresh automatically
  };

  return (
    <CompanyContext.Provider value={{ companyConfig, loading, refreshConfig }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const context = useContext(CompanyContext);
  if (context === undefined) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  return context;
}
