import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { FormSelect } from '@/components/forms/FormSelect';
import { TRANSPORT_MODES, type TransportMode } from '@/constants/transportModes';
import type { ContractorSearchResult } from '@/lib/api/types';

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
  mode_of_transport: TransportMode;
  number_of_passengers?: number;
};

export type ContractorCheckInData = {
  mode: TransportMode;
  plate?: string;
  colour?: string;
  passengers?: number;
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
  const [mode, setMode] = useState<TransportMode>('On Foot');
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

      <FormSelect
        label="Mode of Transport"
        value={mode}
        options={TRANSPORT_MODES}
        onChange={(v) => setMode(v as TransportMode)}
      />

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
  busy,
}: {
  result: ContractorSearchResult;
  onCheckIn: (data: ContractorCheckInData) => void;
  onRegisterNew: () => void;
  busy?: boolean;
}) {
  const [mode, setMode] = useState<TransportMode>('On Foot');
  const [plate, setPlate] = useState('');
  const [colour, setColour] = useState('');
  const [passengers, setPassengers] = useState('');
  const [checkInCount, setCheckInCount] = useState(0);
  const [lastPlate, setLastPlate] = useState<string | null>(null);

  const showVehicle = mode !== 'On Foot';

  function handleCheckIn() {
    const trimmedPlate = plate.trim();
    setLastPlate(showVehicle && trimmedPlate ? trimmedPlate : null);
    const pax = passengers ? parseInt(passengers, 10) : undefined;
    onCheckIn({
      mode,
      plate: showVehicle ? trimmedPlate || undefined : undefined,
      colour: showVehicle ? colour.trim() || undefined : undefined,
      passengers: pax,
    });
    setPlate('');
    setColour('');
    setPassengers('');
    setCheckInCount((n) => n + 1);
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

        {/* Transport */}
        <View style={{ marginTop: 12 }}>
          <FormSelect
            label="Mode of Transport"
            value={mode}
            options={TRANSPORT_MODES}
            onChange={(v) => setMode(v as TransportMode)}
          />

          {showVehicle ? (
            <>
              <FieldInput
                label="Number Plate"
                value={plate}
                onChangeText={setPlate}
                autoCapitalize="characters"
                placeholder="e.g. KDA 123A"
              />
              <FieldInput
                label="Vehicle Colour"
                value={colour}
                onChangeText={setColour}
                autoCapitalize="words"
                placeholder="e.g. White"
              />
            </>
          ) : null}

          <FieldInput
            label="No. of Passengers (excl. driver)"
            value={passengers}
            onChangeText={(v) => setPassengers(v.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            placeholder="0"
          />
        </View>

        {/* Check In button */}
        <TouchableOpacity
          onPress={handleCheckIn}
          disabled={busy}
          activeOpacity={0.8}
          style={[styles.actionBtn, { opacity: busy ? 0.6 : 1, marginTop: 6, backgroundColor: '#FB8C00' }]}
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
  onCheckIn: (data: ContractorCheckInData) => void;
  onRegisterNew: () => void;
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
      busy={busy}
    />
  );
}

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
});
