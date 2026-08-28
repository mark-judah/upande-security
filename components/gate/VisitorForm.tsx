import { View, Text, TouchableOpacity } from 'react-native';
import { Controller, Control, FieldErrors } from 'react-hook-form';
import { Ionicons } from '@expo/vector-icons';
import { FormInput } from '@/components/forms/FormInput';
import { FormSelect } from '@/components/forms/FormSelect';
import { HostSearchField } from '@/components/forms/HostSearchField';
import { TRANSPORT_MODES } from '@/constants/transportModes';
import { COLORS, spacing, borderRadius, fontFamily, fontSize } from '@/src/core/theme';
import type { VisitorFormValues } from './visitorFormValues';

type Props = {
  control: Control<VisitorFormValues>;
  errors: FieldErrors<VisitorFormValues>;
  setValue: (field: keyof VisitorFormValues, value: string | number | undefined) => void;
  watchTransport: string;
  watchHostId: string;
  watchHostName: string;
  onScanId?: () => void;
  // True once Name/ID/Phone came from an authoritative source — today's
  // scheduled appointment (onProceed) or a past verified visit
  // (onRegisterAsWalkIn history match). Hard-locks those three fields so a
  // guard's typo can't fork the record for the same person/ID. Everything
  // else (transport, plate, passengers, purpose, host) stays editable.
  identityLocked?: boolean;
};

export function VisitorForm({
  control,
  errors,
  setValue,
  watchTransport,
  watchHostId,
  watchHostName,
  onScanId,
  identityLocked = false,
}: Props) {
  // Only Vehicle keeps the full plate + colour + passengers group - a
  // Motorcycle has no colour/passengers worth capturing, just the plate,
  // same as Taxi.
  const showFullVehicleFields = watchTransport === 'Vehicle';
  const showPlateOnly = watchTransport === 'Taxi' || watchTransport === 'Motorcycle';
  const showPlateField = showFullVehicleFields || showPlateOnly;

  return (
    <View>
      {onScanId ? (
        <TouchableOpacity
          onPress={onScanId}
          activeOpacity={0.8}
          accessibilityRole="button"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: COLORS.primary,
            borderRadius: borderRadius.md,
            paddingVertical: spacing.md,
            marginBottom: spacing.md,
          }}
        >
          <Ionicons name="card-outline" size={18} color={COLORS.textOnPrimary} />
          <Text style={{ color: COLORS.textOnPrimary, fontFamily: fontFamily.semiBold, marginLeft: spacing.sm, fontSize: fontSize.sm }}>
            SCAN ID CARD
          </Text>
        </TouchableOpacity>
      ) : null}

      <Controller
        control={control}
        name="customer_name"
        render={({ field: { onChange, value, onBlur } }) => (
          <FormInput
            label={identityLocked ? 'Full Name (verified — locked)' : 'Full Name'}
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            autoCapitalize="words"
            editable={!identityLocked}
            style={identityLocked ? s.lockedInput : undefined}
            error={errors.customer_name?.message}
          />
        )}
      />

      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Controller
            control={control}
            name="id_ref"
            render={({ field: { onChange, value, onBlur } }) => (
              <FormInput
                label={identityLocked ? 'ID / Ref (verified — locked)' : 'ID / Ref'}
                value={value ?? ''}
                onChangeText={onChange}
                onBlur={onBlur}
                editable={!identityLocked}
                style={identityLocked ? s.lockedInput : undefined}
                error={errors.id_ref?.message}
              />
            )}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Controller
            control={control}
            name="customer_phone_number"
            render={({ field: { onChange, value, onBlur } }) => (
              <FormInput
                label={identityLocked ? 'Phone (verified — locked)' : 'Phone'}
                value={value ?? ''}
                onChangeText={onChange}
                onBlur={onBlur}
                keyboardType="phone-pad"
                editable={!identityLocked}
                style={identityLocked ? s.lockedInput : undefined}
                error={errors.customer_phone_number?.message}
              />
            )}
          />
        </View>
      </View>

      <Controller
        control={control}
        name="custom_mode_of_transport"
        render={({ field: { onChange, value } }) => (
          <FormSelect
            label="Mode of Transport"
            value={value ?? 'On Foot'}
            options={TRANSPORT_MODES}
            onChange={onChange}
            error={errors.custom_mode_of_transport?.message}
          />
        )}
      />

      {showPlateField ? (
        <Controller
          control={control}
          name="custom_vehicles_number_plate"
          render={({ field: { onChange, value, onBlur } }) => (
            <FormInput
              label="Number Plate"
              value={value ?? ''}
              onChangeText={onChange}
              onBlur={onBlur}
              autoCapitalize="characters"
              error={errors.custom_vehicles_number_plate?.message}
            />
          )}
        />
      ) : null}

      {showFullVehicleFields ? (
        <>
          <Controller
            control={control}
            name="custom_vehicles_colour"
            render={({ field: { onChange, value, onBlur } }) => (
              <FormInput
                label="Vehicle Colour"
                value={value ?? ''}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.custom_vehicles_colour?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="custom_number_of_passengers"
            render={({ field: { onChange, value, onBlur } }) => (
              <FormInput
                label="Number of Passengers (excl. driver)"
                value={value != null ? String(value) : ''}
                onChangeText={(t) => onChange(t ? parseInt(t, 10) || 0 : undefined)}
                onBlur={onBlur}
                keyboardType="number-pad"
                error={errors.custom_number_of_passengers?.message}
              />
            )}
          />
        </>
      ) : null}

      <HostSearchField
        selectedHostId={watchHostId || null}
        selectedHostName={watchHostName || null}
        onSelect={(id, name) => {
          setValue('custom_meet_with', id);
          setValue('host_name', name);
        }}
        onClear={() => {
          setValue('custom_meet_with', '');
          setValue('host_name', '');
        }}
        error={errors.custom_meet_with?.message}
      />

      <Controller
        control={control}
        name="customer_details"
        render={({ field: { onChange, value, onBlur } }) => (
          <FormInput
            label="Purpose"
            value={value ?? ''}
            onChangeText={onChange}
            onBlur={onBlur}
            multiline
            numberOfLines={2}
            style={{ minHeight: 54, textAlignVertical: 'top' }}
          />
        )}
      />
    </View>
  );
}

const s = {
  // Visually mirrors the disabled state — editable={false} already makes
  // this functionally read-only, this just makes it look the part.
  lockedInput: {
    backgroundColor: COLORS.bgMuted,
    color: COLORS.textMuted,
  },
} as const;
