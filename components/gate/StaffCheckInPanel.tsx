import { fetchEmployee } from '@/lib/api/employees';
import { searchStaffEmployees } from '@/lib/api/staff';
import { fetchTodayAttendance } from '@/lib/api/attendance';
import type { StaffSearchMatch } from '@/lib/services/api';
import { useFeedback } from '@/lib/hooks/useFeedback';
import { useCheckedInStaff } from '@/lib/hooks/useCheckedInStaff';
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
import { COLORS, spacing, borderRadius, fontFamily, fontSize } from '@/src/core/theme';

export function StaffCheckInPanel() {
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState('');
  const [searching, setSearching] = useState(false);
  const [matches, setMatches] = useState<StaffSearchMatch[]>([]);

  const feedback = useFeedback();
  const pendingEmployee = useGateStore((s) => s.pendingScannedEmployee);
  const setPendingEmployee = useGateStore((s) => s.setPendingScannedEmployee);

  useEffect(() => {
    if (pendingEmployee) {
      const id = extractEmployeeId(pendingEmployee);
      setPendingEmployee(null);
      if (id) {
        setMatches([]);
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
  const checkedInStaff = useCheckedInStaff();

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
    setManualInput('');
    setMatches([]);
  }

  function selectMatch(match: StaffSearchMatch) {
    setMatches([]);
    setEmployeeId(match.employee_id);
  }

  async function onManualSubmit() {
    const v = manualInput.trim();
    if (!v) {
      feedback.warning('Enter an employee ID or name');
      return;
    }
    setSearching(true);
    setMatches([]);
    try {
      const results = await searchStaffEmployees(v);
      if (results.length === 0) {
        feedback.error(`No active employee found matching "${v}"`);
      } else if (results.length === 1) {
        setEmployeeId(results[0].employee_id);
      } else {
        setMatches(results);
      }
    } catch (e) {
      feedback.error(e instanceof Error ? e.message : 'Staff search failed');
    } finally {
      setSearching(false);
    }
  }

  async function onCheckIn() {
    if (!employeeQuery.data) return;
    try {
      // Stay on this employee after check-in (don't reset) — the
      // today-attendance query below gets invalidated by the mutation and
      // refetches, flipping straight to the STEP OUT / CHECK OUT view
      // instead of bouncing back to search with no way to see it.
      await attendance.mutateAsync({ employee: employeeQuery.data });
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
    if (matches.length > 0) {
      return (
        <View style={{ marginTop: spacing.sm }}>
          <Text
            style={{
              fontFamily: fontFamily.semiBold,
              fontSize: fontSize.sm,
              color: COLORS.textSecondary,
              marginBottom: spacing.xs,
            }}
          >
            {matches.length} matches for &quot;{manualInput.trim()}&quot; — select one
          </Text>
          {matches.map((m) => (
            <TouchableOpacity
              key={m.employee_id}
              onPress={() => selectMatch(m)}
              activeOpacity={0.7}
              accessibilityRole="button"
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: COLORS.surfaceAlt,
                borderRadius: borderRadius.md,
                paddingHorizontal: spacing.md,
                paddingVertical: 10,
                marginBottom: 6,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fontFamily.semiBold, fontSize: fontSize.sm, color: COLORS.text }}>
                  {m.full_name}
                </Text>
                <Text style={{ fontFamily: fontFamily.regular, fontSize: fontSize.xs, color: COLORS.textMuted }}>
                  {m.employee_id}
                  {m.designation ? ' · ' + m.designation : ''}
                  {m.custom_farm ? ' · ' + m.custom_farm : ''}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            onPress={() => setMatches([])}
            activeOpacity={0.7}
            style={{ alignItems: 'center', paddingVertical: 10, marginTop: 4 }}
          >
            <Text style={{ color: COLORS.textMuted, fontSize: fontSize.sm, fontFamily: fontFamily.regular }}>
              Back to search
            </Text>
          </TouchableOpacity>
        </View>
      );
    }
    const checkedIn = checkedInStaff.data ?? [];
    return (
      <View style={{ marginTop: spacing.sm }}>
        {checkedIn.length > 0 ? (
          <View style={{ marginBottom: spacing.md }}>
            <Text
              style={{
                fontFamily: fontFamily.semiBold,
                fontSize: fontSize.sm,
                color: COLORS.textSecondary,
                marginBottom: spacing.xs,
              }}
            >
              Currently checked in ({checkedIn.length})
            </Text>
            {checkedIn.map((row) => (
              <TouchableOpacity
                key={row.name}
                onPress={() => setEmployeeId(row.employee)}
                activeOpacity={0.7}
                accessibilityRole="button"
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: COLORS.surfaceAlt,
                  borderRadius: borderRadius.md,
                  paddingHorizontal: spacing.md,
                  paddingVertical: 10,
                  marginBottom: 6,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fontFamily.semiBold, fontSize: fontSize.sm, color: COLORS.text }}>
                    {row.employee_name || row.employee}
                  </Text>
                  <Text style={{ fontFamily: fontFamily.regular, fontSize: fontSize.xs, color: COLORS.textMuted }}>
                    {row.employee} · In {fmtTime(row.in_time)} · {getDuration(row.in_time)}
                    {row.custom_temp_exit_time ? ' · Stepped out' : ''}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

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
              fontFamily: fontFamily.bold,
              marginLeft: spacing.sm,
              fontSize: fontSize.md,
              letterSpacing: 0.5,
            }}
          >
            SCAN EMPLOYEE BADGE
          </Text>
        </TouchableOpacity>

        <Text style={{ textAlign: 'center', color: COLORS.textMuted, marginVertical: 10, fontSize: fontSize.xs, fontFamily: fontFamily.regular }}>
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
            placeholder="Employee ID or name"
            placeholderTextColor={COLORS.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            editable={!searching}
            onSubmitEditing={onManualSubmit}
            style={{ flex: 1, paddingVertical: 10, fontSize: fontSize.md, color: COLORS.text }}
          />
          <TouchableOpacity onPress={onManualSubmit} disabled={searching} hitSlop={8} activeOpacity={0.6}>
            {searching ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <Ionicons name="search" size={22} color={COLORS.primary} />
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (employeeQuery.isLoading) {
    return (
      <View style={{ padding: spacing.xl, alignItems: 'center' }}>
        <ActivityIndicator color={COLORS.primary} />
        <Text style={{ color: COLORS.textMuted, marginTop: spacing.sm, fontSize: fontSize.xs, fontFamily: fontFamily.regular }}>
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
            <Text style={{ color: COLORS.text, fontFamily: fontFamily.semiBold, marginLeft: spacing.sm, flex: 1 }}>
              Employee {employeeId} not found
            </Text>
          </View>
          {employeeQuery.error instanceof Error ? (
            <Text style={{ color: COLORS.textMuted, fontSize: fontSize.xs, fontFamily: fontFamily.regular, marginTop: 6 }}>
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
          <Text style={{ color: COLORS.primary, fontFamily: fontFamily.semiBold }}>Try another</Text>
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
          <Ionicons name="card-outline" size={22} color={COLORS.text} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={{ fontSize: fontSize.md, fontFamily: fontFamily.semiBold, color: COLORS.text }}>
              {emp.employee_name}
            </Text>
            <Text style={{ color: COLORS.textSecondary, fontSize: fontSize.sm, fontFamily: fontFamily.regular }}>
              ID: {emp.name}
            </Text>
            {emp.designation ? (
              <Text style={{ color: COLORS.textSecondary, fontSize: fontSize.xs, fontFamily: fontFamily.regular, marginTop: 2 }}>
                {emp.designation}
              </Text>
            ) : null}
            {emp.department ? (
              <Text style={{ color: COLORS.textSecondary, fontSize: fontSize.xs, fontFamily: fontFamily.regular }}>
                {emp.department}
              </Text>
            ) : null}
            {emp.custom_location || emp.custom_farm ? (
              <Text style={{ color: COLORS.textSecondary, fontSize: fontSize.xs, fontFamily: fontFamily.regular }}>
                {[emp.custom_location, emp.custom_farm].filter(Boolean).join(' · ')}
              </Text>
            ) : null}
          </View>
        </View>
      </View>

      {todayAttendanceQuery.isLoading ? (
        <View style={{ alignItems: 'center', marginTop: 16 }}>
          <ActivityIndicator color={COLORS.primary} />
          <Text style={{ color: COLORS.textMuted, marginTop: 8, fontSize: fontSize.xs, fontFamily: fontFamily.regular }}>
            Checking attendance status…
          </Text>
        </View>
      ) : todayAttendanceQuery.isError ? (
        <View
          style={{
            backgroundColor: '#FEF2F2',
            borderRadius: borderRadius.md,
            padding: 14,
            marginTop: 14,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="alert-circle-outline" size={20} color={COLORS.danger} />
            <Text style={{ color: COLORS.danger, fontFamily: fontFamily.semiBold, marginLeft: spacing.sm, flex: 1 }}>
              Could not check today's attendance status
            </Text>
          </View>
          <Text style={{ color: COLORS.textMuted, fontSize: fontSize.xs, fontFamily: fontFamily.regular, marginTop: 6 }}>
            {todayAttendanceQuery.error instanceof Error
              ? todayAttendanceQuery.error.message
              : 'Unknown error'}
          </Text>
          <Text style={{ color: COLORS.textMuted, fontSize: fontSize.xs, fontFamily: fontFamily.regular, marginTop: 4 }}>
            Check-out / step-out won't show up while this is failing — CHECK IN below may re-create a duplicate record if this employee is already checked in.
          </Text>
        </View>
      ) : isCheckedIn ? (
        <>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#F0FDF4',
              borderRadius: borderRadius.md,
              paddingHorizontal: spacing.md,
              paddingVertical: 10,
              marginTop: 14,
            }}
          >
            <Ionicons name="log-in-outline" size={16} color={COLORS.success} />
            <Text style={{ color: COLORS.success, fontSize: fontSize.sm, fontFamily: fontFamily.semiBold, marginLeft: 6 }}>
              Checked in at {fmtTime(openAttendance!.in_time)}
            </Text>
          </View>

          {steppedOut ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#FFFBEB',
                borderRadius: borderRadius.md,
                paddingHorizontal: spacing.md,
                paddingVertical: 10,
                marginTop: 8,
              }}
            >
              <Ionicons name="walk-outline" size={16} color={COLORS.warn} />
              <Text style={{ color: COLORS.warn, fontSize: fontSize.sm, fontFamily: fontFamily.semiBold, marginLeft: 6 }}>
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
              <Text style={{ color: COLORS.textOnPrimary, fontFamily: fontFamily.semiBold, marginLeft: 6, letterSpacing: 0.5, fontSize: fontSize.sm }}>
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
              <Text style={{ color: COLORS.textOnPrimary, fontFamily: fontFamily.semiBold, marginLeft: 6, letterSpacing: 0.5, fontSize: fontSize.sm }}>
                CHECK OUT
              </Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
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
          <Text style={{ color: COLORS.textOnPrimary, fontFamily: fontFamily.semiBold, marginLeft: 6, letterSpacing: 0.5 }}>
            CHECK IN
          </Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        onPress={reset}
        activeOpacity={0.7}
        disabled={attendance.isPending || checkOut.isPending || tempExit.isPending}
        style={{ alignItems: 'center', paddingVertical: 10, marginTop: spacing.xs }}
      >
        <Text style={{ color: COLORS.textMuted, fontSize: fontSize.sm, fontFamily: fontFamily.regular }}>
          Cancel · Scan another
        </Text>
      </TouchableOpacity>
    </View>
  );
}
