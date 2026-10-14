import { useState } from 'react';
import { Text, View, ScrollView, ActivityIndicator, TextInput, TouchableOpacity } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { ChoiceChip } from '@/components/ui/ChoiceChip';
import { useGateFarm, useGateFarms } from '@/lib/hooks/useGateFarm';
import { useFarmStore } from '@/lib/stores/farmStore';
import { useFeedback } from '@/lib/hooks/useFeedback';
import { api } from '@/lib/services/api';
import { COLORS, spacing, borderRadius, fontFamily, fontSize } from '@/src/core/theme';

const small = { fontFamily: fontFamily.regular, fontSize: fontSize.xs, color: COLORS.textSecondary, marginTop: 2 };
const heading = { fontFamily: fontFamily.semiBold, fontSize: fontSize.sm, color: COLORS.text };

/**
 * Where this guard is checking, at the top of the Gate tab.
 * - Rostered (or moved): shows the farm and gate the server records every
 *   scan under, with "Change location" for emergencies - covering a gate
 *   nobody turned up for. A change needs a reason and is logged and sent to
 *   the security heads server-side, so it is never silent.
 * - Not rostered and no linked farm: "Which farm are you guarding?",
 *   remembered on the device.
 */
export function FarmPicker() {
  const { needsChoice, farm, location } = useGateFarm();
  const setFarm = useFarmStore((s) => s.setFarm);
  const [changing, setChanging] = useState(false);
  const farms = useGateFarms(needsChoice || changing);

  if (location?.farm) {
    return (
      <View>
        <PostBanner onChange={() => setChanging((v) => !v)} changing={changing} />
        {changing ? (
          <ChangeLocation
            farms={farms.data ?? []}
            loading={farms.isLoading}
            onDone={() => setChanging(false)}
          />
        ) : null}
      </View>
    );
  }

  if (!needsChoice) return null;

  return (
    <View
      style={{
        backgroundColor: farm ? COLORS.surfaceAlt : '#FFFBEB',
        borderRadius: borderRadius.md,
        padding: spacing.md,
        marginBottom: spacing.md,
      }}
    >
      <Text style={heading}>{farm ? `Farm: ${farm}` : 'Select the farm you are guarding'}</Text>
      {!farm ? (
        <Text style={small}>
          Your login is not linked to a farm yet, so choose it here before checking anyone in or out.
        </Text>
      ) : null}
      {farms.isLoading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: spacing.sm }} />
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.sm }}>
          {(farms.data ?? []).map((f) => (
            <ChoiceChip key={f.farm} label={f.farm} selected={farm === f.farm} onPress={() => setFarm(f.farm)} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function PostBanner({ onChange, changing }: { onChange: () => void; changing: boolean }) {
  const { location } = useGateFarm();
  const queryClient = useQueryClient();
  const feedback = useFeedback();
  const [busy, setBusy] = useState(false);
  if (!location?.farm) return null;
  const moved = location.source === 'change';
  const where = location.farm + (location.gate ? ' - ' + location.gate : '');

  const onReturn = async () => {
    setBusy(true);
    try {
      await api.returnToRoster();
      await queryClient.invalidateQueries({ queryKey: ['session-info'] });
      feedback.success('Back at your rostered post');
    } catch (e) {
      feedback.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View
      style={{
        backgroundColor: moved ? '#FFFBEB' : COLORS.surfaceAlt,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        marginBottom: spacing.md,
        borderWidth: moved ? 1 : 0,
        borderColor: COLORS.warn,
      }}
    >
      <Text style={heading}>{(moved ? 'Moved to: ' : 'Your post: ') + where}</Text>
      {moved && location.rostered ? (
        <Text style={small}>
          Rostered at {location.rostered.farm}
          {location.rostered.gate ? ' - ' + location.rostered.gate : ''}. Reason: {location.change?.reason}
        </Text>
      ) : moved ? (
        <Text style={small}>Reason: {location.change?.reason}</Text>
      ) : (
        <Text style={small}>
          {location.source === 'roster' ? "From today's roster." : 'From your guard record (not rostered today).'} Every
          scan is recorded here.
        </Text>
      )}
      <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm }}>
        {moved && location.rostered ? (
          <TouchableOpacity onPress={onReturn} disabled={busy} hitSlop={8}>
            <Text style={{ ...heading, color: COLORS.primary }}>{busy ? 'Returning...' : 'Return to roster'}</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity onPress={onChange} hitSlop={8}>
          <Text style={{ ...heading, color: COLORS.primary }}>{changing ? 'Cancel' : 'Change location'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

type FarmWithGates = { farm: string; gates: { gate_name: string; is_main_gate: boolean }[] };

function ChangeLocation({
  farms,
  loading,
  onDone,
}: {
  farms: FarmWithGates[];
  loading: boolean;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const feedback = useFeedback();
  const [farm, setFarm] = useState<string | null>(null);
  const [gate, setGate] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const gates = farms.find((f) => f.farm === farm)?.gates ?? [];
  const ready = !!farm && !!gate && reason.trim().length >= 5 && !busy;

  const onConfirm = async () => {
    if (!farm || !gate) return;
    setBusy(true);
    try {
      await api.changeLocation(farm, gate, reason.trim());
      await queryClient.invalidateQueries({ queryKey: ['session-info'] });
      feedback.success('Location changed - your security head has been notified');
      onDone();
    } catch (e) {
      feedback.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View
      style={{
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: COLORS.border,
        padding: spacing.md,
        marginBottom: spacing.md,
      }}
    >
      <Text style={heading}>Emergency location change</Text>
      <Text style={small}>Only when you have been moved off your rostered post. Your security head is notified.</Text>
      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: spacing.sm }} />
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.sm }}>
          {farms.map((f) => (
            <ChoiceChip
              key={f.farm}
              label={f.farm}
              selected={farm === f.farm}
              onPress={() => {
                setFarm(f.farm);
                // One gate (incl. the default "Main Gate") needs no choice.
                setGate(f.gates.length === 1 ? f.gates[0].gate_name : null);
              }}
            />
          ))}
        </ScrollView>
      )}
      {gates.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.sm }}>
          {gates.map((g) => (
            <ChoiceChip
              key={g.gate_name}
              label={g.is_main_gate ? g.gate_name + ' (Main)' : g.gate_name}
              selected={gate === g.gate_name}
              onPress={() => setGate(g.gate_name)}
            />
          ))}
        </ScrollView>
      ) : null}
      <TextInput
        value={reason}
        onChangeText={setReason}
        placeholder="Reason, e.g. covering for an absent guard"
        placeholderTextColor={COLORS.textMuted}
        multiline
        style={{
          marginTop: spacing.sm,
          borderWidth: 1,
          borderColor: COLORS.border,
          borderRadius: borderRadius.sm,
          padding: spacing.sm,
          minHeight: 56,
          fontSize: fontSize.md,
          color: COLORS.text,
        }}
      />
      <TouchableOpacity
        onPress={onConfirm}
        disabled={!ready}
        activeOpacity={0.8}
        style={{
          marginTop: spacing.sm,
          backgroundColor: ready ? COLORS.primary : COLORS.border,
          borderRadius: borderRadius.md,
          paddingVertical: 12,
          alignItems: 'center',
        }}
      >
        {busy ? (
          <ActivityIndicator color={COLORS.textOnPrimary} />
        ) : (
          <Text style={{ ...heading, color: COLORS.textOnPrimary }}>Confirm location</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}
