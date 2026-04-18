export const TransportMode = {
  OnFoot: 'On Foot',
  Vehicle: 'Vehicle',
  MotorBike: 'Motor Bike',
} as const;

export type TransportMode = (typeof TransportMode)[keyof typeof TransportMode];

export const TRANSPORT_MODES: TransportMode[] = ['On Foot', 'Vehicle', 'Motor Bike'];
