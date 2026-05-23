// Thin shim over the server-script verbs in lib/services/api.ts.
import { api } from '@/lib/services/api';
import type { ContractorSearchResult } from './types';

export async function fetchContractorContract(query: string): Promise<ContractorSearchResult> {
  const result = await api.searchContractor(query);
  return {
    contract_name: result.contract_name ?? undefined,
    contractor_name: result.contractor_name ?? undefined,
  };
}
