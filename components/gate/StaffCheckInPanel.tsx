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
import { MaterialIcons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';

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
      <View style={{ marginTop: 8 }}>
        <TouchableOpacity
          onPress={() => router.push('/(app)/scan?intent=employee')}
          activeOpacity={0.8}
          accessibilityRole="button"
          style={{
            backgroundColor: '#000000',
            paddingVertical: 18,
            borderRadius: 12,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 60,
          }}
        >
          <MaterialIcons name="qr-code-scanner" size={24} color="#FFFFFF" />
          <Text
            style={{
              color: '#FFFFFF',
              fontWeight: '700',
              marginLeft: 8,
              fontSize: 15,
              letterSpacing: 0.5,
            }}
          >
            SCAN EMPLOYEE BADGE
          </Text>
        </TouchableOpacity>

        <Text style={{ textAlign: 'center', color: '#666666', marginVertical: 10, fontSize: 12 }}>
          Or enter employee ID manually
        </Text>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: '#D0D0D0',
            borderRadius: 8,
            paddingHorizontal: 12,
            backgroundColor: '#FFFFFF',
          }}
        >
          <TextInput
            value={manualInput}
            onChangeText={setManualInput}
            placeholder="Payroll ID or Employee ID"
            placeholderTextColor="#A0A0A0"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={onManualSubmit}
            style={{ flex: 1, paddingVertical: 10, fontSize: 15, color: '#111111' }}
          />
          <TouchableOpacity onPress={onManualSubmit} hitSlop={8} activeOpacity={0.6}>
            <MaterialIcons name="search" size={22} color="#000000" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (employeeQuery.isLoading) {
    return (
      <View style={{ padding: 24, alignItems: 'center' }}>
        <ActivityIndicator color="#000000" />
        <Text style={{ color: '#666666', marginTop: 8, fontSize: 12 }}>
          Loading employee {employeeId}…
        </Text>
      </View>
    );
  }

  if (employeeQuery.isError || !employeeQuery.data) {
    return (
      <View style={{ marginTop: 12 }}>
        <View
          style={{
            backgroundColor: '#F5F5F5',
            borderLeftWidth: 4,
            borderLeftColor: '#000000',
            borderRadius: 10,
            padding: 14,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <MaterialIcons name="error-outline" size={22} color="#000000" />
            <Text style={{ color: '#000000', fontWeight: '700', marginLeft: 8, flex: 1 }}>
              Employee {employeeId} not found
            </Text>
          </View>
          {employeeQuery.error instanceof Error ? (
            <Text style={{ color: '#666666', fontSize: 12, marginTop: 6 }}>
              {employeeQuery.error.message}
            </Text>
          ) : null}
        </View>
        <TouchableOpacity
          onPress={reset}
          activeOpacity={0.8}
          style={{
            borderWidth: 1,
            borderColor: '#000000',
            borderRadius: 8,
            paddingVertical: 12,
            minHeight: 48,
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 10,
          }}
        >
          <Text style={{ color: '#000000', fontWeight: '600' }}>Try another</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const emp = employeeQuery.data;

  return (
    <View style={{ marginTop: 12 }}>
      <View
        style={{
          backgroundColor: '#F5F5F5',
          borderLeftWidth: 4,
          borderLeftColor: '#000000',
          borderRadius: 10,
          padding: 14,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <MaterialIcons name="badge" size={22} color="#000000" />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#111111' }}>
              {emp.employee_name}
            </Text>
            <Text style={{ color: '#333333', fontSize: 13 }}>ID: {emp.name}</Text>
            {emp.designation ? (
              <Text style={{ color: '#555555', fontSize: 12, marginTop: 2 }}>
                {emp.designation}
              </Text>
            ) : null}
            {emp.department ? (
              <Text style={{ color: '#555555', fontSize: 12 }}>{emp.department}</Text>
            ) : null}
            {emp.custom_location || emp.custom_farm ? (
              <Text style={{ color: '#555555', fontSize: 12 }}>
                {[emp.custom_location, emp.custom_farm].filter(Boolean).join(' · ')}
              </Text>
            ) : null}
          </View>
        </View>
      </View>

      {todayAttendanceQuery.isLoading ? (
        <View style={{ alignItems: 'center', marginTop: 16 }}>
          <ActivityIndicator color="#000000" />
          <Text style={{ color: '#666666', marginTop: 8, fontSize: 12 }}>
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
              borderRadius: 8,
              paddingHorizontal: 12,
              paddingVertical: 10,
              marginTop: 14,
            }}
          >
            <MaterialIcons name="login" size={16} color="#2E7D32" />
            <Text style={{ color: '#2E7D32', fontSize: 13, fontWeight: '600', marginLeft: 6 }}>
              Checked in at {fmtTime(openAttendance!.in_time)}
            </Text>
          </View>

          {steppedOut ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#FFF3E0',
                borderRadius: 8,
                paddingHorizontal: 12,
                paddingVertical: 10,
                marginTop: 8,
              }}
            >
              <MaterialIcons name="directions-walk" size={16} color="#E65100" />
              <Text style={{ color: '#E65100', fontSize: 13, fontWeight: '600', marginLeft: 6 }}>
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
                backgroundColor: steppedOut ? '#2E7D32' : '#EF6C00',
                opacity: tempExit.isPending ? 0.6 : 1,
                borderRadius: 8,
                paddingVertical: 16,
                minHeight: 52,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
              }}
            >
              <MaterialIcons name={steppedOut ? 'login' : 'directions-walk'} size={18} color="#FFFFFF" />
              <Text style={{ color: '#FFFFFF', fontWeight: '700', marginLeft: 6, letterSpacing: 0.5, fontSize: 13 }}>
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
                backgroundColor: '#B00020',
                opacity: checkOut.isPending ? 0.6 : 1,
                borderRadius: 8,
                paddingVertical: 16,
                minHeight: 52,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
              }}
            >
              <MaterialIcons name="logout" size={18} color="#FFFFFF" />
              <Text style={{ color: '#FFFFFF', fontWeight: '700', marginLeft: 6, letterSpacing: 0.5, fontSize: 13 }}>
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
                  fontSize: 13,
                  color: '#555555',
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
                placeholderTextColor="#A0A0A0"
                autoCapitalize="characters"
                autoCorrect={false}
                editable={!attendance.isPending}
                style={{
                  borderWidth: 1,
                  borderColor: '#D0D0D0',
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  fontSize: 15,
                  color: '#111111',
                  backgroundColor: '#FFFFFF',
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
              backgroundColor: '#000000',
              opacity: attendance.isPending ? 0.6 : 1,
              borderRadius: 8,
              paddingVertical: 16,
              minHeight: 52,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              marginTop: 14,
            }}
          >
            <MaterialIcons name="login" size={18} color="#FFFFFF" />
            <Text style={{ color: '#FFFFFF', fontWeight: '700', marginLeft: 6, letterSpacing: 0.5 }}>
              CHECK IN
            </Text>
          </TouchableOpacity>
        </>
      )}

      <TouchableOpacity
        onPress={reset}
        activeOpacity={0.7}
        disabled={attendance.isPending || checkOut.isPending || tempExit.isPending}
        style={{ alignItems: 'center', paddingVertical: 10, marginTop: 4 }}
      >
        <Text style={{ color: '#666666', fontSize: 13 }}>Cancel · Scan another</Text>
      </TouchableOpacity>
    </View>
  );
}
