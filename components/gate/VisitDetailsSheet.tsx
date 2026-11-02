import { useEffect, useState } from 'react';
import { Modal, ScrollView, Text, View } from 'react-native';
import { Button } from '@/src/core/ui/Button';
import { FormInput } from '@/components/forms/FormInput';
import { FormSelect } from '@/components/forms/FormSelect';
import { formatKenyanPlate } from '@/lib/utils/plate';
import { TRANSPORT_MODES } from '@/constants/transportModes';
import { COLORS, borderRadius, fontFamily, fontSize, spacing } from '@/src/core/theme';

/** What the guard records at the gate for a visit booked ahead of time. */
export type VisitDetails = {
  transport: string;
  plate: string;
  colour: string;
  passengers?: number;
  organization: string;
};

/**
 * Check-in of a scheduled visit: a booking often names only the
 * representative, so before checking in the guard fills in what actually
 * arrives - transport, plate, colour, passengers, the organisation they
 * come from. Prefilled with whatever the booking already has; the same
 * rules as the gate's visitor form (plate for any vehicle, colour and
 * passengers for a car only).
 */
export function VisitDetailsSheet({
  visit,
  onClose,
  onContinue,
}: {
  visit: {
    key: string;
    holder: string;
    transport?: string;
    plate?: string;
    colour?: string;
    passengers?: number;
    organization?: string;
  } | null;
  onClose: () => void;
  onContinue: (details: VisitDetails) => void;
}) {
  const [transport, setTransport] = useState('On Foot');
  const [plate, setPlate] = useState('');
  const [colour, setColour] = useState('');
  const [passengers, setPassengers] = useState('');
  const [organization, setOrganization] = useState('');
  const key = visit?.key;

  useEffect(() => {
    if (!visit) return;
    setTransport(visit.transport || 'On Foot');
    setPlate(visit.plate || '');
    setColour(visit.colour || '');
    setPassengers(visit.passengers ? String(visit.passengers) : '');
    setOrganization(visit.organization || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const isCar = transport === 'Vehicle';
  const hasPlate = isCar || transport === 'Taxi' || transport === 'Motorcycle';

  function next() {
    onContinue({
      transport,
      plate: hasPlate ? formatKenyanPlate(plate) : '',
      colour: isCar ? colour.trim() : '',
      passengers: isCar && passengers ? parseInt(passengers, 10) || 0 : undefined,
      organization: organization.trim(),
    });
  }

  return (
    <Modal visible={visit != null} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
        <View
          style={{
            backgroundColor: COLORS.surface,
            borderTopLeftRadius: borderRadius.lg,
            borderTopRightRadius: borderRadius.lg,
            padding: spacing.lg,
          }}
        >
          <Text style={{ fontFamily: fontFamily.bold, fontSize: fontSize.md, color: COLORS.text }}>
            Arriving: {visit?.holder}
          </Text>
          <Text style={{ fontSize: fontSize.xs, color: COLORS.textMuted, marginTop: 2, marginBottom: spacing.md }}>
            Fill in what you see at the gate - the booking may only name the representative.
          </Text>
          <ScrollView style={{ maxHeight: 460 }} keyboardShouldPersistTaps="handled">
            <FormSelect label="Mode of Transport" value={transport} options={TRANSPORT_MODES} onChange={setTransport} />
            {hasPlate ? (
              <FormInput
                label="Number Plate"
                placeholder="e.g. KAA 001A"
                value={plate}
                onChangeText={setPlate}
                onBlur={() => setPlate(formatKenyanPlate(plate))}
                autoCapitalize="characters"
              />
            ) : null}
            {isCar ? (
              <>
                <FormInput label="Vehicle Colour" value={colour} onChangeText={setColour} />
                <FormInput
                  label="Number of Passengers (excl. driver)"
                  value={passengers}
                  onChangeText={(t) => setPassengers(t.replace(/\D/g, ''))}
                  keyboardType="number-pad"
                />
              </>
            ) : null}
            <FormInput
              label="Company / Organisation"
              placeholder="Who they represent"
              value={organization}
              onChangeText={setOrganization}
              autoCapitalize="words"
            />
          </ScrollView>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
            <Button label="Cancel" variant="outline" onPress={onClose} style={{ flex: 1 }} />
            <Button label="Continue" onPress={next} style={{ flex: 1 }} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
