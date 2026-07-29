import { FormSelect } from '@/components/forms/FormSelect';
import { fetchEmployee } from '@/lib/api/employees';
import { fetchTodayAttendance } from '@/lib/api/attendance';
import { TRANSPORT_MODES, TransportMode } from '@/constants/transportModes';
import { useFeedback } from '@/lib/hooks/useFeedback';
import { useStaffAttendance } from '@/lib/hooks/useStaffAttendance';
import { useStaffCheckOut } from '@/lib/hooks/useStaffCheckOut';
import { useStaffTempExit } from '@/lib/hooks/useStaffTempExit';
import { useGateStore } from '@/lib/stores/gateStore';
import { extractEmployeeId } from '@/lib/utils/qr';
import { fmtTime, getDuration } from '@/lib/utils/date';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { COLORS, spacing, borderRadius, fontSize } from '@/src/core/theme';

export function StaffCheckInPanel() {
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [transportMode, setTransportMode] = useState<TransportMode>(TransportMode.OnFoot);
  const [numberPlate, setNumberPlate] = useState('');
  const [manualInput, setManualInput] = useState('');

  const feedback = useFeedback();
  const pendingEmployee = useGateStore((s) => s.pendingScannedEmployee);
  const setPendingEmployee = useGateStore((s) => s.setPendingScannedEmployee);

  useEffect(() => {
    if (pendingEmployee) {
      const id = extractEmployeeId(pendingEmployee);
      setPendingEmployee(null);
      if (id) {
        setEmployeeId(id);
      } else {
        feedback.error('Could not read employee ID from badge');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingEmployee]);

  const employeeQuery = useQuery({
    queryKey: ['employee', employeeId],
    queryFn: () => fetchEmployee(employeeId!),
    enabled: Boolean(employeeId),
    retry: false,
  });

  const attendance = useStaffAttendance();
  const checkOut = useStaffCheckOut(employeeId ?? undefined);
  const tempExit = useStaffTempExit(employeeId ?? undefined);

  const todayAttendanceQuery = useQuery({
    queryKey: ['staff-attendance-today', employeeId],
    queryFn: () => fetchTodayAttendance(employeeId!),
    enabled: Boolean(employeeId),
    retry: false,
  });

  const openAttendance = todayAttendanceQuery.data;
  const isCheckedIn = Boolean(openAttendance?.in_time && !openAttendance?.out_time);
  const steppedOut = Boolean(openAttendance?.custom_temp_exit_time);

  function reset() {
    setEmployeeId(null);
    setTransportMode(TransportMode.OnFoot);
    setNumberPlate('');
    setManualInput('');
  }

  function onManualSubmit() {
    const v = manualInput.trim();
    if (!v) {
      feedback.warning('Enter an employee ID');
      return;
    }
    setEmployeeId(v);
  }

  async function onCheckIn() {
    if (!employeeQuery.data) return;
    try {
      await attendance.mutateAsync({
        employee: employeeQuery.data,
        transportMode,
        numberPlate: transportMode !== TransportMode.OnFoot ? numberPlate : undefined,
      });
      reset();
    } catch {
      // feedback handled in the hook
    }
  }

  async function onCheckOut() {
    if (!openAttendance) return;
    try {
      await checkOut.mutateAsync(openAttendance.name);
      reset();
    } catch {
      // feedback handled in the hook
    }
  }

  async function onTempExit() {
    if (!openAttendance) return;
    try {
      await tempExit.mutateAsync({ name: openAttendance.name, direction: steppedOut ? 'in' : 'out' });
    } catch {
      // feedback handled in the hook
    }
  }

  if (!employeeId) {
    return (
      <View style={{ marginTop: spacing.sm }}>
        <TouchableOpacity
          onPress={() => router.push('/scan?intent=employee')}
          activeOpacity={0.8}
          accessibilityRole="button"
          style={{
            backgroundColor: COLORS.primary,
            paddingVertical: 18,
            borderRadius: borderRadius.lg,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 60,
          }}
        >
          <Ionicons name="qr-code-outline" size={24} color={COLORS.textOnPrimary} />
          <Text
            style={{
              color: COLORS.textOnPrimary,
              fontWeight: '700',
              marginLeft: spacing.sm,
              fontSize: fontSize.md,
              letterSpacing: 0.5,
            }}
          >
            SCAN EMPLOYEE BADGE
          </Text>
        </TouchableOpacity>

        <Text style={{ textAlign: 'center', color: COLORS.textMuted, marginVertical: 10, fontSize: fontSize.xs }}>
          Or enter employee ID manually
        </Text>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: COLORS.border,
            borderRadius: borderRadius.md,
            paddingHorizontal: spacing.md,
            backgroundColor: COLORS.surface,
          }}
        >
          <TextInput
            value={manualInput}
            onChangeText={setManualInput}
            placeholder="Payroll ID or Employee ID"
            placeholderTextColor={COLORS.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={onManualSubmit}
            style={{ flex: 1, paddingVertical: 10, fontSize: fontSize.md, color: COLORS.text }}
          />
          <TouchableOpacity onPress={onManualSubmit} hitSlop={8} activeOpacity={0.6}>
            <Ionicons name="search" size={22} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (employeeQuery.isLoading) {
    return (
      <View style={{ padding: spacing.xl, alignItems: 'center' }}>
        <ActivityIndicator color={COLORS.primary} />
        <Text style={{ color: COLORS.textMuted, marginTop: spacing.sm, fontSize: fontSize.xs }}>
          Loading employee {employeeId}…
        </Text>
      </View>
    );
  }

  if (employeeQuery.isError || !employeeQuery.data) {
    return (
      <View style={{ marginTop: spacing.md }}>
        <View
          style={{
            backgroundColor: COLORS.surfaceAlt,
            borderRadius: borderRadius.md,
            padding: 14,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="alert-circle-outline" size={22} color={COLORS.text} />
            <Text style={{ color: COLORS.text, fontWeight: '700', marginLeft: spacing.sm, flex: 1 }}>
              Employee {employeeId} not found
            </Text>
          </View>
          {employeeQuery.error instanceof Error ? (
            <Text style={{ color: COLORS.textMuted, fontSize: fontSize.xs, marginTop: 6 }}>
              {employeeQuery.error.message}
            </Text>
          ) : null}
        </View>
        <TouchableOpacity
          onPress={reset}
          activeOpacity={0.8}
          style={{
            borderWidth: 1,
            borderColor: COLORS.primary,
            borderRadius: borderRadius.md,
            paddingVertical: spacing.md,
            minHeight: 48,
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 10,
          }}
        >
          <Text style={{ color: COLORS.primary, fontWeight: '600' }}>Try another</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const emp = employeeQuery.data;

  return (
    <View style={{ marginTop: spacing.md }}>
      <View
        style={{
          backgroundColor: COLORS.surfaceAlt,
          borderRadius: borderRadius.md,
          padding: 14,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          {/* TODO: Wave 4 follow-up — icon mapping: no direct Ionicons equivalent for 'badge' */}
          <Ionicons name="card-outline" size={22} color={COLORS.text} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.text }}>
              {emp.employee_name}
            </Text>
            <Text style={{ color: COLORS.textSecondary, fontSize: fontSize.sm }}>ID: {emp.name}</Text>
            {emp.designation ? (
              <Text style={{ color: COLORS.textSecondary, fontSize: fontSize.xs, marginTop: 2 }}>
                {emp.designation}
              </Text>
            ) : null}
            {emp.department ? (
              <Text style={{ color: COLORS.textSecondary, fontSize: fontSize.xs }}>{emp.department}</Text>
            ) : null}
            {emp.custom_location || emp.custom_farm ? (
              <Text style={{ color: COLORS.textSecondary, fontSize: fontSize.xs }}>
                {[emp.custom_location, emp.custom_farm].filter(Boolean).join(' · ')}
              </Text>
            ) : null}
          </View>
        </View>
      </View>

      {todayAttendanceQuery.isLoading ? (
        <View style={{ alignItems: 'center', marginTop: 16 }}>
          <ActivityIndicator color={COLORS.primary} />
          <Text style={{ color: COLORS.textMuted, marginTop: 8, fontSize: fontSize.xs }}>
            Checking attendance status…
          </Text>
        </View>
      ) : isCheckedIn ? (
        <>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#E8F5E9',
              borderRadius: borderRadius.md,
              paddingHorizontal: spacing.md,
              paddingVertical: 10,
              marginTop: 14,
            }}
          >
            <Ionicons name="log-in-outline" size={16} color={COLORS.success} />
            <Text style={{ color: COLORS.success, fontSize: fontSize.sm, fontWeight: '600', marginLeft: 6 }}>
              Checked in at {fmtTime(openAttendance!.in_time)}
            </Text>
          </View>

          {steppedOut ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#FFF3E0',
                borderRadius: borderRadius.md,
                paddingHorizontal: spacing.md,
                paddingVertical: 10,
                marginTop: 8,
              }}
            >
              <Ionicons name="walk-outline" size={16} color={COLORS.warn} />
              <Text style={{ color: COLORS.warn, fontSize: fontSize.sm, fontWeight: '600', marginLeft: 6 }}>
                Stepped out at {fmtTime(openAttendance!.custom_temp_exit_time)} ·{' '}
                {getDuration(openAttendance!.custom_temp_exit_time)}
              </Text>
            </View>
          ) : null}

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
            <TouchableOpacity
              onPress={onTempExit}
              disabled={tempExit.isPending}
              activeOpacity={0.8}
              accessibilityRole="button"
              style={{
                flex: 1,
                backgroundColor: steppedOut ? COLORS.success : COLORS.warn,
                opacity: tempExit.isPending ? 0.6 : 1,
                borderRadius: borderRadius.md,
                paddingVertical: spacing.lg,
                minHeight: 52,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
              }}
            >
              <Ionicons name={steppedOut ? 'log-in-outline' : 'walk-outline'} size={18} color={COLORS.textOnPrimary} />
              <Text style={{ color: COLORS.textOnPrimary, fontWeight: '700', marginLeft: 6, letterSpacing: 0.5, fontSize: fontSize.sm }}>
                {steppedOut ? 'RETURN' : 'STEP OUT'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onCheckOut}
              disabled={checkOut.isPending}
              activeOpacity={0.8}
              accessibilityRole="button"
              style={{
                flex: 1,
                backgroundColor: COLORS.danger,
                opacity: checkOut.isPending ? 0.6 : 1,
                borderRadius: borderRadius.md,
                paddingVertical: spacing.lg,
                minHeight: 52,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
              }}
            >
              <Ionicons name="log-out-outline" size={18} color={COLORS.textOnPrimary} />
              <Text style={{ color: COLORS.textOnPrimary, fontWeight: '700', marginLeft: 6, letterSpacing: 0.5, fontSize: fontSize.sm }}>
                CHECK OUT
              </Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <>
          <View style={{ marginTop: 14 }}>
            <FormSelect
              label="Mode of Transport"
              value={transportMode}
              options={TRANSPORT_MODES}
              onChange={(v) => setTransportMode(v as TransportMode)}
            />
          </View>

          {transportMode !== TransportMode.OnFoot ? (
            <>
              <Text
                style={{
                  fontSize: fontSize.sm,
                  color: COLORS.textSecondary,
                  marginBottom: 4,
                  fontWeight: '600',
                }}
              >
                {transportMode === TransportMode.MotorBike
                  ? 'Motorbike Number Plate'
                  : 'Number Plate'}
              </Text>
              <TextInput
                value={numberPlate}
                onChangeText={setNumberPlate}
                placeholder="e.g. KAY 123A"
                placeholderTextColor={COLORS.textMuted}
                autoCapitalize="characters"
                autoCorrect={false}
                editable={!attendance.isPending}
                style={{
                  borderWidth: 1,
                  borderColor: COLORS.border,
                  borderRadius: borderRadius.md,
                  paddingHorizontal: spacing.md,
                  paddingVertical: 10,
                  fontSize: fontSize.md,
                  color: COLORS.text,
                  backgroundColor: COLORS.surface,
                  marginBottom: 4,
                }}
              />
            </>
          ) : null}

          <TouchableOpacity
            onPress={onCheckIn}
            disabled={attendance.isPending}
            activeOpacity={0.8}
            accessibilityRole="button"
            style={{
              backgroundColor: COLORS.primary,
              opacity: attendance.isPending ? 0.6 : 1,
              borderRadius: borderRadius.md,
              paddingVertical: spacing.lg,
              minHeight: 52,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              marginTop: 14,
            }}
          >
            <Ionicons name="log-in-outline" size={18} color={COLORS.textOnPrimary} />
            <Text style={{ color: COLORS.textOnPrimary, fontWeight: '700', marginLeft: 6, letterSpacing: 0.5 }}>
              CHECK IN
            </Text>
          </TouchableOpacity>
        </>
      )}

      <TouchableOpacity
        onPress={reset}
        activeOpacity={0.7}
        disabled={attendance.isPending || checkOut.isPending || tempExit.isPending}
        style={{ alignItems: 'center', paddingVertical: 10, marginTop: spacing.xs }}
      >
        <Text style={{ color: COLORS.textMuted, fontSize: fontSize.sm }}>Cancel · Scan another</Text>
      </TouchableOpacity>
    </View>
  );
}
