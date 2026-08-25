import { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, Platform } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { HostSearchField } from '@/components/forms/HostSearchField';
import { FormSelect } from '@/components/forms/FormSelect';
import type { ContractorSearchResult } from '@/lib/api/types';
import { toFrappeDateTime } from '@/lib/utils/date';
import { COLORS, spacing, borderRadius, fontSize } from '@/src/core/theme';
import { TRANSPORT_MODES, TRANSPORT_MODE_ICONS, type TransportMode } from '@/constants/transportModes';

export type ContractorPersonnelInput = {
  full_name: string;
  id_number: string;
  is_team_leader: boolean;
};

type ContractorTransportMode = TransportMode;

type PersonnelRow = ContractorPersonnelInput & { key: string };

let rowKeySeq = 0;
function newRowKey() {
  rowKeySeq += 1;
  return 'p' + String(rowKeySeq) + '-' + String(Date.now());
}

type Props = {
  result: ContractorSearchResult;
  onNotify: (input: {
    host: string;
    plate?: string;
    passengers?: number;
    transportMode: ContractorTransportMode;
    scopeOfWork?: string;
    expectedExit?: string;
    personnel?: ContractorPersonnelInput[];
  }) => void;
  busy?: boolean;
};

export function ContractorForm({ result, onNotify, busy }: Props) {
  const [passengers, setPassengers] = useState('');
  const [plate, setPlate] = useState('');
  const [hostId, setHostId] = useState<string | null>(null);
  const [hostName, setHostName] = useState<string | null>(null);
  const [transportMode, setTransportMode] = useState<ContractorTransportMode>('On Foot');
  const [scopeOfWork, setScopeOfWork] = useState('');
  const [expectedExit, setExpectedExit] = useState<Date | null>(null);
  const [showExitPicker, setShowExitPicker] = useState(false);
  const [exitPickerMode, setExitPickerMode] = useState<'date' | 'time'>('date');
  const [personnel, setPersonnel] = useState<PersonnelRow[]>([]);
  // has_active_contract is the real check (a Contract row with
  // status=Active) — a contractor whose contract lapsed still matches by
  // name (is_contractor=true) but shouldn't be let through, so this must
  // gate the form, not just "did we find any contractor at all".
  const found = Boolean(result.is_contractor && result.has_active_contract);

  if (!found) {
    const known = Boolean(result.is_contractor);
    return (
      <View
        style={{
          backgroundColor: COLORS.surfaceAlt,
          borderRadius: borderRadius.md,
          padding: 14,
          marginVertical: spacing.sm,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="information-circle" size={22} color={COLORS.text} />
          <Text style={{ color: COLORS.text, fontWeight: '700', marginLeft: spacing.sm }}>
            NO ACTIVE CONTRACT
          </Text>
        </View>
        {known ? (
          <Text style={{ color: COLORS.textSecondary, fontSize: fontSize.sm, marginTop: 6 }}>
            {result.contractor_name} is a known contractor, but their contract is{' '}
            {result.contract_status ? result.contract_status.toLowerCase() : 'not active'} — not
            cleared for site access.
          </Text>
        ) : null}
      </View>
    );
  }

  // Only Vehicle keeps plate + passenger count; Motorcycle and Taxi only
  // need the plate (mirrors VisitorForm's treatment).
  const showFullVehicleFields = transportMode === 'Vehicle';
  const showPlateOnlyField = transportMode === 'Taxi' || transportMode === 'Motorcycle';
  const showPlateField = showFullVehicleFields || showPlateOnlyField;

  const addPersonRow = () => {
    setPersonnel((rows) => [...rows, { key: newRowKey(), full_name: '', id_number: '', is_team_leader: false }]);
  };

  const removePersonRow = (key: string) => {
    setPersonnel((rows) => rows.filter((r) => r.key !== key));
  };

  const updatePersonRow = (key: string, patch: Partial<ContractorPersonnelInput>) => {
    setPersonnel((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const onExitDateChange = (event: DateTimePickerEvent, d?: Date) => {
    if (Platform.OS === 'android') setShowExitPicker(false);
    if (event.type === 'dismissed') return;
    if (d) setExpectedExit(d);
    if (Platform.OS === 'android' && exitPickerMode === 'date') {
      setExitPickerMode('time');
      setShowExitPicker(true);
    }
  };

  const submit = () => {
    if (!hostId) return;
    const raw = passengers.trim();
    const num = parseInt(raw, 10);
    const validPersonnel = personnel
      .filter((p) => p.full_name.trim().length > 0)
      .map((p) => ({
        full_name: p.full_name.trim(),
        id_number: p.id_number.trim(),
        is_team_leader: p.is_team_leader,
      }));
    onNotify({
      host: hostId,
      plate: showPlateField ? plate.trim() || undefined : undefined,
      passengers: showFullVehicleFields && raw && Number.isFinite(num) && num >= 0 ? num : undefined,
      transportMode,
      scopeOfWork: scopeOfWork.trim() || undefined,
      expectedExit: expectedExit ? toFrappeDateTime(expectedExit) : undefined,
      personnel: validPersonnel.length > 0 ? validPersonnel : undefined,
    });
  };

  return (
    <View
      style={{
        backgroundColor: COLORS.surfaceAlt,
        borderRadius: borderRadius.md,
        padding: 14,
        marginVertical: spacing.sm,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <Ionicons name="construct-outline" size={22} color={COLORS.text} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.text }}>
            {result.contractor_name ?? '—'}
          </Text>
          {result.contract_name ? (
            <Text style={{ color: COLORS.textSecondary, fontSize: fontSize.sm }}>
              Contract: {result.contract_name}
              {result.contract_status ? ` · ${result.contract_status}` : ''}
            </Text>
          ) : null}
          {result.project ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
              <Ionicons name="briefcase-outline" size={13} color={COLORS.textSecondary} />
              <Text style={{ color: COLORS.textSecondary, fontSize: fontSize.sm, marginLeft: 4 }}>
                {result.project.project_name ?? result.project.name}
                {result.project.status ? ` (${result.project.status})` : ''}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={{ marginTop: 14 }}>
        <HostSearchField
          selectedHostId={hostId}
          selectedHostName={hostName}
          onSelect={(id, name) => {
            setHostId(id);
            setHostName(name);
          }}
          onClear={() => {
            setHostId(null);
            setHostName(null);
          }}
        />
      </View>

      <View style={{ marginTop: 14 }}>
        <FormSelect
          label="Mode of Transport"
          value={transportMode}
          options={TRANSPORT_MODES}
          onChange={(v) => setTransportMode(v as ContractorTransportMode)}
          iconFor={(opt) => TRANSPORT_MODE_ICONS[opt as ContractorTransportMode] ?? 'radio-button-off-outline'}
        />
      </View>

      {showPlateField ? (
        <View style={{ marginTop: -6 }}>
          <Text style={{ fontSize: fontSize.xs, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6 }}>
            Vehicle Number Plate
          </Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              borderWidth: 1,
              borderColor: COLORS.border,
              borderRadius: borderRadius.md,
              backgroundColor: COLORS.surface,
              paddingHorizontal: spacing.md,
            }}
          >
            <Ionicons name="car-outline" size={18} color={COLORS.textMuted} />
            <TextInput
              value={plate}
              onChangeText={(v) => setPlate(v.toUpperCase())}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder="e.g. KAA 123A"
              placeholderTextColor={COLORS.textMuted}
              maxLength={15}
              editable={!busy}
              style={{
                flex: 1,
                paddingVertical: 10,
                paddingHorizontal: spacing.sm,
                fontSize: 14,
                color: COLORS.text,
              }}
            />
          </View>
        </View>
      ) : null}

      {showFullVehicleFields ? (
        <View style={{ marginTop: 14 }}>
          <Text style={{ fontSize: fontSize.xs, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6 }}>
            Number Of People In The Vehicle
          </Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              borderWidth: 1,
              borderColor: COLORS.border,
              borderRadius: borderRadius.md,
              backgroundColor: COLORS.surface,
              paddingHorizontal: spacing.md,
            }}
          >
            <Ionicons name="people" size={18} color={COLORS.textMuted} />
            <TextInput
              value={passengers}
              onChangeText={(v) => setPassengers(v.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              inputMode="numeric"
              placeholder="0"
              placeholderTextColor={COLORS.textMuted}
              maxLength={3}
              editable={!busy}
              style={{
                flex: 1,
                paddingVertical: 10,
                paddingHorizontal: spacing.sm,
                fontSize: 14,
                color: COLORS.text,
              }}
            />
          </View>
          <Text style={{ fontSize: fontSize.xs, color: COLORS.textMuted, marginTop: spacing.xs }}>
            Leave blank if not applicable
          </Text>
        </View>
      ) : null}

      <View style={{ marginTop: 14 }}>
        <Text style={{ fontSize: fontSize.xs, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6 }}>
          Scope of Work
        </Text>
        <TextInput
          value={scopeOfWork}
          onChangeText={setScopeOfWork}
          placeholder="e.g. Rewiring the packhouse cold room"
          placeholderTextColor={COLORS.textMuted}
          multiline
          numberOfLines={3}
          editable={!busy}
          style={{
            borderWidth: 1,
            borderColor: COLORS.border,
            borderRadius: borderRadius.md,
            backgroundColor: COLORS.surface,
            paddingHorizontal: spacing.md,
            paddingVertical: 10,
            fontSize: 14,
            color: COLORS.text,
            minHeight: 70,
            textAlignVertical: 'top',
          }}
        />
        <Text style={{ fontSize: fontSize.xs, color: COLORS.textMuted, marginTop: spacing.xs }}>
          What is this contractor/team here to do — important for the gate record
        </Text>
      </View>

      <View style={{ marginTop: 14 }}>
        <Text style={{ fontSize: fontSize.xs, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6 }}>
          Expected Exit
        </Text>
        <TouchableOpacity
          onPress={() => {
            setExitPickerMode('date');
            setShowExitPicker(true);
          }}
          disabled={busy}
          activeOpacity={0.7}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: COLORS.border,
            borderRadius: borderRadius.md,
            backgroundColor: COLORS.surface,
            paddingHorizontal: spacing.md,
            paddingVertical: 10,
          }}
        >
          <Ionicons name="time-outline" size={18} color={COLORS.textMuted} />
          <Text
            style={{
              flex: 1,
              marginLeft: spacing.sm,
              fontSize: 14,
              color: expectedExit ? COLORS.text : COLORS.textMuted,
            }}
          >
            {expectedExit ? expectedExit.toLocaleString() : 'Not set'}
          </Text>
          {expectedExit ? (
            <TouchableOpacity onPress={() => setExpectedExit(null)} hitSlop={8} activeOpacity={0.6}>
              <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          ) : null}
        </TouchableOpacity>
        {showExitPicker ? (
          <DateTimePicker
            value={expectedExit ?? new Date()}
            mode={exitPickerMode}
            is24Hour
            onChange={onExitDateChange}
          />
        ) : null}
      </View>

      <View style={{ marginTop: 14 }}>
        <Text style={{ fontSize: fontSize.xs, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6 }}>
          Personnel On Site
        </Text>
        {personnel.map((row, idx) => (
          <View
            key={row.key}
            style={{
              borderWidth: 1,
              borderColor: COLORS.border,
              borderRadius: borderRadius.md,
              backgroundColor: COLORS.surface,
              padding: spacing.sm,
              marginBottom: spacing.sm,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs }}>
              <Text style={{ fontSize: fontSize.xs, color: COLORS.textMuted, flex: 1 }}>
                Person {idx + 1}
              </Text>
              <TouchableOpacity
                onPress={() => removePersonRow(row.key)}
                disabled={busy}
                hitSlop={8}
                activeOpacity={0.6}
              >
                <Ionicons name="close-circle" size={20} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>

            <TextInput
              value={row.full_name}
              onChangeText={(v) => updatePersonRow(row.key, { full_name: v })}
              placeholder="Full Name"
              placeholderTextColor={COLORS.textMuted}
              autoCapitalize="words"
              editable={!busy}
              style={{
                borderWidth: 1,
                borderColor: COLORS.border,
                borderRadius: borderRadius.sm,
                paddingHorizontal: spacing.sm,
                paddingVertical: 8,
                fontSize: 14,
                color: COLORS.text,
                marginBottom: spacing.xs,
              }}
            />
            <TextInput
              value={row.id_number}
              onChangeText={(v) => updatePersonRow(row.key, { id_number: v })}
              placeholder="ID Number (optional)"
              placeholderTextColor={COLORS.textMuted}
              editable={!busy}
              style={{
                borderWidth: 1,
                borderColor: COLORS.border,
                borderRadius: borderRadius.sm,
                paddingHorizontal: spacing.sm,
                paddingVertical: 8,
                fontSize: 14,
                color: COLORS.text,
                marginBottom: spacing.xs,
              }}
            />

            <TouchableOpacity
              onPress={() => updatePersonRow(row.key, { is_team_leader: !row.is_team_leader })}
              disabled={busy}
              activeOpacity={0.7}
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4 }}
            >
              <Ionicons
                name={row.is_team_leader ? 'checkbox' : 'square-outline'}
                size={20}
                color={row.is_team_leader ? COLORS.primary : COLORS.textMuted}
              />
              <Text style={{ marginLeft: spacing.xs, fontSize: fontSize.sm, color: COLORS.text }}>
                Team Leader / Supervisor
              </Text>
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity
          onPress={addPersonRow}
          disabled={busy}
          activeOpacity={0.7}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: COLORS.border,
            borderStyle: 'dashed',
            borderRadius: borderRadius.md,
            paddingVertical: 10,
          }}
        >
          <Ionicons name="add-circle-outline" size={18} color={COLORS.text} />
          <Text style={{ marginLeft: 6, color: COLORS.text, fontWeight: '600', fontSize: fontSize.sm }}>
            Add Person
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        onPress={submit}
        disabled={busy || !hostId}
        activeOpacity={0.8}
        accessibilityRole="button"
        style={{
          backgroundColor: COLORS.primary,
          opacity: busy || !hostId ? 0.6 : 1,
          borderRadius: borderRadius.md,
          paddingVertical: 14,
          minHeight: 48,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          marginTop: spacing.md,
        }}
      >
        <Ionicons name="notifications" size={18} color={COLORS.textOnPrimary} />
        <Text style={{ color: COLORS.textOnPrimary, fontWeight: '700', marginLeft: 6, letterSpacing: 0.5 }}>
          NOTIFY HOST
        </Text>
      </TouchableOpacity>
      {!hostId ? (
        <Text style={{ fontSize: fontSize.xs, color: COLORS.textMuted, marginTop: spacing.xs, textAlign: 'center' }}>
          Select a host to continue
        </Text>
      ) : null}
    </View>
  );
}
