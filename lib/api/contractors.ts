// Thin shim over the server-script verbs in lib/services/api.ts.
import { api } from '@/lib/services/api';
import type { ContractorSearchResult } from './types';

export async function fetchContractorContract(query: string): Promise<ContractorSearchResult> {
  const result = await api.searchContractor(query);
  // Forward the full result — this used to drop everything except
  // contract_name/contractor_name, silently hiding is_contractor,
  // has_active_contract, contract_status, project, vehicles, etc. from
  // every screen that renders a contractor search result.
  return {
    contract_name: result.contract_name ?? undefined,
    contractor_name: result.contractor_name ?? undefined,
    is_contractor: result.is_contractor ?? undefined,
    has_active_contract: result.has_active_contract ?? undefined,
    contract_status: result.contract_status ?? undefined,
    fulfilment_status: result.fulfilment_status ?? undefined,
    contract_start: result.contract_start ?? undefined,
    contract_end: result.contract_end ?? undefined,
    project: result.project ?? undefined,
    supplier_id: result.supplier_id ?? undefined,
    supplier_group: result.supplier_group ?? undefined,
    vehicles: result.vehicles ?? undefined,
    contact_phone: result.contact_phone ?? undefined,
  };
}
