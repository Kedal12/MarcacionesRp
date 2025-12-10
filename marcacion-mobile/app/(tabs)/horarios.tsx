import { getMisHorariosSemana, HorarioDetalle } from '@/src/api/horario';
import { Button, Card, Chip, Divider, Icon, ListItem, Text } from '@rneui/themed';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, SectionList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(weekOfYear);
dayjs.locale('es');

// ✅ Colores corporativos "La Media Naranja"
const CorporateColors = {
  primary: '#e9501e',
  primaryDark: '#cc3625',
  secondary: '#fab626',
  white: '#ffffff',
  background: '#fff8f5',
  success: '#4caf50',
  textDark: '#2d2d2d',
  textLight: '#6b7280',
};

const fmtHora = (h: string) => {
  const parts = h.split(':');
  if (parts.length >= 2) {
    return `${parts[0]}:${parts[1]}`;
  }
  return h;
};

const fmtDiaLegible = (dateISO: string) =>
  dayjs(dateISO).format('dddd D [de] MMMM');

type Section = { title: string; data: HorarioDetalle[] };

export default function HorariosScreen() {
  const [refDate, setRefDate] = useState(dayjs());
  const [items, setItems] = useState<HorarioDetalle[]>([]);
  const [loading, setLoading] = useState(false);

  const { desdeISO, hastaISO } = useMemo(() => {
    const start = refDate.startOf('week');
    const end = refDate.endOf('week');
    return {
      desdeISO: start.utc().toISOString(),
      hastaISO: end.utc().toISOString(),
    };
  }, [refDate]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getMisHorariosSemana({ desdeISO, hastaISO });
      setItems(res.items ?? []);
    } catch (e) {
      console.error('Error cargando horarios:', e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [desdeISO, hastaISO]);

  useEffect(() => {
    load();
  }, [load]);

  const sections: Section[] = useMemo(() => {
    const map = new Map<string, HorarioDetalle[]>();
    items.forEach(h => {
      const key = dayjs(h.dia).format('YYYY-MM-DD');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(h);
    });
    for (const arr of map.values()) arr.sort((a, b) => a.desde.localeCompare(b.desde));
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([isoDay, arr]) => ({
        title: fmtDiaLegible(isoDay),
        data: arr,
      }));
  }, [items]);

  const goPrevWeek = () => setRefDate((d) => d.subtract(1, 'week'));
  const goNextWeek = () => setRefDate((d) => d.add(1, 'week'));

  const weekTitleFormat = (isoDate: string) => {
    if (dayjs(desdeISO).month() !== dayjs(hastaISO).month()) {
      return dayjs(isoDate).tz(dayjs.tz.guess()).format('D MMM');
    }
    return dayjs(isoDate).tz(dayjs.tz.guess()).format('D');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      {/* Header con navegación de semanas */}
      <Card containerStyle={styles.headerCard}>
        <View style={styles.headerRow}>
          <Button
            type="clear"
            onPress={goPrevWeek}
            icon={<Icon name="chevron-back" type="ionicon" color={CorporateColors.primary} />}
            disabled={loading}
          />
          <View style={{ alignItems: 'center', flex: 1 }}>
            <Text style={styles.weekTitle}>
              {weekTitleFormat(desdeISO)} – {weekTitleFormat(hastaISO)}
              {refDate.year() !== dayjs().year() && ` ${refDate.year()}`}
            </Text>
            <Text style={styles.weekSubtitle}>
              Semana #{refDate.week()}
            </Text>
          </View>
          <Button
            type="clear"
            onPress={goNextWeek}
            icon={<Icon name="chevron-forward" type="ionicon" color={CorporateColors.primary} />}
            disabled={loading}
          />
        </View>
      </Card>

      {loading && items.length === 0 && (
        <ActivityIndicator size="large" color={CorporateColors.primary} style={{ marginTop: 24 }} />
      )}

      <SectionList
        sections={sections}
        keyExtractor={(item) => `${item.id}-${item.desde}-${item.hasta}`}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.listContent}
        onRefresh={load}
        refreshing={loading}
        ListEmptyComponent={
          !loading ? (
            <Card containerStyle={styles.emptyCard}>
              <Text style={styles.emptyText}>
                No tienes horarios asignados en esta semana.
              </Text>
            </Card>
          ) : null
        }
        renderSectionHeader={({ section }) => (
          <Card containerStyle={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Icon name="calendar-outline" type="ionicon" size={18} color={CorporateColors.primary} />
              <Text style={styles.sectionTitle}>{section.title}</Text>
            </View>
          </Card>
        )}
        renderItem={({ item }) => (
          <Card containerStyle={styles.itemCard}>
            <ListItem bottomDivider containerStyle={styles.listItemContainer}>
              <Icon name="time-outline" type="ionicon" color={CorporateColors.primary} />
              <ListItem.Content>
                <ListItem.Title style={styles.itemTitle}>
                  {fmtHora(item.desde)} – {fmtHora(item.hasta)}
                </ListItem.Title>
                <ListItem.Subtitle style={styles.itemSubtitle}>
                  {item.sedeNombre ?? '—'} {item.observacion ? `· ${item.observacion}` : ''}
                </ListItem.Subtitle>
              </ListItem.Content>
              <Chip
                title="Asignado"
                size="sm"
                buttonStyle={styles.chipStyle}
                titleStyle={styles.chipTitle}
              />
            </ListItem>
          </Card>
        )}
        renderSectionFooter={() => <Divider style={{ marginHorizontal: 16 }} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { 
    flex: 1, 
    backgroundColor: CorporateColors.background,
  },
  headerCard: { 
    marginHorizontal: 12, 
    marginTop: 8, 
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  headerRow: { 
    flexDirection: 'row', 
    alignItems: 'center',
  },
  weekTitle: { 
    fontSize: 16, 
    fontWeight: '800',
    color: CorporateColors.textDark,
  },
  weekSubtitle: { 
    fontSize: 12, 
    color: CorporateColors.textLight, 
    marginTop: 2,
  },
  listContent: {
    paddingBottom: 32,
  },
  sectionCard: {
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 0,
    borderRadius: 16,
    paddingVertical: 10,
    backgroundColor: CorporateColors.white,
  },
  sectionHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8, 
    paddingHorizontal: 4,
  },
  sectionTitle: { 
    fontSize: 15, 
    fontWeight: '800', 
    color: CorporateColors.textDark, 
    textTransform: 'capitalize',
  },
  itemCard: {
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 16,
    paddingVertical: 0,
  },
  listItemContainer: {
    backgroundColor: CorporateColors.white,
    borderRadius: 12,
  },
  itemTitle: {
    fontWeight: '800',
    fontSize: 16,
    color: CorporateColors.textDark,
  },
  itemSubtitle: {
    color: CorporateColors.textLight,
  },
  chipStyle: {
    backgroundColor: CorporateColors.primary,
    borderRadius: 8,
  },
  chipTitle: {
    color: CorporateColors.white,
    fontSize: 11,
    fontWeight: '600',
  },
  emptyCard: { 
    marginHorizontal: 12, 
    borderRadius: 16, 
    marginTop: 12, 
    padding: 16,
  },
  emptyText: { 
    textAlign: 'center', 
    color: CorporateColors.textLight, 
    fontSize: 15,
  },
});