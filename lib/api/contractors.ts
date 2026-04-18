import api from './client';
import type { ContractorSearchResult } from './types';

export async function fetchContractorContract(query: string) {
  const res = await api.post<{ message: ContractorSearchResult }>(
    '/api/method/getContractorContract',
    { query },
  );
  return res.data.message;
}
