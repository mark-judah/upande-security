import { useEffect, useState } from 'react';
import { View, Text, Platform, Keyboard, Pressable, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useForm } from 'react-hook-form';
import { Ionicons } from '@expo/vector-icons';
import * as Updates from 'expo-updates';
import { useAuthStore } from '@/lib/stores/authStore';
import { HeaderSelectors } from '@/components/gate/HeaderSelectors';
import { SearchBar } from '@/components/gate/SearchBar';
import { FoundResultCard } from '@/components/gate/FoundResultCard';
import { NoAppointmentCard } from '@/components/gate/NoAppointmentCard';
import { VisitorForm } from '@/components/gate/VisitorForm';
import { WalkInSection } from '@/components/gate/WalkInSection';
import { ActionButtons } from '@/components/gate/ActionButtons';
import { StaffCheckInPanel } from '@/components/gate/StaffCheckInPanel';
import { ContractorForm } from '@/components/gate/ContractorForm';
import { VehicleScanAction } from '@/components/gate/VehicleScanAction';
import { VehicleEntryDialog } from '@/components/gate/VehicleEntryDialog';
import { VehicleInsideCard } from '@/components/gate/VehicleInsideCard';
import { Loader } from '@/components/ui/Loader';
import { Screen } from '@/src/core/ui/Screen';
import {
  emptyVisitorForm,
  type VisitorFormValues,
} from '@/components/gate/visitorFormValues';
import { useVisitorSearch } from '@/lib/hooks/useVisitorSearch';
import { useContractorSearch } from '@/lib/hooks/useContractorSearch';
import { useAppointmentWorkflowState } from '@/lib/hooks/useAppointmentWorkflowState';
import { useCheckIn } from '@/lib/hooks/useCheckIn';
import { api } from '@/lib/services/api';
import { createGateTimesheet, submitGateTimesheet } from '@/lib/api/timesheets';
import type { ActiveVehicleEntry } from '@/lib/stores/vehicleStore';
import { useFeedback } from '@/lib/hooks/useFeedback';
import { useGateStore } from '@/lib/stores/gateStore';
import { useVehicleStore } from '@/lib/stores/vehicleStore';
import { fetchTractorDailyTask, markTractorTaskRowCompleted } from '@/lib/api/vehicles';
import { extractTicketName } from '@/lib/utils/qr';
import { toFrappeDateTime } from '@/lib/utils/date';
import { CheckInType } from '@/constants/checkInTypes';
import type {
  VisitorAppointmentSearchResult,
  ContractorSearchResult,
  TractorDailyTask,
} from '@/lib/api/types';
import { COLORS, fontFamily, fontSize, spacing, borderRadius } from '@/src/core/theme';

// Bump manually with each release.
const APP_VERSION = '1.0.0';
const APP_NAME = 'Upande Security';

export default function GateTab() {
  const userEmail = useAuthStore((s) => s.user?.email ?? '');
  const [updateBusy, setUpdateBusy] = useState(false);
  const [selectedType, setSelectedType] = useState<CheckInType>(CheckInType.Visitor);
  const [searchQuery, setSearchQuery] = useState('');

  const [visitorResult, setVisitorResult] =
    useState<VisitorAppointmentSearchResult | null>(null);
  const [showVisitorResult, setShowVisitorResult] = useState(false);
  const [selectedAppointment, setSelectedAppointment] =
    useState<VisitorAppointmentSearchResult | null>(null);
  const [isWalkIn, setIsWalkIn] = useState(false);

  const [contractorResult, setContractorResult] = useState<ContractorSearchResult | null>(null);

  const [loadingTicket, setLoadingTicket] = useState(false);
  const [entryDialog, setEntryDialog] = useState<{
    ticket: TractorDailyTask;
    visible: boolean;
  } | null>(null);

  const feedback = useFeedback();

  const pendingScanned = useGateStore((s) => s.pendingScannedTicket);
  const setPendingScanned = useGateStore((s) => s.setPendingScannedTicket);

  const vehicleStore = useVehicleStore();

  const form = useForm<VisitorFormValues>({ defaultValues: emptyVisitorForm });
  const {
    control,
    formState: { errors },
    setValue,
    watch,
    reset,
    getValues,
  } = form;
  const watchTransport = watch('custom_mode_of_transport');
  const watchHostId = watch('custom_meet_with');
  const watchHostName = watch('host_name');

  const visitorSearch = useVisitorSearch();
  const contractorSearch = useContractorSearch();
  const workflowQuery = useAppointmentWorkflowState(selectedAppointment?.name ?? null);
  const checkIn = useCheckIn();
  const [vehicleBusy, setVehicleBusy] = useState(false);

  const loading =
    visitorSearch.isPending ||
    contractorSearch.isPending ||
    checkIn.isPending ||
    vehicleBusy ||
    loadingTicket;

  function clearForm() {
    setSearchQuery('');
    setVisitorResult(null);
    setShowVisitorResult(false);
    setSelectedAppointment(null);
    setIsWalkIn(false);
    setContractorResult(null);
    reset(emptyVisitorForm);
    Keyboard.dismiss();
  }

  async function onCheckForUpdates() {
    if (updateBusy) return;
    if (!Updates.isEnabled) {
      feedback.warning('OTA disabled in dev — Updates only run in builds installed from EAS.');
      return;
    }
    setUpdateBusy(true);
    try {
      const result = await Updates.checkForUpdateAsync();
      if (!result.isAvailable) {
        feedback.success('Already up to date');
        return;
      }
      feedback.warning('Downloading update…');
      await Updates.fetchUpdateAsync();
      Alert.alert(
        'Update ready',
        'A new version has been downloaded. Reload the app now to apply it?',
        [
          { text: 'Later', style: 'cancel' },
          { text: 'Reload', style: 'destructive', onPress: () => Updates.reloadAsync() },
        ],
      );
    } catch (e) {
      feedback.error('Update check failed — ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setUpdateBusy(false);
    }
  }

  function onTypeSelect(t: CheckInType) {
    setSelectedType(t);
    clearForm();
  }

  async function onManualSearch() {
    const q = searchQuery.trim();
    if (!q) {
      feedback.warning('Please enter a search query');
      return;
    }
    setVisitorResult(null);
    setShowVisitorResult(false);
    setSelectedAppointment(null);
    setContractorResult(null);

    try {
      if (selectedType === CheckInType.Visitor) {
        const result = await visitorSearch.mutateAsync(q);
        setVisitorResult(result);
        setShowVisitorResult(true);
      } else if (selectedType === CheckInType.Contractor) {
        const result = await contractorSearch.mutateAsync(q);
        setContractorResult(result);
      }
    } catch (e) {
      feedback.error(e instanceof Error ? e.message : 'Search failed');
    }
  }

  function onProceed(result: VisitorAppointmentSearchResult) {
    setSelectedAppointment(result);
    setIsWalkIn(false);
    reset({
      customer_name: result.visitor_name ?? '',
      id_ref: result.id_no ?? '',
      customer_phone_number: result.phone_number ?? '',
      custom_mode_of_transport: result.transport_mode ?? 'On Foot',
      custom_vehicles_number_plate: result.vehicle_reg_no ?? '',
      custom_vehicles_colour: result.vehicle_color ?? '',
      custom_number_of_passengers: undefined,
      custom_meet_with: '',
      host_name: result.host_name ?? '',
      customer_details: result.purpose ?? '',
    });
  }

  function onRegisterAsWalkIn() {
    setIsWalkIn(true);
    setSelectedAppointment(null);
    setShowVisitorResult(false);
    reset({ ...emptyVisitorForm, customer_name: searchQuery.trim() });
  }

  async function onNotifyHost() {
    if (!selectedAppointment?.name) return;
    setVehicleBusy(true);
    try {
      await api.notifyHost(selectedAppointment.name);
      feedback.success('Host notified — waiting for approval');
      workflowQuery.refetch();
    } catch (e) {
      feedback.error(e instanceof Error ? e.message : 'Failed to notify host');
    } finally {
      setVehicleBusy(false);
    }
  }

  async function onVisitorCheckIn() {
    if (!selectedAppointment?.name) return;
    const values = getValues();
    await checkIn.mutateAsync({
      name: selectedAppointment.name,
      custom_mode_of_transport: values.custom_mode_of_transport,
      custom_vehicles_number_plate: values.custom_vehicles_number_plate,
      custom_vehicles_colour: values.custom_vehicles_colour,
    });
    workflowQuery.refetch();
  }

  async function onNotifyWalkIn() {
    const values = getValues();
    if (!values.customer_name?.trim()) {
      feedback.warning('Full name is required');
      return;
    }
    if (!values.customer_phone_number?.trim()) {
      feedback.warning('Phone is required');
      return;
    }
    if (!values.custom_meet_with) {
      feedback.warning('Please select a host');
      return;
    }
    const phone = values.customer_phone_number.trim();
    setVehicleBusy(true);
    try {
      const result = await api.createWalkInAndNotify({
        customer_name: values.customer_name.trim(),
        phone,
        host: values.custom_meet_with,
        purpose: values.customer_details,
        transport: values.custom_mode_of_transport,
        plate: values.custom_vehicles_number_plate,
        colour: values.custom_vehicles_colour,
        passengers: values.custom_number_of_passengers,
        scheduled_time: toFrappeDateTime(),
      });
      // Collapse the walk-in form and let ActionButtons handle the rest via polling
      setSelectedAppointment({
        has_appointment: true,
        name: result.name,
        visitor_name: values.customer_name.trim(),
        phone_number: phone,
        host_name: watchHostName || '',
        purpose: values.customer_details || '',
      });
      setIsWalkIn(false);
      feedback.success('Host notified — waiting for approval');
    } catch (e) {
      feedback.error(e instanceof Error ? e.message : 'Failed to notify host');
    } finally {
      setVehicleBusy(false);
    }
  }

  async function onContractorNotify(input: {
    host: string;
    plate?: string;
    passengers?: number;
  }) {
    if (!contractorResult) return;
    setVehicleBusy(true);
    try {
      const result = await api.createContractorNotify({
        contractor_ref: contractorResult.contract_name ?? undefined,
        contractor_name: contractorResult.contractor_name ?? undefined,
        host: input.host,
        plate: input.plate,
        passengers: input.passengers,
      });
      // Collapse the contractor form and hand off to the shared ActionButtons,
      // which polls the workflow and surfaces CHECK IN once the host approves.
      setSelectedAppointment({
        has_appointment: true,
        name: result.name,
        visitor_name: contractorResult.contractor_name ?? '',
        host_name: result.host_id,
      } as VisitorAppointmentSearchResult);
      setContractorResult(null);
      feedback.success('Host notified — waiting for approval');
    } catch (e) {
      feedback.error(e instanceof Error ? e.message : 'Failed to notify host');
    } finally {
      setVehicleBusy(false);
    }
  }

  async function onContractorCheckIn() {
    if (!selectedAppointment?.name) return;
    // Plate / transport were stored at notify time — send only the name so the
    // server preserves them rather than overwriting with blanks.
    await checkIn.mutateAsync({ name: selectedAppointment.name });
    workflowQuery.refetch();
  }

  async function onWorkTicketScanned(raw: string) {
    const name = extractTicketName(raw);
    if (!name) return;
    setLoadingTicket(true);
    try {
      const ticket = await fetchTractorDailyTask(name);
      setEntryDialog({ ticket, visible: true });
    } catch (e) {
      feedback.error(e instanceof Error ? e.message : 'Ticket lookup failed');
    } finally {
      setLoadingTicket(false);
    }
  }

  async function onConfirmVehicleEntry() {
    if (!entryDialog?.ticket) return;
    const ticket = entryDialog.ticket;
    if (vehicleStore.entries.some((e) => e.ticketName === ticket.name)) {
      feedback.warning('This ticket is already checked in');
      setEntryDialog(null);
      return;
    }
    const now = toFrappeDateTime();
    setVehicleBusy(true);
    try {
      const timesheet = await createGateTimesheet({ ticket, entryTime: now });
      const firstTask = ticket.task?.[0];
      vehicleStore.addEntry({
        ticketName: ticket.name,
        ticketData: ticket,
        timesheetName: timesheet.name,
        entryTime: now,
        taskRowName: firstTask?.name,
        description: firstTask?.description,
      });
      setEntryDialog(null);
      feedback.success(`Timesheet ${timesheet.name} created`);
    } catch (e) {
      feedback.error(e instanceof Error ? e.message : 'Entry failed');
    } finally {
      setVehicleBusy(false);
    }
  }

  async function onVehicleCheckOut(entry: ActiveVehicleEntry, completionNote: string) {
    if (!completionNote) {
      feedback.warning('Completion note required');
      return;
    }
    setVehicleBusy(true);
    try {
      await submitGateTimesheet({
        name: entry.timesheetName,
        exitTime: toFrappeDateTime(),
        completionNote,
      });
      try {
        await markTractorTaskRowCompleted(entry.ticketName, entry.taskRowName);
      } catch (e) {
        if (__DEV__) console.warn('[markTractorTaskRowCompleted]', e);
        feedback.warning(
          `Timesheet submitted but ticket task could not be marked completed: ${
            e instanceof Error ? e.message : 'unknown error'
          }`,
        );
      }
      vehicleStore.removeEntry(entry.ticketName);
      feedback.success(`Timesheet ${entry.timesheetName} submitted`);
    } catch (e) {
      feedback.error(e instanceof Error ? e.message : 'Exit failed');
    } finally {
      setVehicleBusy(false);
    }
  }

  useEffect(() => {
    if (pendingScanned) {
      const ticket = pendingScanned;
      setPendingScanned(null);
      setSelectedType(CheckInType.CompanyVehicle);
      onWorkTicketScanned(ticket);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingScanned]);

  return (
    <Screen title="Gate" scroll={false} contentPadded={false}>
      <KeyboardAwareScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid
        extraScrollHeight={Platform.OS === 'ios' ? 20 : 60}
        enableAutomaticScroll
        showsVerticalScrollIndicator={false}
      >
        <View style={s.card}>
          <HeaderSelectors selected={selectedType} onSelect={onTypeSelect} />

          {selectedType === CheckInType.Visitor ||
          selectedType === CheckInType.Contractor ? (
            <SearchBar
              value={searchQuery}
              placeholder={`Search ${selectedType.toUpperCase()} (ID/Name)`}
              onChangeText={setSearchQuery}
              onSubmit={onManualSearch}
              disabled={loading}
            />
          ) : null}

          {selectedType === CheckInType.Visitor && showVisitorResult && visitorResult ? (
            visitorResult.has_appointment ? (
              <FoundResultCard
                result={visitorResult}
                onProceed={() => onProceed(visitorResult)}
                onRegisterAsWalkIn={onRegisterAsWalkIn}
              />
            ) : (
              <NoAppointmentCard onRegisterAsWalkIn={onRegisterAsWalkIn} />
            )
          ) : null}

          {selectedType === CheckInType.Staff ? <StaffCheckInPanel /> : null}

          {selectedType === CheckInType.Contractor && contractorResult ? (
            <ContractorForm
              result={contractorResult}
              onNotify={onContractorNotify}
              busy={vehicleBusy}
            />
          ) : null}

          {selectedType === CheckInType.Contractor && selectedAppointment ? (
            <View style={s.appointmentSection}>
              <ActionButtons
                appointment={workflowQuery.data}
                loading={workflowQuery.isLoading}
                onNotifyHost={() => {}}
                onCheckIn={onContractorCheckIn}
                busy={checkIn.isPending || vehicleBusy}
              />
            </View>
          ) : null}

          {isWalkIn ? (
            <WalkInSection
              onClose={() => {
                setIsWalkIn(false);
                reset(emptyVisitorForm);
              }}
              onSave={onNotifyWalkIn}
              saving={vehicleBusy}
            >
              <VisitorForm
                control={control}
                errors={errors}
                setValue={(f, v) => setValue(f, v as never)}
                watchTransport={watchTransport}
                watchHostId={watchHostId}
                watchHostName={watchHostName}
              />
            </WalkInSection>
          ) : null}

          {selectedType === CheckInType.Visitor && selectedAppointment && !isWalkIn ? (
            <View style={s.appointmentSection}>
              <VisitorForm
                control={control}
                errors={errors}
                setValue={(f, v) => setValue(f, v as never)}
                watchTransport={watchTransport}
                watchHostId={watchHostId}
                watchHostName={watchHostName}
              />
              <ActionButtons
                appointment={workflowQuery.data}
                loading={workflowQuery.isLoading}
                onNotifyHost={onNotifyHost}
                onCheckIn={onVisitorCheckIn}
                busy={checkIn.isPending || vehicleBusy}
              />
            </View>
          ) : null}

          {selectedType === CheckInType.CompanyVehicle ? (
            <>
              <VehicleScanAction
                onPickTicket={onWorkTicketScanned}
                disabled={loading}
              />
              {vehicleStore.entries.map((entry) => (
                <VehicleInsideCard
                  key={entry.ticketName}
                  entry={entry}
                  onCheckOut={onVehicleCheckOut}
                  busy={vehicleBusy}
                />
              ))}
            </>
          ) : null}
        </View>

        {selectedType === CheckInType.Contractor && !contractorResult && !loading ? (
          <View style={s.contractorHint}>
            <Ionicons name="search-outline" size={28} color={COLORS.border} />
            <Text style={s.contractorHintText}>
              Search for contractor by contract name or ID
            </Text>
          </View>
        ) : null}
      </KeyboardAwareScrollView>

      <VehicleEntryDialog
        visible={entryDialog?.visible ?? false}
        ticket={entryDialog?.ticket ?? null}
        onCancel={() => setEntryDialog(null)}
        onConfirm={onConfirmVehicleEntry}
        busy={vehicleBusy}
      />

      {loading ? <Loader /> : null}
    </Screen>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bgMuted },
  infoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: COLORS.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
    gap: spacing.sm - 4,
  },
  infoAppName: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.bold,
    color: COLORS.text,
  },
  infoDot: { fontSize: fontSize.sm, color: COLORS.textMuted },
  infoEmail: {
    fontSize: fontSize.xs + 1,
    color: COLORS.textSecondary,
    fontFamily: fontFamily.regular,
    flex: 1,
  },
  versionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: 2,
    paddingHorizontal: spacing.sm - 2,
    borderRadius: borderRadius.sm,
    backgroundColor: COLORS.bgMuted,
  },
  versionChipDisabled: { opacity: 0.6 },
  versionText: {
    fontSize: fontSize.xs,
    color: COLORS.textMuted,
    fontFamily: fontFamily.semiBold,
  },
  scroll: { flex: 1 },
  content: { padding: spacing.md, paddingBottom: 60 },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
  appointmentSection: { marginTop: spacing.sm },
  contractorHint: { padding: spacing.lg, alignItems: 'center' },
  contractorHintText: {
    color: COLORS.textMuted,
    fontFamily: fontFamily.regular,
    marginTop: spacing.sm - 2,
    fontSize: fontSize.xs + 1,
  },
});
