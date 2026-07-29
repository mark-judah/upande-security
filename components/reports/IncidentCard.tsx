import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { IncidentDetail, IncidentPerson } from '@/lib/services/api';
import { useAuthStore } from '@/lib/stores/authStore';
import { COLORS, borderRadius, fontFamily, fontSize, spacing } from '@/src/core/theme';

const SEV_COLOR: Record<string, string> = {
  Critical: COLORS.danger,
  High: COLORS.warn,
  Medium: COLORS.info,
  Low: COLORS.textMuted,
};

function Field({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      <Text style={s.fieldValue}>{value}</Text>
    </View>
  );
}

function People({ title, people }: { title: string; people: IncidentPerson[] }) {
  if (!people.length) return null;
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>
        {title} ({people.length})
      </Text>
      {people.map((p, i) => (
        <View key={i} style={s.person}>
          <Text style={s.personName}>
            {p.name}
            {p.type ? <Text style={s.personType}>{'  ·  ' + p.type}</Text> : null}
          </Text>
          {p.id_number || p.contact ? (
            <Text style={s.personMeta}>{[p.id_number, p.contact].filter(Boolean).join('  ·  ')}</Text>
          ) : null}
          {p.notes ? <Text style={s.personMeta}>{p.notes}</Text> : null}
        </View>
      ))}
    </View>
  );
}

export function IncidentCard({ incident }: { incident: IncidentDetail }) {
  const [open, setOpen] = useState(false);
  const instanceUrl = useAuthStore((st) => st.instanceUrl);
  const sevColor = SEV_COLOR[incident.severity] ?? COLORS.textMuted;
  const isOpen = (incident.status || '').toLowerCase() === 'open';

  const openAttachment = (path: string) => {
    const url = path.startsWith('http') ? path : `${instanceUrl ?? ''}${path}`;
    Linking.openURL(url).catch(() => {});
  };

  return (
    <View style={s.card}>
      <TouchableOpacity
        onPress={() => setOpen((v) => !v)}
        activeOpacity={0.7}
        style={s.header}
      >
        <View style={[s.sevBar, { backgroundColor: sevColor }]} />
        <View style={{ flex: 1 }}>
          <View style={s.headerTop}>
            <Text style={s.nature} numberOfLines={1}>
              {incident.nature || 'Incident'}
            </Text>
            <View style={[s.sevBadge, { backgroundColor: sevColor }]}>
              <Text style={s.sevBadgeText}>{incident.severity || '—'}</Text>
            </View>
          </View>
          <Text style={s.sub} numberOfLines={1}>
            {[incident.location, incident.datetime].filter(Boolean).join('  ·  ')}
          </Text>
          <View style={s.statusRow}>
            <View style={[s.statusDot, { backgroundColor: isOpen ? COLORS.danger : COLORS.success }]} />
            <Text style={s.statusText}>{incident.status || '—'}</Text>
            {incident.attachments.length ? (
              <>
                <Ionicons name="attach" size={13} color={COLORS.textMuted} style={{ marginLeft: 10 }} />
                <Text style={s.statusText}>{incident.attachments.length}</Text>
              </>
            ) : null}
            <Ionicons
              name={open ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={COLORS.textMuted}
              style={{ marginLeft: 'auto' }}
            />
          </View>
        </View>
      </TouchableOpacity>

      {open ? (
        <View style={s.body}>
          <Field label="Description" value={incident.description} />
          <Field label="Reporter" value={incident.reporter} />
          <Field label="Assigned To" value={incident.assigned_to} />
          <Field label="Remarks" value={incident.remarks} />
          <Field label="Corrective Actions" value={incident.corrective_actions} />
          <Field label="Resolution" value={incident.resolution} />
          <Field label="Resolved At" value={incident.resolution_datetime} />
          <People title="Witnesses" people={incident.witnesses} />
          <People title="Victims" people={incident.victims} />
          <People title="Responsible Persons" people={incident.responsible} />
          {incident.attachments.length ? (
            <View style={s.field}>
              <Text style={s.fieldLabel}>Attachments</Text>
              {incident.attachments.map((a, i) => (
                <TouchableOpacity key={i} onPress={() => openAttachment(a)} style={s.attachRow}>
                  <Ionicons name="document-attach-outline" size={15} color={COLORS.info} />
                  <Text style={s.attachText} numberOfLines={1}>
                    {a.split('/').pop() || a}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  header: { flexDirection: 'row' },
  sevBar: { width: 4 },
  headerTop: { flexDirection: 'row', alignItems: 'center', paddingTop: spacing.sm + 2, paddingHorizontal: spacing.md },
  nature: { flex: 1, fontFamily: fontFamily.semiBold, fontSize: fontSize.sm, color: COLORS.text },
  sevBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: borderRadius.full },
  sevBadgeText: { color: COLORS.textOnPrimary, fontFamily: fontFamily.bold, fontSize: 10 },
  sub: { fontFamily: fontFamily.regular, fontSize: fontSize.xs, color: COLORS.textMuted, paddingHorizontal: spacing.md, marginTop: 2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: 4 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontFamily: fontFamily.medium, fontSize: fontSize.xs, color: COLORS.textSecondary },
  body: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.bgMuted,
    paddingTop: spacing.sm,
  },
  field: { marginTop: spacing.sm },
  fieldLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: 11,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  fieldValue: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: COLORS.text },
  person: { marginTop: 4, paddingLeft: spacing.sm, borderLeftWidth: 2, borderLeftColor: COLORS.border },
  personName: { fontFamily: fontFamily.medium, fontSize: fontSize.sm, color: COLORS.text },
  personType: { fontFamily: fontFamily.regular, fontSize: fontSize.xs, color: COLORS.textMuted },
  personMeta: { fontFamily: fontFamily.regular, fontSize: fontSize.xs, color: COLORS.textMuted },
  attachRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  attachText: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: COLORS.info, flex: 1 },
});
