import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/src/core/ui/Screen';
import { Card } from '@/src/core/ui/Card';
import { Input } from '@/src/core/ui/Input';
import { Button } from '@/src/core/ui/Button';
import {
  useSecurityOpsSettings,
  useUpdateSecurityOpsSettings,
} from '@/lib/hooks/useSecurityOpsSettings';
import type {
  CommandCenterExtraUser,
  SecurityOpsSettings,
  UpdateSecurityOpsSettingsInput,
} from '@/lib/services/api';
import { borderRadius, COLORS, fontFamily, fontSize, spacing } from '@/src/core/theme';

function parsePositiveInt(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = parseInt(trimmed, 10);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

export default function CommandCenterSettingsScreen() {
  const { data, isLoading, error, refetch } = useSecurityOpsSettings();
  const updateMutation = useUpdateSecurityOpsSettings();

  const [radius, setRadius] = useState('');
  const [staleMin, setStaleMin] = useState('');
  const [checkinMin, setCheckinMin] = useState('');
  const [escalationMin, setEscalationMin] = useState('');
  const [extraUsers, setExtraUsers] = useState<CommandCenterExtraUser[]>([]);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [skippedUsers, setSkippedUsers] = useState<string[]>([]);
  const initialized = useRef(false);
  const savedRef = useRef<SecurityOpsSettings | null>(null);

  const applySettings = (s: SecurityOpsSettings) => {
    savedRef.current = s;
    setRadius(String(s.nearby_guard_alert_radius_m));
    setStaleMin(String(s.nearby_alert_stale_minutes));
    setCheckinMin(String(s.missed_checkin_minutes));
    setEscalationMin(String(s.escalation_minutes));
    setExtraUsers(s.command_center_extra_users);
  };

  useEffect(() => {
    if (data && !initialized.current) {
      applySettings(data);
      initialized.current = true;
    }
  }, [data]);

  const addUser = () => {
    const email = newUserEmail.trim();
    if (!email) return;
    if (extraUsers.some((u) => u.user.toLowerCase() === email.toLowerCase())) {
      setNewUserEmail('');
      return;
    }
    setExtraUsers((rows) => [...rows, { user: email, full_name: '' }]);
    setNewUserEmail('');
  };

  const removeUser = (email: string) => {
    setExtraUsers((rows) => rows.filter((u) => u.user !== email));
  };

  const onSave = async () => {
    const saved = savedRef.current;
    const payload: UpdateSecurityOpsSettingsInput = {};

    const radiusNum = parsePositiveInt(radius);
    const staleNum = parsePositiveInt(staleMin);
    const checkinNum = parsePositiveInt(checkinMin);
    const escalationNum = parsePositiveInt(escalationMin);

    if (radiusNum !== null && (!saved || radiusNum !== saved.nearby_guard_alert_radius_m)) {
      payload.nearby_guard_alert_radius_m = radiusNum;
    }
    if (staleNum !== null && (!saved || staleNum !== saved.nearby_alert_stale_minutes)) {
      payload.nearby_alert_stale_minutes = staleNum;
    }
    if (checkinNum !== null && (!saved || checkinNum !== saved.missed_checkin_minutes)) {
      payload.missed_checkin_minutes = checkinNum;
    }
    if (escalationNum !== null && (!saved || escalationNum !== saved.escalation_minutes)) {
      payload.escalation_minutes = escalationNum;
    }

    const currentEmails = extraUsers.map((u) => u.user);
    const savedEmails = (saved?.command_center_extra_users ?? []).map((u) => u.user);
    const usersChanged =
      currentEmails.length !== savedEmails.length ||
      currentEmails.some((e, i) => e !== savedEmails[i]);
    if (usersChanged) {
      payload.command_center_extra_users = currentEmails;
    }

    if (Object.keys(payload).length === 0) return;

    const result = await updateMutation.mutateAsync(payload);
    applySettings(result);
    setSkippedUsers(result.skipped_users);
  };

  return (
    <Screen
      title="Security Ops Settings"
      onRefresh={async () => { await refetch(); }}
      loading={isLoading && !data}
      error={!isLoading && error ? (error instanceof Error ? error.message : 'Failed to load') : null}
      onRetry={() => refetch()}
      footer={
        <Button
          label="Save changes"
          onPress={onSave}
          loading={updateMutation.isPending}
          disabled={updateMutation.isPending}
        />
      }
    >
      <Card title="Alert thresholds">
        <Input
          label="Nearby guard alert radius (metres)"
          value={radius}
          onChangeText={setRadius}
          keyboardType="number-pad"
          placeholder="e.g. 500"
        />
        <Input
          label="Nearby alert stale after (minutes)"
          value={staleMin}
          onChangeText={setStaleMin}
          keyboardType="number-pad"
          placeholder="e.g. 5"
        />
        <Input
          label="Missed check-in threshold (minutes)"
          value={checkinMin}
          onChangeText={setCheckinMin}
          keyboardType="number-pad"
          placeholder="e.g. 15"
        />
        <Input
          label="Escalation after (minutes)"
          value={escalationMin}
          onChangeText={setEscalationMin}
          keyboardType="number-pad"
          placeholder="e.g. 30"
          style={{ marginBottom: 0 }}
        />
      </Card>

      <Card title="Command Center allowlist">
        <Text style={s.hint}>
          Users listed here get Command Center access without a role change. Editing this list
          replaces it entirely — remove someone by deleting their row below, then save.
        </Text>

        {extraUsers.length === 0 ? (
          <Text style={s.emptyHint}>No additional users allow-listed.</Text>
        ) : (
          extraUsers.map((u) => (
            <View key={u.user} style={s.userRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.userName} numberOfLines={1}>{u.full_name || u.user}</Text>
                {u.full_name ? <Text style={s.userEmail} numberOfLines={1}>{u.user}</Text> : null}
              </View>
              <Pressable onPress={() => removeUser(u.user)} hitSlop={10}>
                <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
              </Pressable>
            </View>
          ))
        )}

        {skippedUsers.length > 0 ? (
          <View style={s.warnBox}>
            <Ionicons name="warning-outline" size={14} color="#92400E" />
            <Text style={s.warnText}>
              Not saved (no matching user): {skippedUsers.join(', ')}
            </Text>
          </View>
        ) : null}

        <View style={s.addRow}>
          <View style={{ flex: 1 }}>
            <Input
              value={newUserEmail}
              onChangeText={setNewUserEmail}
              placeholder="user@example.com"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
            />
          </View>
          <Button label="Add" variant="outline" onPress={addUser} style={s.addBtn} />
        </View>
      </Card>
    </Screen>
  );
}

const s = StyleSheet.create({
  hint: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    color: COLORS.textMuted,
    marginBottom: spacing.md,
    lineHeight: 16,
  },
  emptyHint: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: COLORS.textMuted,
    marginBottom: spacing.md,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  userName: { fontFamily: fontFamily.semiBold, fontSize: fontSize.sm, color: COLORS.text },
  userEmail: { fontFamily: fontFamily.regular, fontSize: fontSize.xs, color: COLORS.textMuted, marginTop: 1 },
  warnBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    backgroundColor: '#FFFBEB',
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  warnText: { flex: 1, fontFamily: fontFamily.regular, fontSize: fontSize.xs, color: '#92400E' },
  addRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, alignItems: 'center' },
  addBtn: { paddingHorizontal: spacing.lg, minHeight: 48 },
});
