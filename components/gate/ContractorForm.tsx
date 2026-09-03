import { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, Platform, ActivityIndicator } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { HostSearchField } from '@/components/forms/HostSearchField';
import { FormSelect } from '@/components/forms/FormSelect';
import type { ContractorSearchResult } from '@/lib/api/types';
import { fetchContractorPersonnelHistory } from '@/lib/api/contractors';
import { toFrappeDateTime, fmtDateTime } from '@/lib/utils/date';
import { formatKenyanPlate } from '@/lib/utils/plate';
import { COLORS, spacing, borderRadius, fontSize } from '@/src/core/theme';
import { TRANSPORT_MODES, TRANSPORT_MODE_ICONS, type TransportMode } from '@/constants/transportModes';

export type ContractorPersonnelInput = {
  full_name: string;
  id_number: string;
  is_team_leader: boolean;
};

type ContractorTransportMode = TransportMode;

// A row is "recognized" once its id_number has matched a past visit's
// Contractor Personnel record — historyMatch carries just enough to show
// the guard why the Full Name field locked. Any edit to id_number after a
// match must clear this immediately (see PersonnelRowCard's onChangeText)
// so a new person typed into a reused row never inherits a stale lock.
type ContractorPersonnelHistoryMatch = {
  last_contractor_name?: string;
  last_visit_date?: string;
};
type PersonnelRow = ContractorPersonnelInput & {
  key: string;
  historyMatch: ContractorPersonnelHistoryMatch | null;
};

let rowKeySeq = 0;
function newRowKey() {
  rowKeySeq += 1;
  return 'p' + String(rowKeySeq) + '-' + String(Date.now());
}

// Below this length an ID number is still being typed — an exact-match
// lookup against a partial ID is just a wasted request (and Kenyan
// national IDs run 7-8 digits), so the debounced lookup effect in
// PersonnelRowCard waits until the value looks plausibly complete.
const MIN_ID_LOOKUP_LENGTH = 6;
// Same 250ms-class debounce as HostSearchField/CustomerSearchField's
// type-ahead search, just a little longer since this fires a
// single-record exact-match lookup rather than a live-results dropdown —
// no benefit to firing before the guard has plausibly finished typing.
const ID_LOOKUP_DEBOUNCE_MS = 400;

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
  // Stable identity (useCallback with no deps — setPersonnel's updater form
  // never touches anything from this render) so PersonnelRowCard's
  // debounce effect can depend on it without the timer being torn down and
  // restarted every time an unrelated field on the form changes. Declared
  // above the early `if (!found) return` below — Rules of Hooks require
  // every hook to run unconditionally on every render.
  const updatePersonRow = useCallback((key: string, patch: Partial<PersonnelRow>) => {
    setPersonnel((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }, []);
  // TEMPORARY, per explicit request: the active-contract requirement
  // (has_active_contract, a Contract row with status=Active) is disabled
  // for now — this only checks "is this a known contractor at all". Revert
  // to `Boolean(result.is_contractor && result.has_active_contract)` to
  // restore the real gate once contract-status enforcement is wanted again.
  const found = Boolean(result.is_contractor);

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
    // Fresh row, fresh key, always unlocked — a brand new row can never
    // start out carrying a stale historyMatch from some other row.
    setPersonnel((rows) => [
      ...rows,
      { key: newRowKey(), full_name: '', id_number: '', is_team_leader: false, historyMatch: null },
    ]);
  };

  const removePersonRow = (key: string) => {
    setPersonnel((rows) => rows.filter((r) => r.key !== key));
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
              onBlur={() => setPlate((v) => formatKenyanPlate(v))}
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
          <PersonnelRowCard
            key={row.key}
            row={row}
            idx={idx}
            busy={busy}
            updateRow={updatePersonRow}
            onRemove={removePersonRow}
          />
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

// One personnel row, independent of every other row: its debounce timer,
// its in-flight lookup, and its historyMatch lock all live keyed off THIS
// row's own key/id_number. Two rows editing simultaneously never share any
// state — each mount of this component gets its own effect instance.
function PersonnelRowCard({
  row,
  idx,
  busy,
  updateRow,
  onRemove,
}: {
  row: PersonnelRow;
  idx: number;
  busy?: boolean;
  updateRow: (key: string, patch: Partial<PersonnelRow>) => void;
  onRemove: (key: string) => void;
}) {
  const [checkingHistory, setCheckingHistory] = useState(false);
  const locked = row.historyMatch != null;

  // Debounced exact-ID lookup. Keyed on row.id_number (and row.key, which
  // never changes for a given row instance) — NOT on updateRow's identity,
  // which is why updateRow is wrapped in useCallback up in ContractorForm:
  // if it weren't stable, every unrelated keystroke on the form (e.g.
  // Scope of Work) would re-render ContractorForm, hand this row a new
  // updateRow closure, and reset this timer before it ever fired.
  useEffect(() => {
    const value = row.id_number.trim();
    if (value.length < MIN_ID_LOOKUP_LENGTH) {
      setCheckingHistory(false);
      return;
    }
    let cancelled = false;
    setCheckingHistory(true);
    const timer = setTimeout(() => {
      fetchContractorPersonnelHistory(value)
        .then((result) => {
          // Guards against a slow response landing after the guard kept
          // typing past this debounce window (id_number has since changed
          // again, tearing down this effect) — never apply a stale match.
          if (cancelled) return;
          if (result.found) {
            updateRow(row.key, {
              full_name: result.full_name ?? row.full_name,
              historyMatch: {
                last_contractor_name: result.last_contractor_name,
                last_visit_date: result.last_visit_date,
              },
            });
          }
        })
        .finally(() => {
          if (!cancelled) setCheckingHistory(false);
        });
    }, ID_LOOKUP_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // row.full_name intentionally excluded — it's only read inside the
    // .then() as a same-value fallback, and including it would restart the
    // debounce on every keystroke in Full Name too (irrelevant to this
    // lookup, which is keyed on id_number only).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row.id_number, row.key, updateRow]);

  return (
    <View
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
          onPress={() => onRemove(row.key)}
          disabled={busy}
          hitSlop={8}
          activeOpacity={0.6}
        >
          <Ionicons name="close-circle" size={20} color={COLORS.textMuted} />
        </TouchableOpacity>
      </View>

      <TextInput
        value={row.full_name}
        onChangeText={(v) => updateRow(row.key, { full_name: v })}
        placeholder="Full Name"
        placeholderTextColor={COLORS.textMuted}
        autoCapitalize="words"
        editable={!busy && !locked}
        style={[
          {
            borderWidth: 1,
            borderColor: COLORS.border,
            borderRadius: borderRadius.sm,
            paddingHorizontal: spacing.sm,
            paddingVertical: 8,
            fontSize: 14,
            color: COLORS.text,
            marginBottom: spacing.xs,
          },
          locked ? s.lockedInput : undefined,
        ]}
      />
      <TextInput
        value={row.id_number}
        onChangeText={(v) =>
          updateRow(row.key, {
            id_number: v,
            // Any edit to the ID field invalidates a previous match right
            // away — the debounce effect above re-looks-up and, if the new
            // (or re-typed) value still matches, re-locks on its own. This
            // is what stops a new person's row from inheriting whatever
            // was previously typed into this same ID field.
            historyMatch: null,
          })
        }
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

      {checkingHistory ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs }}>
          <ActivityIndicator size="small" color={COLORS.textMuted} />
          <Text style={{ marginLeft: 6, fontSize: fontSize.xs, color: COLORS.textMuted }}>
            Checking history…
          </Text>
        </View>
      ) : null}

      {locked ? (
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.xs }}>
          <Ionicons name="checkmark-circle" size={14} color={COLORS.primary} style={{ marginTop: 1 }} />
          <Text style={{ marginLeft: 6, fontSize: fontSize.xs, color: COLORS.primary, flex: 1 }}>
            Recognized
            {row.historyMatch?.last_contractor_name
              ? ' — last visited with ' + row.historyMatch.last_contractor_name
              : ''}
            {row.historyMatch?.last_visit_date
              ? ' on ' + fmtDateTime(row.historyMatch.last_visit_date)
              : ''}
          </Text>
        </View>
      ) : null}

      <TouchableOpacity
        onPress={() => updateRow(row.key, { is_team_leader: !row.is_team_leader })}
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
  );
}

const s = {
  // Visually mirrors the disabled state — editable={false} already makes
  // this functionally read-only, this just makes it look the part. Same
  // convention as VisitorForm's identityLocked styling.
  lockedInput: {
    backgroundColor: COLORS.bgMuted,
    color: COLORS.textMuted,
  },
} as const;
