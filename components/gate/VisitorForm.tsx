import { View } from 'react-native';
import { Controller, Control, FieldErrors } from 'react-hook-form';
import { FormInput } from '@/components/forms/FormInput';
import { FormSelect } from '@/components/forms/FormSelect';
import { HostSearchField } from '@/components/forms/HostSearchField';
import { TRANSPORT_MODES } from '@/constants/transportModes';
import type { VisitorFormValues } from './visitorFormValues';

type Props = {
  control: Control<VisitorFormValues>;
  errors: FieldErrors<VisitorFormValues>;
  setValue: (field: keyof VisitorFormValues, value: string | number | undefined) => void;
  watchTransport: string;
  watchHostId: string;
  watchHostName: string;
};

export function VisitorForm({
  control,
  errors,
  setValue,
  watchTransport,
  watchHostId,
  watchHostName,
}: Props) {
  const showVehicleFields = watchTransport && watchTransport !== 'On Foot';

  return (
    <View>
      <Controller
        control={control}
        name="customer_name"
        render={({ field: { onChange, value, onBlur } }) => (
          <FormInput
            label="Full Name"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            autoCapitalize="words"
            error={errors.customer_name?.message}
          />
        )}
      />

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Controller
            control={control}
            name="id_ref"
            render={({ field: { onChange, value, onBlur } }) => (
              <FormInput
                label="ID / Ref"
                value={value ?? ''}
                onChangeText={onChange}
                onBlur={onBlur}
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
                label="Phone"
                value={value ?? ''}
                onChangeText={onChange}
                onBlur={onBlur}
                keyboardType="phone-pad"
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

      {showVehicleFields ? (
        <>
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
