import { z } from 'zod';
import { TRANSPORT_MODES } from '@/constants/transportModes';

export const walkInSchema = z
  .object({
    customer_name: z.string().min(1, 'Full name required'),
    id_ref: z.string().optional(),
    customer_phone_number: z.string().min(1, 'Phone required'),
    custom_mode_of_transport: z.enum(TRANSPORT_MODES as unknown as [string, ...string[]]),
    custom_vehicles_number_plate: z.string().optional(),
    custom_vehicles_colour: z.string().optional(),
    custom_number_of_passengers: z.number().int().nonnegative().optional(),
    custom_meet_with: z.string().min(1, 'Host required'),
    customer_details: z.string().optional(),
  })
  .refine(
    (v) =>
      v.custom_mode_of_transport === 'On Foot' ||
      (!!v.custom_vehicles_number_plate && v.custom_vehicles_number_plate.length > 0),
    { message: 'Number plate required for vehicles', path: ['custom_vehicles_number_plate'] },
  );

export type WalkInInput = z.infer<typeof walkInSchema>;
