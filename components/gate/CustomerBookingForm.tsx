import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Platform, ActivityIndicator } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { CustomerSearchField } from '@/components/forms/CustomerSearchField';
import { HostSearchField } from '@/components/forms/HostSearchField';
import { useBookCustomerAppointment } from '@/lib/hooks/useBookCustomerAppointment';
import { useFeedback } from '@/lib/hooks/useFeedback';
import { fetchVisitorHistory } from '@/lib/api/visitors';
import { toFrappeDateTime } from '@/lib/utils/date';
import { COLORS, spacing, borderRadius, fontSize } from '@/src/core/theme';

// Same exact-ID-lookup pattern as ContractorForm's per-personnel history
// lock (get_visitor_history has no visitor-type restriction, so a past
// Customer-linked appointment's person is found the same way a Visitor's
// is): once this many digits are typed, debounce a lookup and, on a match,
// prefill + lock Person's Name so a repeat visitor's name can't drift
// between visits due to a guard's typo.
const ID_LOOKUP_DEBOUNCE_MS = 400;
const MIN_ID_LOOKUP_LENGTH = 6;

/**
 * "Book Visit" gate chip — book a future appointment for a Customer ahead
 * of time. Self-contained, like DispatchGatePanel/StaffCheckInPanel: owns
 * its own form state and submits directly via the booking mutation.
 *
 * Only the specific person being sent (name + ID number) is typed in —
 * phone/email are always sourced server-side from the linked Customer
 * record, never typed here.
 */
export function CustomerBookingForm() {
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [personName, setPersonName] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [nameLocked, setNameLocked] = useState(false);
  const [checkingHistory, setCheckingHistory] = useState(false);
  const [historyNote, setHistoryNote] = useState<string | null>(null);
  const [hostId, setHostId] = useState<string | null>(null);
  const [hostName, setHostName] = useState<string | null>(null);
  const [scheduledTime, setScheduledTime] = useState<Date>(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timePickerMode, setTimePickerMode] = useState<'date' | 'time'>('date');
  const [purpose, setPurpose] = useState('');

  const feedback = useFeedback();
  const book = useBookCustomerAppointment();

  function resetForm() {
    setCustomerId(null);
    setCustomerName(null);
    setPersonName('');
    setIdNumber('');
    setNameLocked(false);
    setHistoryNote(null);
    setHostId(null);
    setHostName(null);
    setScheduledTime(new Date());
    setPurpose('');
  }

  // Debounced exact-ID lookup against past visit history (any visitor
  // type — get_visitor_history isn't restricted to Visitor-type
  // appointments). A match locks Person's Name the same way a Visitor
  // walk-in's revisit match does; typing a different ID afterwards
  // re-looks-up and unlocks until a new match confirms it.
  useEffect(() => {
    const value = idNumber.trim();
    if (value.length < MIN_ID_LOOKUP_LENGTH) {
      setCheckingHistory(false);
      setNameLocked(false);
      setHistoryNote(null);
      return;
    }
    let cancelled = false;
    setCheckingHistory(true);
    const timer = setTimeout(() => {
      fetchVisitorHistory(value)
        .then((result) => {
          if (cancelled) return;
          if (result.found) {
            setPersonName(result.visitor_name ?? '');
            setNameLocked(true);
            setHistoryNote(
              result.last_visit_date ? `Last visited on ${result.last_visit_date}` : 'Matched a past visit',
            );
          } else {
            setNameLocked(false);
            setHistoryNote(null);
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
  }, [idNumber]);

  const onTimeChange = (event: DateTimePickerEvent, d?: Date) => {
    if (Platform.OS === 'android') setShowTimePicker(false);
    if (event.type === 'dismissed') return;
    if (d) setScheduledTime(d);
    if (Platform.OS === 'android' && timePickerMode === 'date') {
      setTimePickerMode('time');
      setShowTimePicker(true);
    }
  };

  async function onSubmit() {
    if (!customerId) {
      feedback.warning('Please select a customer');
      return;
    }
    if (!personName.trim()) {
      feedback.warning("Please enter the visitor's name");
      return;
    }
    if (!hostId) {
      feedback.warning('Please select a host');
      return;
    }
    try {
      await book.mutateAsync({
        customer: customerId,
        person_name: personName.trim(),
        id_number: idNumber.trim(),
        host: hostId,
        scheduled_time: toFrappeDateTime(scheduledTime),
        purpose: purpose.trim(),
      });
      resetForm();
    } catch {
      // feedback handled in the hook
    }
  }

  return (
    <View
      style={{
        backgroundColor: COLORS.surfaceAlt,
        borderRadius: borderRadius.md,
        padding: 14,
        marginVertical: spacing.sm,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
        <Ionicons name="calendar-outline" size={22} color={COLORS.text} />
        <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.text, marginLeft: 10 }}>
          Book a Customer Visit
        </Text>
      </View>

      <CustomerSearchField
        selectedCustomerId={customerId}
        selectedCustomerName={customerName}
        onSelect={(id, name) => {
          setCustomerId(id);
          setCustomerName(name);
        }}
        onClear={() => {
          setCustomerId(null);
          setCustomerName(null);
        }}
      />

      <View style={{ marginTop: -6, marginBottom: spacing.xs }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: fontSize.xs, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6 }}>
            {nameLocked ? 'ID Number (verified — locked)' : 'ID Number'}
          </Text>
          {nameLocked ? (
            <TouchableOpacity
              onPress={() => {
                setNameLocked(false);
                setHistoryNote(null);
                setPersonName('');
                setIdNumber('');
              }}
              accessibilityRole="button"
            >
              <Text style={{ fontSize: fontSize.xs, color: COLORS.primary, fontWeight: '600' }}>Not them? Clear</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: COLORS.border,
            borderRadius: borderRadius.md,
            backgroundColor: nameLocked ? COLORS.surfaceAlt : COLORS.surface,
            paddingHorizontal: spacing.md,
          }}
        >
          <Ionicons name="card-outline" size={18} color={COLORS.textMuted} />
          <TextInput
            value={idNumber}
            onChangeText={setIdNumber}
            placeholder="National ID / Passport number — searches past visits"
            placeholderTextColor={COLORS.textMuted}
            editable={!book.isPending && !nameLocked}
            style={{ flex: 1, paddingVertical: 10, paddingHorizontal: spacing.sm, fontSize: 14, color: COLORS.text }}
          />
          {checkingHistory ? <ActivityIndicator size="small" color={COLORS.textMuted} /> : null}
        </View>
        {historyNote ? (
          <Text style={{ fontSize: fontSize.xs, color: COLORS.primary, marginTop: 4 }}>
            ✓ {historyNote} — ID and name locked below
          </Text>
        ) : null}
      </View>

      <View style={{ marginBottom: spacing.md }}>
        <Text style={{ fontSize: fontSize.xs, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6 }}>
          {nameLocked ? "Person's Name (verified — locked)" : "Person's Name"}
        </Text>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: COLORS.border,
            borderRadius: borderRadius.md,
            backgroundColor: nameLocked ? COLORS.surfaceAlt : COLORS.surface,
            paddingHorizontal: spacing.md,
          }}
        >
          <Ionicons name="person-outline" size={18} color={COLORS.textMuted} />
          <TextInput
            value={personName}
            onChangeText={setPersonName}
            placeholder="Who is being sent to visit"
            placeholderTextColor={COLORS.textMuted}
            autoCapitalize="words"
            editable={!book.isPending && !nameLocked}
            style={{ flex: 1, paddingVertical: 10, paddingHorizontal: spacing.sm, fontSize: 14, color: COLORS.text }}
          />
        </View>
      </View>

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

      <View style={{ marginTop: -6, marginBottom: spacing.md }}>
        <Text style={{ fontSize: fontSize.xs, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6 }}>
          Scheduled Date &amp; Time
        </Text>
        <TouchableOpacity
          onPress={() => {
            setTimePickerMode('date');
            setShowTimePicker(true);
          }}
          disabled={book.isPending}
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
          <Text style={{ flex: 1, marginLeft: spacing.sm, fontSize: 14, color: COLORS.text }}>
            {scheduledTime.toLocaleString()}
          </Text>
        </TouchableOpacity>
        {showTimePicker ? (
          <DateTimePicker
            value={scheduledTime}
            mode={timePickerMode}
            is24Hour
            onChange={onTimeChange}
          />
        ) : null}
      </View>

      <View style={{ marginBottom: spacing.md }}>
        <Text style={{ fontSize: fontSize.xs, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6 }}>
          Purpose
        </Text>
        <TextInput
          value={purpose}
          onChangeText={setPurpose}
          placeholder="e.g. Quarterly account review with the sales team"
          placeholderTextColor={COLORS.textMuted}
          multiline
          numberOfLines={3}
          editable={!book.isPending}
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
      </View>

      <TouchableOpacity
        onPress={onSubmit}
        disabled={book.isPending}
        activeOpacity={0.8}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: book.isPending ? COLORS.border : COLORS.primary,
          borderRadius: borderRadius.md,
          paddingVertical: spacing.sm + 4,
        }}
      >
        {book.isPending ? (
          <ActivityIndicator size="small" color={COLORS.textOnPrimary} />
        ) : (
          <>
            <Ionicons name="calendar" size={18} color={COLORS.textOnPrimary} />
            <Text style={{ color: COLORS.textOnPrimary, fontWeight: '700', marginLeft: spacing.sm, fontSize: fontSize.sm }}>
              BOOK APPOINTMENT
            </Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}
