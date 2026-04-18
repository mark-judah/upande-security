export type VisitorFormValues = {
  customer_name: string;
  id_ref?: string;
  customer_phone_number?: string;
  custom_mode_of_transport: string;
  custom_vehicles_number_plate?: string;
  custom_vehicles_colour?: string;
  custom_number_of_passengers?: number;
  custom_meet_with: string;
  host_name: string;
  customer_details?: string;
};

export const emptyVisitorForm: VisitorFormValues = {
  customer_name: '',
  id_ref: '',
  customer_phone_number: '',
  custom_mode_of_transport: 'On Foot',
  custom_vehicles_number_plate: '',
  custom_vehicles_colour: '',
  custom_number_of_passengers: undefined,
  custom_meet_with: '',
  host_name: '',
  customer_details: '',
};
