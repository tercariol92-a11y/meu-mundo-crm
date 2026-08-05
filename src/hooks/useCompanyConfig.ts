import { useCompany } from '../contexts/CompanyContext';

export function useCompanyConfig() {
  const { companyConfig, loading } = useCompany();
  return { companyConfig, loading };
}
