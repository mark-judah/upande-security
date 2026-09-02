import { useEffect, useRef, useState } from 'react';
import { Screen } from '@/src/core/ui/Screen';
import { Card } from '@/src/core/ui/Card';
import { Input } from '@/src/core/ui/Input';
import { Button } from '@/src/core/ui/Button';
import {
  useSecurityOpsSettings,
  useUpdateSecurityOpsSettings,
} from '@/lib/hooks/useSecurityOpsSettings';
import type { SecurityOpsSettings, UpdateSecurityOpsSettingsInput } from '@/lib/services/api';

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
  const initialized = useRef(false);
  const savedRef = useRef<SecurityOpsSettings | null>(null);

  const applySettings = (s: SecurityOpsSettings) => {
    savedRef.current = s;
    setRadius(String(s.nearby_guard_alert_radius_m));
    setStaleMin(String(s.nearby_alert_stale_minutes));
    setCheckinMin(String(s.missed_checkin_minutes));
    setEscalationMin(String(s.escalation_minutes));
  };

  useEffect(() => {
    if (data && !initialized.current) {
      applySettings(data);
      initialized.current = true;
    }
  }, [data]);

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

    if (Object.keys(payload).length === 0) return;

    const result = await updateMutation.mutateAsync(payload);
    applySettings(result);
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
    </Screen>
  );
}
