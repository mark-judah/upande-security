// Thin shim over the server-script verbs in lib/services/api.ts.
import { api } from '@/lib/services/api';
import type { ContractorPersonnelHistoryResult, ContractorSearchResult } from './types';

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

/**
 * Contractor Personnel history lookup, by exact id_number — used to
 * auto-fill + lock a personnel row's Full Name on the gate Contractor form
 * when this ID has appeared on a past visit (any contractor company, any
 * appointment). Unlike fetchVisitorHistory there's no fuzzy fallback: the
 * server does an exact match only. Never throws — a lookup failure just
 * leaves the row editable, same fallback contract as fetchVisitorHistory.
 */
export async function fetchContractorPersonnelHistory(
  id_number: string,
): Promise<ContractorPersonnelHistoryResult> {
  const q = id_number.trim();
  if (!q) return { found: false };
  try {
    return await api.getContractorPersonnelHistory(q);
  } catch {
    return { found: false };
  }
}
