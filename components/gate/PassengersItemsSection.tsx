import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { VisitCarriedItem, VisitPassenger } from '@/lib/services/api';
import { COLORS, spacing, borderRadius, fontFamily, fontSize } from '@/src/core/theme';

// Passenger names + carried items, entered at the gate. Rows are plain
// drafts (strings, a stable key) so half-typed values never get coerced;
// toPassengerPayload / toItemPayload turn them into what
// api.saveVisitPeopleAndItems expects.

export type PassengerDraft = { key: string; full_name: string; id_number: string; phone: string };
// carried_by '' means the visitor themselves - it follows their name if the
// guard edits it later, and the server resolves '' to the visitor's name.
export type ItemDraft = {
  key: string;
  carried_by: string;
  item: string;
  qty: string;
  serial_notes: string;
};

// Passengers only make sense for transport that carries them.
export const PASSENGER_TRANSPORT_MODES = ['Vehicle', 'Motorcycle'];

let draftKeySeq = 0;
function newKey(prefix: string) {
  draftKeySeq += 1;
  return prefix + String(draftKeySeq) + '-' + String(Date.now());
}

export function passengerDraftsFrom(rows: VisitPassenger[]): PassengerDraft[] {
  return rows.map((p) => ({
    key: newKey('p'),
    full_name: p.full_name ?? '',
    id_number: p.id_number ?? '',
    phone: p.phone ?? '',
  }));
}

export function itemDraftsFrom(rows: VisitCarriedItem[]): ItemDraft[] {
  return rows.map((i) => ({
    key: newKey('i'),
    carried_by: i.carried_by ?? '',
    item: i.item ?? '',
    qty: i.qty != null ? String(i.qty) : '1',
    serial_notes: i.serial_notes ?? '',
  }));
}

export function toPassengerPayload(rows: PassengerDraft[]): VisitPassenger[] {
  return rows
    .filter((p) => p.full_name.trim())
    .map((p) => ({
      full_name: p.full_name.trim(),
      id_number: p.id_number.trim(),
      phone: p.phone.trim(),
    }));
}

export function toItemPayload(rows: ItemDraft[]): VisitCarriedItem[] {
  return rows
    .filter((i) => i.item.trim())
    .map((i) => ({
      carried_by: i.carried_by.trim(),
      item: i.item.trim(),
      qty: Math.max(parseInt(i.qty, 10) || 1, 1),
      serial_notes: i.serial_notes.trim(),
    }));
}

type Props = {
  // Name of the visitor / contractor company - the default owner of an item.
  visitorName: string;
  // Extra people items can belong to, e.g. a contractor's personnel.
  extraPeople?: string[];
  showPassengers: boolean;
  showItems: boolean;
  passengers: PassengerDraft[];
  onPassengersChange: (rows: PassengerDraft[]) => void;
  items: ItemDraft[];
  onItemsChange: (rows: ItemDraft[]) => void;
  busy?: boolean;
};

export function PassengersItemsSection({
  visitorName,
  extraPeople = [],
  showPassengers,
  showItems,
  passengers,
  onPassengersChange,
  items,
  onItemsChange,
  busy,
}: Props) {
  if (!showPassengers && !showItems) return null;

  const visitorLabel = visitorName.trim() || 'Visitor';
  const people = Array.from(
    new Set(
      [
        visitorLabel,
        ...(showPassengers ? passengers.map((p) => p.full_name.trim()) : []),
        ...extraPeople.map((p) => p.trim()),
      ].filter(Boolean),
    ),
  );

  const updatePassenger = (key: string, patch: Partial<PassengerDraft>) =>
    onPassengersChange(passengers.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  const updateItem = (key: string, patch: Partial<ItemDraft>) =>
    onItemsChange(items.map((i) => (i.key === key ? { ...i, ...patch } : i)));

  return (
    <View>
      {showPassengers ? (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Passengers</Text>
          <Text style={s.hint}>Everyone else in the vehicle, excluding the driver.</Text>
          {passengers.map((p, idx) => (
            <View key={p.key} style={s.rowCard}>
              <View style={s.rowHeader}>
                <Text style={s.rowTitle}>Passenger {idx + 1}</Text>
                <TouchableOpacity
                  onPress={() => onPassengersChange(passengers.filter((r) => r.key !== p.key))}
                  disabled={busy}
                  hitSlop={8}
                  accessibilityLabel={'Remove passenger ' + String(idx + 1)}
                >
                  <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
                </TouchableOpacity>
              </View>
              <TextInput
                value={p.full_name}
                onChangeText={(v) => updatePassenger(p.key, { full_name: v })}
                placeholder="Full name"
                placeholderTextColor={COLORS.textMuted}
                autoCapitalize="words"
                editable={!busy}
                style={s.input}
              />
              <View style={s.inlineRow}>
                <TextInput
                  value={p.id_number}
                  onChangeText={(v) => updatePassenger(p.key, { id_number: v })}
                  placeholder="ID number"
                  placeholderTextColor={COLORS.textMuted}
                  editable={!busy}
                  style={[s.input, s.flex]}
                />
                <TextInput
                  value={p.phone}
                  onChangeText={(v) => updatePassenger(p.key, { phone: v })}
                  placeholder="Phone"
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="phone-pad"
                  editable={!busy}
                  style={[s.input, s.flex]}
                />
              </View>
            </View>
          ))}
          <AddButton
            label="Add passenger"
            disabled={busy}
            onPress={() =>
              onPassengersChange([
                ...passengers,
                { key: newKey('p'), full_name: '', id_number: '', phone: '' },
              ])
            }
          />
        </View>
      ) : null}

      {showItems ? (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Carried Items</Text>
          <Text style={s.hint}>
            What each person is bringing in. They are checked again at exit.
          </Text>
          {items.map((it, idx) => {
            const owner = it.carried_by || visitorLabel;
            return (
              <View key={it.key} style={s.rowCard}>
                <View style={s.rowHeader}>
                  <Text style={s.rowTitle}>Item {idx + 1}</Text>
                  <TouchableOpacity
                    onPress={() => onItemsChange(items.filter((r) => r.key !== it.key))}
                    disabled={busy}
                    hitSlop={8}
                    accessibilityLabel={'Remove item ' + String(idx + 1)}
                  >
                    <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
                  </TouchableOpacity>
                </View>
                <Text style={s.label}>Carried by</Text>
                <View style={s.chips}>
                  {people.map((person) => {
                    const selected = person === owner;
                    return (
                      <TouchableOpacity
                        key={person}
                        onPress={() =>
                          updateItem(it.key, { carried_by: person === visitorLabel ? '' : person })
                        }
                        disabled={busy}
                        activeOpacity={0.8}
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                        style={[s.chip, selected ? s.chipSelected : null]}
                      >
                        <Text
                          style={[s.chipText, selected ? s.chipTextSelected : null]}
                          numberOfLines={1}
                        >
                          {person}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {!people.includes(owner) ? (
                  <Text style={s.warn}>
                    {owner} is no longer on this visit - pick who carries this item.
                  </Text>
                ) : null}
                <View style={s.inlineRow}>
                  <TextInput
                    value={it.item}
                    onChangeText={(v) => updateItem(it.key, { item: v })}
                    placeholder="Item, e.g. Laptop"
                    placeholderTextColor={COLORS.textMuted}
                    editable={!busy}
                    style={[s.input, s.flex]}
                  />
                  <TextInput
                    value={it.qty}
                    onChangeText={(v) => updateItem(it.key, { qty: v.replace(/[^0-9]/g, '') })}
                    placeholder="Qty"
                    placeholderTextColor={COLORS.textMuted}
                    keyboardType="number-pad"
                    maxLength={3}
                    editable={!busy}
                    style={[s.input, s.qty]}
                  />
                </View>
                <TextInput
                  value={it.serial_notes}
                  onChangeText={(v) => updateItem(it.key, { serial_notes: v })}
                  placeholder="Serial no. / notes (optional)"
                  placeholderTextColor={COLORS.textMuted}
                  editable={!busy}
                  style={s.input}
                />
              </View>
            );
          })}
          <AddButton
            label="Add item"
            disabled={busy}
            onPress={() =>
              onItemsChange([
                ...items,
                { key: newKey('i'), carried_by: '', item: '', qty: '1', serial_notes: '' },
              ])
            }
          />
        </View>
      ) : null}
    </View>
  );
}

function AddButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.7} style={s.addBtn}>
      <Ionicons name="add-circle-outline" size={18} color={COLORS.text} />
      <Text style={s.addBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}

const s = {
  section: { marginBottom: spacing.md },
  sectionTitle: { fontSize: fontSize.sm, fontFamily: fontFamily.semiBold, color: COLORS.text },
  hint: { fontSize: fontSize.xs, color: COLORS.textMuted, marginTop: 2, marginBottom: spacing.sm },
  rowCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: borderRadius.md,
    backgroundColor: COLORS.surface,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  rowHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: spacing.xs,
  },
  rowTitle: {
    flex: 1,
    fontSize: fontSize.xs,
    fontFamily: fontFamily.semiBold,
    color: COLORS.textSecondary,
  },
  label: { fontSize: fontSize.xs, color: COLORS.textMuted, marginBottom: spacing.xs },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    fontSize: fontSize.sm,
    color: COLORS.text,
    backgroundColor: COLORS.bg,
    marginBottom: spacing.xs,
  },
  inlineRow: { flexDirection: 'row' as const, gap: spacing.xs },
  flex: { flex: 1 },
  qty: { width: 64, textAlign: 'center' as const },
  chips: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  chip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    maxWidth: 200,
  },
  chipSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: fontSize.xs, color: COLORS.text },
  chipTextSelected: { color: COLORS.textOnPrimary, fontFamily: fontFamily.semiBold },
  warn: { fontSize: fontSize.xs, color: COLORS.danger, marginBottom: spacing.xs },
  addBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed' as const,
    borderRadius: borderRadius.md,
    paddingVertical: 10,
    gap: spacing.xs,
  },
  addBtnText: { fontSize: fontSize.sm, color: COLORS.text, fontFamily: fontFamily.semiBold },
};
