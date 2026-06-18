import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StyleSheet,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import type { ContractorSearchResult, ContractorVehicle } from '@/lib/api/types';

// ─── Sub-components ─────────────────────────────────────────────────────────

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  label: string;
  value?: string | null;
}) {
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <MaterialIcons name={icon} size={14} color="#666666" style={{ marginRight: 4 }} />
      <Text style={styles.infoLabel}>{label}: </Text>
      <Text style={styles.infoValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function VehiclePill({
  vehicle,
  selected,
  onSelect,
}: {
  vehicle: ContractorVehicle;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onSelect}
      activeOpacity={0.7}
      style={[styles.vehiclePill, selected && styles.vehiclePillSelected]}
    >
      <MaterialIcons
        name="directions-car"
        size={14}
        color={selected ? '#FFFFFF' : '#666666'}
      />
      <Text
        style={[styles.vehiclePillText, { color: selected ? '#FFFFFF' : '#333333' }]}
        numberOfLines={1}
      >
        {vehicle.number_plate}
      </Text>
      {vehicle.colour ? (
        <Text
          style={[
            styles.vehiclePillSub,
            { color: selected ? 'rgba(255,255,255,0.7)' : '#888888' },
          ]}
          numberOfLines={1}
        >
          · {vehicle.colour}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

function FieldInput({
  label,
  ...props
}: { label: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={{ marginBottom: 8 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        {...props}
        style={[
          styles.textInput,
          props.multiline && { paddingTop: 8 },
          props.style as object,
        ]}
        placeholderTextColor="#AAAAAA"
      />
    </View>
  );
}

// ─── "No result" card ────────────────────────────────────────────────────────

function NotFoundCard({ onRegisterNew }: { onRegisterNew: () => void }) {
  return (
    <View style={[styles.card, { borderLeftColor: '#555555' }]}>
      <View style={styles.cardHeader}>
        <MaterialIcons name="info-outline" size={22} color="#555555" />
        <Text style={[styles.cardTitle, { marginLeft: 8 }]}>NO CONTRACTOR FOUND</Text>
      </View>
      <Text style={[styles.cardSubtext, { marginTop: 6 }]}>
        No approved contractor matches your search. Register a new visit below.
      </Text>
      <TouchableOpacity
        onPress={onRegisterNew}
        activeOpacity={0.8}
        style={[styles.actionBtn, { marginTop: 12 }]}
      >
        <MaterialIcons name="person-add" size={18} color="#FFFFFF" />
        <Text style={styles.actionBtnText}>BOOK NEW CONTRACTOR VISIT</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Walk-in booking form ────────────────────────────────────────────────────

export type WalkInContractorData = {
  contractor_name: string;
  phone: string;
  company: string;
  purpose: string;
  number_plate: string;
  vehicle_colour: string;
  mode_of_transport: 'On Foot' | 'Vehicle' | 'Motor Bike';
  number_of_passengers?: number;
};

function WalkInBookingForm({
  onClose,
  onSave,
  saving,
}: {
  onClose: () => void;
  onSave: (data: WalkInContractorData) => void;
  saving?: boolean;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [purpose, setPurpose] = useState('');
  const [mode, setMode] = useState<'On Foot' | 'Vehicle' | 'Motor Bike'>('On Foot');
  const [plate, setPlate] = useState('');
  const [colour, setColour] = useState('');
  const [passengers, setPassengers] = useState('');

  const showVehicle = mode !== 'On Foot';

  return (
    <View style={[styles.card, { borderLeftColor: '#000000' }]}>
      {/* Header */}
      <View style={styles.sectionHeaderRow}>
        <MaterialIcons name="engineering" size={20} color="#111111" />
        <Text style={[styles.sectionTitle, { marginLeft: 6 }]}>New Contractor Visit</Text>
        <TouchableOpacity onPress={onClose} style={{ marginLeft: 'auto' }}>
          <MaterialIcons name="close" size={20} color="#666666" />
        </TouchableOpacity>
      </View>
      <View style={styles.divider} />

      <FieldInput
        label="Contractor / Company Name *"
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
      />
      <FieldInput
        label="Phone Number *"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
      />
      <FieldInput
        label="Company (optional)"
        value={company}
        onChangeText={setCompany}
        autoCapitalize="words"
      />
      <FieldInput
        label="Purpose of Visit *"
        value={purpose}
        onChangeText={setPurpose}
        multiline
        numberOfLines={2}
        style={{ minHeight: 52, textAlignVertical: 'top' }}
      />

      <Text style={styles.fieldLabel}>Mode of Transport</Text>
      <View style={styles.modeRow}>
        {(['On Foot', 'Vehicle', 'Motor Bike'] as const).map((m) => (
          <TouchableOpacity
            key={m}
            onPress={() => setMode(m)}
            style={[styles.modeChip, mode === m && styles.modeChipSelected]}
          >
            <Text
              style={[styles.modeChipText, mode === m && { color: '#FFFFFF' }]}
            >
              {m}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {showVehicle ? (
        <>
          <FieldInput
            label="Number Plate"
            value={plate}
            onChangeText={setPlate}
            autoCapitalize="characters"
          />
          <FieldInput label="Vehicle Colour" value={colour} onChangeText={setColour} />
          <FieldInput
            label="No. of Passengers (excl. driver)"
            value={passengers}
            onChangeText={(v) => setPassengers(v.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
          />
        </>
      ) : null}

      <TouchableOpacity
        onPress={() =>
          onSave({
            contractor_name: name,
            phone,
            company,
            purpose,
            number_plate: plate,
            vehicle_colour: colour,
            mode_of_transport: mode,
            number_of_passengers: passengers ? parseInt(passengers, 10) : undefined,
          })
        }
        disabled={saving}
        activeOpacity={0.8}
        style={[styles.actionBtn, { opacity: saving ? 0.6 : 1, marginTop: 8 }]}
      >
        <MaterialIcons name="save" size={18} color="#FFFFFF" />
        <Text style={styles.actionBtnText}>{saving ? 'SAVING…' : 'SAVE & CHECK IN'}</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Approved contractor card ────────────────────────────────────────────────

function ApprovedContractorCard({
  result,
  onCheckIn,
  onRegisterNew,
  onAddVehicle,
  busy,
}: {
  result: ContractorSearchResult;
  onCheckIn: (vehicle?: ContractorVehicle, passengers?: number) => void;
  onRegisterNew: () => void;
  onAddVehicle?: (vehicle: ContractorVehicle) => Promise<'added' | 'duplicate'>;
  busy?: boolean;
}) {
  const [selectedVehicle, setSelectedVehicle] = useState<ContractorVehicle | null>(null);
  const [passengers, setPassengers] = useState('');
  const [checkInCount, setCheckInCount] = useState(0);
  const [lastPlate, setLastPlate] = useState<string | null>(null);

  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [newPlate, setNewPlate] = useState('');
  const [newColour, setNewColour] = useState('');
  const [newVehicleType, setNewVehicleType] = useState('');
  const [savingVehicle, setSavingVehicle] = useState(false);
  const [addVehicleMsg, setAddVehicleMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [localVehicles, setLocalVehicles] = useState<ContractorVehicle[]>(result.vehicles ?? []);

  const vehicles = localVehicles;

  function handleCheckIn() {
    setLastPlate(selectedVehicle?.number_plate ?? null);
    const pax = passengers ? parseInt(passengers, 10) : undefined;
    onCheckIn(selectedVehicle ?? undefined, pax);
    setSelectedVehicle(null);
    setPassengers('');
    setCheckInCount((n) => n + 1);
  }

  async function handleSaveNewVehicle() {
    const plate = newPlate.trim().toUpperCase();
    if (!plate) return;

    // Client-side duplicate check
    if (localVehicles.some((v) => v.number_plate.toUpperCase() === plate)) {
      setAddVehicleMsg({ text: 'Already registered', ok: false });
      return;
    }

    const vehicle: ContractorVehicle = {
      number_plate: plate,
      colour: newColour.trim() || undefined,
      vehicle_type: newVehicleType.trim() || undefined,
    };

    if (onAddVehicle) {
      setSavingVehicle(true);
      setAddVehicleMsg(null);
      const result = await onAddVehicle(vehicle);
      setSavingVehicle(false);
      if (result === 'duplicate') {
        setAddVehicleMsg({ text: 'Already registered on supplier', ok: false });
      } else {
        setLocalVehicles((prev) => [...prev, vehicle]);
        setSelectedVehicle(vehicle);
        setAddVehicleMsg({ text: 'Vehicle saved ✓', ok: true });
        setNewPlate('');
        setNewColour('');
        setNewVehicleType('');
        setShowAddVehicle(false);
      }
    } else {
      // No supplier ID available — just use locally for this session
      setLocalVehicles((prev) => [...prev, vehicle]);
      setSelectedVehicle(vehicle);
      setShowAddVehicle(false);
    }
  }

  return (
    <View>
      <View style={[styles.card, { borderLeftColor: '#FB8C00' }]}>
        {/* Header */}
        <View style={styles.cardHeader}>
          <MaterialIcons name="verified" size={22} color="#FB8C00" />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.cardTitle}>{result.contractor_name ?? '—'}</Text>
            {result.supplier_group ? (
              <Text style={styles.cardSubtext}>{result.supplier_group}</Text>
            ) : null}
          </View>
          <View style={[styles.approvedBadge, { backgroundColor: '#FB8C00' }]}>
            <MaterialIcons name="engineering" size={12} color="#FFFFFF" />
            <Text style={styles.approvedBadgeText}>CONTRACTOR</Text>
          </View>
        </View>

        {/* Info rows */}
        <View style={{ marginTop: 8 }}>
          <InfoRow icon="business" label="ID" value={result.supplier_id} />
          <InfoRow icon="category" label="Group" value={result.supplier_group} />
          {result.access_end ? (
            <InfoRow icon="event-available" label="Access until" value={result.access_end} />
          ) : null}
        </View>

        {/* Last check-in confirmation flash */}
        {checkInCount > 0 ? (
          <View style={{
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: '#E8F5E9', borderRadius: 6,
            paddingHorizontal: 10, paddingVertical: 7, marginTop: 10,
          }}>
            <MaterialIcons name="check-circle" size={16} color="#2E7D32" />
            <Text style={{ color: '#2E7D32', fontSize: 12, fontWeight: '700', marginLeft: 6 }}>
              {checkInCount} person{checkInCount > 1 ? 's' : ''} checked in
              {lastPlate ? ` · Last: ${lastPlate}` : ''}
            </Text>
          </View>
        ) : null}

        {/* Registered vehicles */}
        <View style={{ marginTop: 10 }}>
          {vehicles.length > 0 ? (
            <>
              <Text style={styles.subSectionLabel}>Select vehicle (optional)</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginTop: 4 }}
              >
                {vehicles.map((v) => (
                  <VehiclePill
                    key={v.number_plate}
                    vehicle={v}
                    selected={selectedVehicle?.number_plate === v.number_plate}
                    onSelect={() =>
                      setSelectedVehicle(
                        selectedVehicle?.number_plate === v.number_plate ? null : v,
                      )
                    }
                  />
                ))}
              </ScrollView>
            </>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialIcons name="no-transfer" size={14} color="#888888" />
              <Text style={{ fontSize: 12, color: '#888888', marginLeft: 4, fontStyle: 'italic' }}>
                No vehicles registered yet
              </Text>
            </View>
          )}

          {/* Add new vehicle toggle */}
          {!showAddVehicle ? (
            <TouchableOpacity
              onPress={() => { setShowAddVehicle(true); setAddVehicleMsg(null); }}
              style={styles.addVehicleLink}
              activeOpacity={0.7}
            >
              <MaterialIcons name="add-circle-outline" size={15} color="#FB8C00" />
              <Text style={styles.addVehicleLinkText}>Add new vehicle</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.addVehicleBox}>
              <View style={styles.addVehicleHeader}>
                <MaterialIcons name="directions-car" size={15} color="#FB8C00" />
                <Text style={styles.addVehicleTitle}>New Vehicle</Text>
                <TouchableOpacity
                  onPress={() => { setShowAddVehicle(false); setAddVehicleMsg(null); }}
                  style={{ marginLeft: 'auto' }}
                >
                  <MaterialIcons name="close" size={16} color="#999999" />
                </TouchableOpacity>
              </View>
              <FieldInput
                label="Number Plate *"
                value={newPlate}
                onChangeText={setNewPlate}
                autoCapitalize="characters"
                placeholder="e.g. KDA 123A"
              />
              <FieldInput
                label="Colour"
                value={newColour}
                onChangeText={setNewColour}
                autoCapitalize="words"
                placeholder="e.g. White"
              />
              <FieldInput
                label="Vehicle Type"
                value={newVehicleType}
                onChangeText={setNewVehicleType}
                autoCapitalize="words"
                placeholder="e.g. Pickup"
              />
              {addVehicleMsg ? (
                <Text style={[
                  styles.addVehicleFeedback,
                  { color: addVehicleMsg.ok ? '#2E7D32' : '#C62828' },
                ]}>
                  {addVehicleMsg.text}
                </Text>
              ) : null}
              <TouchableOpacity
                onPress={handleSaveNewVehicle}
                disabled={savingVehicle || !newPlate.trim()}
                activeOpacity={0.8}
                style={[styles.addVehicleSaveBtn, { opacity: savingVehicle || !newPlate.trim() ? 0.5 : 1 }]}
              >
                <MaterialIcons name="save" size={15} color="#FFFFFF" />
                <Text style={styles.addVehicleSaveBtnText}>
                  {savingVehicle ? 'SAVING…' : 'SAVE VEHICLE'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Selected vehicle summary banner */}
        {selectedVehicle ? (
          <View style={styles.selectedVehicleBanner}>
            <MaterialIcons name="directions-car" size={14} color="#FFFFFF" />
            <Text style={styles.selectedVehicleBannerText}>
              {selectedVehicle.number_plate}
              {selectedVehicle.colour ? ` · ${selectedVehicle.colour}` : ''}
              {selectedVehicle.vehicle_type ? ` · ${selectedVehicle.vehicle_type}` : ''}
            </Text>
            <TouchableOpacity
              onPress={() => setSelectedVehicle(null)}
              style={{ marginLeft: 'auto' }}
            >
              <MaterialIcons name="close" size={14} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Passengers */}
        <FieldInput
          label="No. of Passengers (excl. driver)"
          value={passengers}
          onChangeText={(v) => setPassengers(v.replace(/[^0-9]/g, ''))}
          keyboardType="number-pad"
          placeholder="0"
          style={{ marginTop: 10 }}
        />

        {/* Check In button */}
        <TouchableOpacity
          onPress={handleCheckIn}
          disabled={busy}
          activeOpacity={0.8}
          style={[styles.actionBtn, { opacity: busy ? 0.6 : 1, marginTop: 14, backgroundColor: '#FB8C00' }]}
        >
          <MaterialIcons name="login" size={18} color="#FFFFFF" />
          <Text style={styles.actionBtnText}>
            {busy ? 'CHECKING IN…' : checkInCount > 0 ? 'CHECK IN ANOTHER PERSON' : 'CHECK IN'}
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        onPress={onRegisterNew}
        activeOpacity={0.7}
        style={styles.altActionLink}
      >
        <MaterialIcons name="person-add" size={16} color="#000000" />
        <Text style={styles.altActionLinkText}>Different contractor? Book a new visit</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Public component ────────────────────────────────────────────────────────

type Props = {
  result: ContractorSearchResult;
  onCheckIn: (vehicle?: ContractorVehicle, passengers?: number) => void;
  onRegisterNew: () => void;
  onAddVehicle?: (vehicle: ContractorVehicle) => Promise<'added' | 'duplicate'>;
  showWalkInForm?: boolean;
  onCloseWalkIn?: () => void;
  onSaveWalkIn?: (data: WalkInContractorData) => void;
  savingWalkIn?: boolean;
  busy?: boolean;
};

export function ContractorForm({
  result,
  onCheckIn,
  onRegisterNew,
  onAddVehicle,
  showWalkInForm,
  onCloseWalkIn,
  onSaveWalkIn,
  savingWalkIn,
  busy,
}: Props) {
  const hasResult = Boolean(result.contractor_name || result.contract_name);

  if (showWalkInForm) {
    return (
      <WalkInBookingForm
        onClose={onCloseWalkIn ?? (() => {})}
        onSave={onSaveWalkIn ?? (() => {})}
        saving={savingWalkIn}
      />
    );
  }

  if (!hasResult) {
    return <NotFoundCard onRegisterNew={onRegisterNew} />;
  }

  return (
    <ApprovedContractorCard
      result={result}
      onCheckIn={onCheckIn}
      onRegisterNew={onRegisterNew}
      onAddVehicle={onAddVehicle}
      busy={busy}
    />
  );
}

export type { ContractorVehicle };

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    borderLeftWidth: 4,
    borderRadius: 10,
    padding: 14,
    marginVertical: 8,
    backgroundColor: '#F5F5F5',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111111',
  },
  cardSubtext: {
    fontSize: 13,
    color: '#555555',
    marginTop: 1,
  },
  approvedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#000000',
    borderRadius: 12,
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginLeft: 6,
    alignSelf: 'flex-start',
  },
  approvedBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    marginLeft: 3,
    letterSpacing: 0.5,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  infoLabel: {
    fontSize: 12,
    color: '#666666',
  },
  infoValue: {
    fontSize: 12,
    color: '#333333',
    flex: 1,
  },
  subSectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666666',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  vehiclePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8E8E8',
    borderWidth: 1,
    borderColor: '#D0D0D0',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 6,
  },
  vehiclePillSelected: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  vehiclePillText: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 4,
  },
  vehiclePillSub: {
    fontSize: 12,
    marginLeft: 2,
  },
  selectedVehicleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#333333',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 8,
  },
  selectedVehicleBannerText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
    flex: 1,
  },
  actionBtn: {
    backgroundColor: '#000000',
    borderRadius: 8,
    paddingVertical: 14,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    marginLeft: 6,
    letterSpacing: 0.5,
  },
  altActionLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  altActionLinkText: {
    color: '#000000',
    fontSize: 13,
    marginLeft: 4,
    fontWeight: '600',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111111',
  },
  divider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 8,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#555555',
    marginBottom: 4,
    marginTop: 2,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#D0D0D0',
    borderRadius: 7,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 14,
    color: '#111111',
    backgroundColor: '#FFFFFF',
  },
  modeRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  modeChip: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D0D0D0',
    borderRadius: 7,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  modeChipSelected: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  modeChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333333',
  },
  addVehicleLink: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 4,
  },
  addVehicleLinkText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FB8C00',
  },
  addVehicleBox: {
    marginTop: 8,
    backgroundColor: '#FFF8F0',
    borderWidth: 1,
    borderColor: '#FFCC80',
    borderRadius: 8,
    padding: 10,
  },
  addVehicleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 5,
  },
  addVehicleTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111111',
  },
  addVehicleFeedback: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  addVehicleSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FB8C00',
    borderRadius: 7,
    paddingVertical: 10,
    gap: 5,
    marginTop: 4,
  },
  addVehicleSaveBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
});
