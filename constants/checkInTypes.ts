export const CheckInType = {
  Visitor: 'visitor',
  Staff: 'staff',
  Contractor: 'contractor',
  CompanyVehicle: 'companyVehicle',
} as const;

export type CheckInType = (typeof CheckInType)[keyof typeof CheckInType];

export const CHECK_IN_TYPE_LABELS: Record<CheckInType, string> = {
  visitor: 'VISITOR',
  staff: 'STAFF',
  contractor: 'CONTRACTOR',
  companyVehicle: 'COMPANYVEHICLE',
};
