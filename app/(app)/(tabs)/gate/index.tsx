import { useEffect, useState } from 'react';
import { View, Text, Platform, Keyboard } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useForm } from 'react-hook-form';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuthStore } from '@/lib/stores/authStore';
import { HeaderSelectors } from '@/components/gate/HeaderSelectors';
import { SearchBar } from '@/components/gate/SearchBar';
import { FoundResultCard } from '@/components/gate/FoundResultCard';
import { NoAppointmentCard } from '@/components/gate/NoAppointmentCard';
import { VisitorForm } from '@/components/gate/VisitorForm';
import { WalkInSection } from '@/components/gate/WalkInSection';
import { ActionButtons } from '@/components/gate/ActionButtons';
import { StaffCheckInPanel } from '@/components/gate/StaffCheckInPanel';
import { ContractorForm, type WalkInContractorData } from '@/components/gate/ContractorForm';
import { VehicleScanAction } from '@/components/gate/VehicleScanAction';
import { VehicleEntryDialog } from '@/components/gate/VehicleEntryDialog';
import { VehicleInsideCard } from '@/components/gate/VehicleInsideCard';
import { Loader } from '@/components/ui/Loader';
import {
  emptyVisitorForm,
  type VisitorFormValues,
} from '@/components/gate/visitorFormValues';
import { useVisitorSearch } from '@/lib/hooks/useVisitorSearch';
import { useContractorSearch } from '@/lib/hooks/useContractorSearch';
import { useAppointmentWorkflowState } from '@/lib/hooks/useAppointmentWorkflowState';
import { useCheckIn } from '@/lib/hooks/useCheckIn';
import { useCheckOut } from '@/lib/hooks/useCheckOut';
import { useCreateWalkIn } from '@/lib/hooks/useCreateWalkIn';
import { createGateTimesheet, submitGateTimesheet } from '@/lib/api/timesheets';
import type { ActiveVehicleEntry } from '@/lib/stores/vehicleStore';
import { useContractorCheckIn } from '@/lib/hooks/useContractorCheckIn';
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
  ContractorVehicle,
  TractorDailyTask,
} from '@/lib/api/types';

// Bump manually with each release.
const APP_VERSION = '1.0.0';
const APP_NAME = 'Upande Security';

export default function GateTab() {
  const userEmail = useAuthStore((s) => s.user?.email ?? '');
  const [selectedType, setSelectedType] = useState<CheckInType>(CheckInType.Visitor);
  const [searchQuery, setSearchQuery] = useState('');

  const [visitorResult, setVisitorResult] =
    useState<VisitorAppointmentSearchResult | null>(null);
  const [showVisitorResult, setShowVisitorResult] = useState(false);
  const [selectedAppointment, setSelectedAppointment] =
    useState<VisitorAppointmentSearchResult | null>(null);
  const [isWalkIn, setIsWalkIn] = useState(false);

  const [contractorResult, setContractorResult] = useState<ContractorSearchResult | null>(null);
  const [contractorWalkInOpen, setContractorWalkInOpen] = useState(false);

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
  const checkOut = useCheckOut();
  const createWalkIn = useCreateWalkIn();
  const [vehicleBusy, setVehicleBusy] = useState(false);
  const contractorCheckIn = useContractorCheckIn();

  const loading =
    visitorSearch.isPending ||
    contractorSearch.isPending ||
    checkIn.isPending ||
    checkOut.isPending ||
    createWalkIn.isPending ||
    contractorCheckIn.isPending ||
    vehicleBusy ||
    loadingTicket;

  function clearForm() {
    setSearchQuery('');
    setVisitorResult(null);
    setShowVisitorResult(false);
    setSelectedAppointment(null);
    setIsWalkIn(false);
    setContractorResult(null);
    setContractorWalkInOpen(false);
    reset(emptyVisitorForm);
    Keyboard.dismiss();
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

  async function onVisitorCheckOut() {
    if (!selectedAppointment?.name) return;
    await checkOut.mutateAsync(selectedAppointment.name);
    workflowQuery.refetch();
  }

  async function onCreateWalkIn() {
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
    await createWalkIn.mutateAsync({
      customer_name: values.customer_name.trim(),
      customer_phone_number: phone,
      customer_email: `${phone}@walkin.gate`,
      custom_meet_with: values.custom_meet_with,
      scheduled_time: toFrappeDateTime(),
      customer_details: values.customer_details,
      custom_mode_of_transport: values.custom_mode_of_transport,
      custom_vehicles_number_plate: values.custom_vehicles_number_plate,
      custom_vehicles_colour: values.custom_vehicles_colour,
      custom_number_of_passengers: values.custom_number_of_passengers,
    });
    clearForm();
  }

  async function onContractorCheckIn(vehicle?: ContractorVehicle) {
    if (!contractorResult) return;
    const payload = {
      contractor_ref: contractorResult.supplier_id,
      contractor_name:
        contractorResult.contractor_name ?? contractorResult.contract_name ?? '',
      phone: contractorResult.contact_phone,
      purpose: 'Approved contractor site access',
      transport_mode: vehicle ? 'Vehicle' : 'On Foot',
      number_plate: vehicle?.number_plate,
      vehicle_color: vehicle?.colour,
    };
    if (__DEV__) {
      console.log('[gate] onContractorCheckIn payload:', payload);
    }
    try {
      await contractorCheckIn.mutateAsync(payload);
      clearForm();
    } catch {
      // feedback handled by mutation onError
    }
  }

  async function onContractorWalkInSave(data: WalkInContractorData) {
    if (!data.contractor_name?.trim()) {
      feedback.warning('Contractor / company name is required');
      return;
    }
    if (!data.phone?.trim()) {
      feedback.warning('Phone number is required');
      return;
    }
    const payload = {
      contractor_name: data.contractor_name.trim(),
      phone: data.phone.trim(),
      company: data.company?.trim() || undefined,
      purpose: data.purpose?.trim() || 'Walk-in contractor visit',
      transport_mode: data.mode_of_transport,
      number_plate: data.number_plate?.trim() || undefined,
      vehicle_color: data.vehicle_colour?.trim() || undefined,
    };
    if (__DEV__) {
      console.log('[gate] onContractorWalkInSave payload:', payload);
    }
    try {
      await contractorCheckIn.mutateAsync(payload);
      clearForm();
    } catch {
      // feedback handled by mutation onError
    }
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
    <View style={{ flex: 1, backgroundColor: '#F5F5F5' }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 12,
          paddingVertical: 8,
          backgroundColor: '#FFFFFF',
          borderBottomWidth: 1,
          borderBottomColor: '#E8E8E8',
          gap: 8,
        }}
      >
        <Text style={{ fontSize: 13, fontWeight: '700', color: '#000000' }}>{APP_NAME}</Text>
        <Text style={{ fontSize: 12, color: '#888888' }}>·</Text>
        <Text style={{ fontSize: 12, color: '#555555', flex: 1 }} numberOfLines={1}>
          {userEmail || '—'}
        </Text>
        <Text style={{ fontSize: 11, color: '#888888' }}>v{APP_VERSION}</Text>
      </View>

      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 12, paddingBottom: 60 }}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid
        extraScrollHeight={Platform.OS === 'ios' ? 20 : 60}
        enableAutomaticScroll
        showsVerticalScrollIndicator={false}
      >
          <View
            style={{
              backgroundColor: 'white',
              borderRadius: 14,
              padding: 12,
              shadowColor: '#000',
              shadowOpacity: 0.06,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 2 },
              elevation: 2,
            }}
          >
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

            {selectedType === CheckInType.Contractor &&
            (contractorResult || contractorWalkInOpen) ? (
              <ContractorForm
                result={contractorResult ?? {}}
                onCheckIn={onContractorCheckIn}
                onRegisterNew={() => setContractorWalkInOpen(true)}
                showWalkInForm={contractorWalkInOpen}
                onCloseWalkIn={() => setContractorWalkInOpen(false)}
                onSaveWalkIn={onContractorWalkInSave}
                savingWalkIn={contractorCheckIn.isPending}
                busy={contractorCheckIn.isPending}
              />
            ) : null}

            {isWalkIn ? (
              <WalkInSection
                onClose={() => {
                  setIsWalkIn(false);
                  reset(emptyVisitorForm);
                }}
                onSave={onCreateWalkIn}
                saving={createWalkIn.isPending}
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

            {selectedAppointment && !isWalkIn ? (
              <View style={{ marginTop: 8 }}>
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
                  onCheckIn={onVisitorCheckIn}
                  onCheckOut={onVisitorCheckOut}
                  busy={checkIn.isPending || checkOut.isPending}
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

          {selectedType === CheckInType.Contractor &&
          !contractorResult &&
          !contractorWalkInOpen &&
          !loading ? (
            <View style={{ padding: 16, alignItems: 'center' }}>
              <MaterialIcons name="search" size={28} color="#BDBDBD" />
              <Text style={{ color: '#888', marginTop: 6, fontSize: 12 }}>
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
    </View>
  );
}
