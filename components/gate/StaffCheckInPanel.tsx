import { fetchEmployee } from '@/lib/api/employees';
import { useFeedback } from '@/lib/hooks/useFeedback';
import { useStaffAttendance } from '@/lib/hooks/useStaffAttendance';
import { useGateStore } from '@/lib/stores/gateStore';
import { extractEmployeeId } from '@/lib/utils/qr';
import { MaterialIcons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';

export function StaffCheckInPanel() {
  const [employeeId, setEmployeeId] = useState<string | null>(null);
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

  function reset() {
    setEmployeeId(null);
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
        numberPlate,
      });
      reset();
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

      <Text style={{ fontSize: 13, color: '#555555', marginTop: 14, marginBottom: 4, fontWeight: '600' }}>
        Number Plate (optional)
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
        }}
      />

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

      <TouchableOpacity
        onPress={reset}
        activeOpacity={0.7}
        disabled={attendance.isPending}
        style={{ alignItems: 'center', paddingVertical: 10, marginTop: 4 }}
      >
        <Text style={{ color: '#666666', fontSize: 13 }}>Cancel · Scan another</Text>
      </TouchableOpacity>
    </View>
  );
}
