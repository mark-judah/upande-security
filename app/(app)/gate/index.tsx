import { useEffect, useState } from 'react';
import { View, Text, Platform, Keyboard } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useForm } from 'react-hook-form';
import { MaterialIcons } from '@expo/vector-icons';
import { HeaderSelectors } from '@/components/gate/HeaderSelectors';
import { SearchBar } from '@/components/gate/SearchBar';
import { FoundResultCard } from '@/components/gate/FoundResultCard';
import { NoAppointmentCard } from '@/components/gate/NoAppointmentCard';
import { VisitorForm } from '@/components/gate/VisitorForm';
import { WalkInSection } from '@/components/gate/WalkInSection';
import { ActionButtons } from '@/components/gate/ActionButtons';
import { StaffForm } from '@/components/gate/StaffForm';
import { ContractorForm } from '@/components/gate/ContractorForm';
import { VehicleScanAction } from '@/components/gate/VehicleScanAction';
import { VehicleEntryDialog } from '@/components/gate/VehicleEntryDialog';
import { VehicleInsideCard } from '@/components/gate/VehicleInsideCard';
import { Loader } from '@/components/ui/Loader';
import {
  emptyVisitorForm,
  type VisitorFormValues,
} from '@/components/gate/visitorFormValues';
import { useVisitorSearch } from '@/lib/hooks/useVisitorSearch';
import { useStaffSearch } from '@/lib/hooks/useStaffSearch';
import { useContractorSearch } from '@/lib/hooks/useContractorSearch';
import { useAppointmentWorkflowState } from '@/lib/hooks/useAppointmentWorkflowState';
import { useCheckIn } from '@/lib/hooks/useCheckIn';
import { useCheckOut } from '@/lib/hooks/useCheckOut';
import { useCreateWalkIn } from '@/lib/hooks/useCreateWalkIn';
import { useVehicleEntry } from '@/lib/hooks/useVehicleEntry';
import { useVehicleExit } from '@/lib/hooks/useVehicleExit';
import { useFeedback } from '@/lib/hooks/useFeedback';
import { useGateStore } from '@/lib/stores/gateStore';
import { useVehicleStore } from '@/lib/stores/vehicleStore';
import { fetchTractorDailyTask } from '@/lib/api/vehicles';
import { extractTicketName } from '@/lib/utils/qr';
import { toFrappeDateTime } from '@/lib/utils/date';
import { CheckInType } from '@/constants/checkInTypes';
import type {
  VisitorAppointmentSearchResult,
  StaffSearchResult,
  ContractorSearchResult,
  TractorDailyTask,
} from '@/lib/api/types';

export default function GateTab() {
  const [selectedType, setSelectedType] = useState<CheckInType>(CheckInType.Visitor);
  const [searchQuery, setSearchQuery] = useState('');

  const [visitorResult, setVisitorResult] =
    useState<VisitorAppointmentSearchResult | null>(null);
  const [showVisitorResult, setShowVisitorResult] = useState(false);
  const [selectedAppointment, setSelectedAppointment] =
    useState<VisitorAppointmentSearchResult | null>(null);
  const [isWalkIn, setIsWalkIn] = useState(false);

  const [staffResult, setStaffResult] = useState<StaffSearchResult | null>(null);
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
  const staffSearch = useStaffSearch();
  const contractorSearch = useContractorSearch();
  const workflowQuery = useAppointmentWorkflowState(selectedAppointment?.name ?? null);
  const checkIn = useCheckIn();
  const checkOut = useCheckOut();
  const createWalkIn = useCreateWalkIn();
  const vehicleEntry = useVehicleEntry();
  const vehicleExit = useVehicleExit();

  const loading =
    visitorSearch.isPending ||
    staffSearch.isPending ||
    contractorSearch.isPending ||
    checkIn.isPending ||
    checkOut.isPending ||
    createWalkIn.isPending ||
    vehicleEntry.isPending ||
    vehicleExit.isPending ||
    loadingTicket;

  function clearForm() {
    setSearchQuery('');
    setVisitorResult(null);
    setShowVisitorResult(false);
    setSelectedAppointment(null);
    setIsWalkIn(false);
    setStaffResult(null);
    setContractorResult(null);
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
    setStaffResult(null);
    setContractorResult(null);

    try {
      if (selectedType === CheckInType.Visitor) {
        const result = await visitorSearch.mutateAsync(q);
        setVisitorResult(result);
        setShowVisitorResult(true);
      } else if (selectedType === CheckInType.Staff) {
        const result = await staffSearch.mutateAsync(q);
        setStaffResult(result);
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

  async function onStaffCheckIn() {
    if (!staffResult) return;
    const id = staffResult.employee_id ?? '';
    await createWalkIn.mutateAsync({
      customer_name: staffResult.full_name ?? id,
      customer_phone_number: id,
      customer_email: `${id}@staff.gate`,
      custom_meet_with: id,
      scheduled_time: toFrappeDateTime(),
      customer_details: 'Staff attendance',
      custom_mode_of_transport: 'On Foot',
    });
    clearForm();
  }

  async function onContractorCheckIn() {
    if (!contractorResult) return;
    const contract = contractorResult.contract_name ?? '';
    await createWalkIn.mutateAsync({
      customer_name: contractorResult.contractor_name ?? contract,
      customer_phone_number: contract,
      customer_email: `${contract}@contractor.gate`,
      custom_meet_with: contract,
      scheduled_time: toFrappeDateTime(),
      customer_details: `Contract: ${contract}`,
      custom_mode_of_transport: 'On Foot',
    });
    clearForm();
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
    const now = toFrappeDateTime();
    try {
      await vehicleEntry.mutateAsync({
        name: ticket.name,
        entryTime: now,
        farm: ticket.farm,
      });
      vehicleStore.setVehicleInside({
        ticketName: ticket.name,
        ticketData: ticket,
        gateEntryTime: now,
      });
      setEntryDialog(null);
    } catch {
      // feedback handled by mutation onError
    }
  }

  async function onVehicleCheckOut(completionNote: string) {
    if (!vehicleStore.ticketName) return;
    if (!completionNote) {
      feedback.warning('Completion note required');
      return;
    }
    try {
      await vehicleExit.mutateAsync({
        name: vehicleStore.ticketName,
        exitTime: toFrappeDateTime(),
        completionNote,
      });
      vehicleStore.clearVehicle();
    } catch {
      // handled
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

            {selectedType !== CheckInType.CompanyVehicle ? (
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

            {selectedType === CheckInType.Staff && staffResult ? (
              <StaffForm
                result={staffResult}
                onCheckIn={onStaffCheckIn}
                busy={createWalkIn.isPending}
              />
            ) : null}

            {selectedType === CheckInType.Contractor && contractorResult ? (
              <ContractorForm
                result={contractorResult}
                onCheckIn={onContractorCheckIn}
                busy={createWalkIn.isPending}
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
              vehicleStore.vehicleInside &&
              vehicleStore.ticketData &&
              vehicleStore.gateEntryTime ? (
                <VehicleInsideCard
                  ticket={vehicleStore.ticketData}
                  entryTime={new Date(vehicleStore.gateEntryTime)}
                  onCheckOut={onVehicleCheckOut}
                  busy={vehicleExit.isPending}
                />
              ) : (
                <VehicleScanAction
                  onPickTicket={onWorkTicketScanned}
                  disabled={loading}
                />
              )
            ) : null}
          </View>

          {selectedType === CheckInType.Staff && !staffResult && !loading ? (
            <View style={{ padding: 16, alignItems: 'center' }}>
              <MaterialIcons name="search" size={28} color="#BDBDBD" />
              <Text style={{ color: '#888', marginTop: 6, fontSize: 12 }}>
                Search for staff by ID or name
              </Text>
            </View>
          ) : null}

          {selectedType === CheckInType.Contractor && !contractorResult && !loading ? (
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
        busy={vehicleEntry.isPending}
      />

      {loading ? <Loader /> : null}
    </View>
  );
}
