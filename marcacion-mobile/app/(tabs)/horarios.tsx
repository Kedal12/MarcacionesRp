import { getMisHorariosSemana, HorarioDetalle } from '@/src/api/horario'; // API y tipo
import { Button, Card, Chip, Divider, Icon, ListItem, Text } from '@rneui/themed';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import weekOfYear from 'dayjs/plugin/weekOfYear'; // Importado
import React, { useCallback, useEffect, useMemo, useState } from 'react';
// Importado SectionList y ActivityIndicator
import { ActivityIndicator, SectionList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(weekOfYear); // Extend
dayjs.locale('es');

// Funciones de formato
const fmtHora = (h: string) => {
  // Asume que h es "HH:mm:ss", lo muestra como "HH:mm"
  const parts = h.split(':');
  if (parts.length >= 2) {
    return `${parts[0]}:${parts[1]}`;
  }
  return h;
};
// Formato legible para el título de la sección
const fmtDiaLegible = (dateISO: string) =>
  dayjs(dateISO).format('dddd D [de] MMMM');

// Tipo para la SectionList
type Section = { title: string; data: HorarioDetalle[] };

export default function HorariosScreen() {
  const [refDate, setRefDate] = useState(dayjs()); // Fecha de referencia
  const [items, setItems] = useState<HorarioDetalle[]>([]);
  const [loading, setLoading] = useState(false);

  // Calcula el inicio y fin de la semana basado en refDate
  const { desdeISO, hastaISO } = useMemo(() => {
    const start = refDate.startOf('week');
    const end = refDate.endOf('week');
    return {
      desdeISO: start.utc().toISOString(),
      hastaISO: end.utc().toISOString(),
    };
  }, [refDate]);

  // Función para cargar los datos
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

  // Carga los datos cuando el componente se monta o la semana cambia
  useEffect(() => {
    load();
  }, [load]);

  // Convierte los items en secciones para SectionList
  const sections: Section[] = useMemo(() => {
    const map = new Map<string, HorarioDetalle[]>();
    items.forEach(h => {
      const key = dayjs(h.dia).format('YYYY-MM-DD');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(h);
    });
    // ordenar horas por día
    for (const arr of map.values()) arr.sort((a, b) => a.desde.localeCompare(b.desde));
    // construir secciones ordenadas por fecha
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([isoDay, arr]) => ({
        title: fmtDiaLegible(isoDay), // Título legible
        data: arr, // Datos del día
      }));
  }, [items]);

  // Navegación de semanas
  const goPrevWeek = () => setRefDate((d) => d.subtract(1, 'week'));
  const goNextWeek = () => setRefDate((d) => d.add(1, 'week'));

  // Formato del título del header (mostrando mes si cambia)
  const weekTitleFormat = (isoDate: string) => {
      if (dayjs(desdeISO).month() !== dayjs(hastaISO).month()) {
          return dayjs(isoDate).tz(dayjs.tz.guess()).format('D MMM');
      }
      return dayjs(isoDate).tz(dayjs.tz.guess()).format('D');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top','left','right','bottom']}>
      {/* Header con rango de semana */}
      <Card containerStyle={styles.headerCard}>
        <View style={styles.headerRow}>
          <Button
            type="clear"
            onPress={goPrevWeek}
            icon={<Icon name="chevron-back" type="ionicon" />}
            disabled={loading} // Deshabilitado mientras carga
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
            icon={<Icon name="chevron-forward" type="ionicon" />}
            disabled={loading} // Deshabilitado mientras carga
          />
        </View>
      </Card>

      {/* Indicador de carga principal */}
      {loading && items.length === 0 && (
         <ActivityIndicator size="large" color="#007AFF" style={{ marginTop: 24 }} />
      )}

      {/* Lista seccionada y con scroll */}
      <SectionList
        sections={sections}
        // Clave robusta para cada item
        keyExtractor={(item) => `${item.id}-${item.desde}-${item.hasta}`} 
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.listContent}
        // Pull-to-refresh
        onRefresh={load}
        refreshing={loading}
        // Mensaje si no hay datos
        ListEmptyComponent={
          !loading ? (
            <Card containerStyle={styles.emptyCard}>
              <Text style={styles.emptyText}>
                No tienes horarios asignados en esta semana.
              </Text>
            </Card>
          ) : null // No mostrar nada si está cargando (ya lo hace el 'refreshing')
        }
        // Renderiza el header de cada día (en su propia tarjeta)
        renderSectionHeader={({ section }) => (
          <Card containerStyle={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Icon name="calendar-outline" type="ionicon" size={18} color="#6b7280" />
              <Text style={styles.sectionTitle}>{section.title}</Text>
            </View>
          </Card>
        )}
        // Renderiza cada horario
        renderItem={({ item }) => (
          <Card containerStyle={styles.itemCard}>
            <ListItem bottomDivider>
              <Icon name="time-outline" type="ionicon" />
              <ListItem.Content>
                <ListItem.Title style={{ fontWeight: '800', fontSize: 16 }}>
                  {fmtHora(item.desde)} – {fmtHora(item.hasta)}
                </ListItem.Title>
                <ListItem.Subtitle style={{ color: '#6b7280' }}>
                  {item.sedeNombre ?? '—'} {item.observacion ? `· ${item.observacion}` : ''}
                </ListItem.Subtitle>
              </ListItem.Content>
              <Chip type="outline" title="Asignado" size="sm" />
            </ListItem>
          </Card>
        )}
        // Divisor entre secciones
        renderSectionFooter={() => <Divider style={{ marginHorizontal: 16 }} />}
      />
    </SafeAreaView>
  );
}

// Estilos de la versión "mezclar con" (SectionList)
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f4f6f8' },
  headerCard: { marginHorizontal: 12, marginTop: 8, borderRadius: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  weekTitle: { fontSize: 16, fontWeight: '800' },
  weekSubtitle: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  listContent: {
    paddingBottom: 32, // deja espacio sobre la tab bar
  },
  sectionCard: {
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 0,
    borderRadius: 16,
    paddingVertical: 10,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 }, // Añadido padding
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#374151', textTransform: 'capitalize' },
  itemCard: {
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 16,
    paddingVertical: 0, // ListItem ya tiene padding
  },
  emptyCard: { marginHorizontal: 12, borderRadius: 16, marginTop: 12, padding: 16 },
  emptyText: { textAlign: 'center', color: '#6b7280', fontSize: 15 },
});
