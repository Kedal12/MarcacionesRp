// app/(tabs)/historial.tsx

import { getMisMarcaciones, type Marcacion } from '@/src/api/marcaciones';
import { dayjs, parseBackendDate } from '@/src/utils/date';
import { Button, Card, Icon, ListItem, Text } from '@rneui/themed';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  StyleSheet,
  View
} from 'react-native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { SafeAreaView } from 'react-native-safe-area-context';

// ✅ Colores corporativos "La Media Naranja"
const CorporateColors = {
  primary: '#e9501e',
  primaryDark: '#cc3625',
  secondary: '#fab626',
  white: '#ffffff',
  background: '#fff8f5',
  success: '#4caf50',
  warning: '#f59e0b',
  textDark: '#2d2d2d',
  textLight: '#6b7280',
};

export default function HistorialScreen() {
  const [marcaciones, setMarcaciones] = useState<Marcacion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [desde, setDesde] = useState(dayjs().startOf('week').toDate());
  const [hasta, setHasta] = useState(dayjs().endOf('day').toDate());

  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
  const [pickerMode, setPickerMode] = useState<'desde' | 'hasta'>('desde');

  const loadMarcaciones = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getMisMarcaciones({
        desde: dayjs(desde).utc().toISOString(),
        hasta: dayjs(hasta).utc().toISOString(),
        pageSize: 100,
        page: 1,
      });
      
      console.log('[Historial] Marcaciones recibidas:', response.items?.length);
      // Debug: ver la primera marcación para verificar formato de fechas
      if (response.items?.length > 0) {
        console.log('[Historial] Ejemplo de marcación:', {
          fechaHoraUtc: response.items[0].fechaHoraUtc,
          fechaHoraLocal: response.items[0].fechaHoraLocal,
        });
      }
      
      setMarcaciones(response.items || []);
    } catch (err) {
      console.error('Error fetching historial:', err);
      setError('No se pudo cargar el historial.');
      if (Platform.OS !== 'web') {
        Alert.alert('Error', 'No se pudo cargar el historial.');
      }
    } finally {
      setLoading(false);
    }
  }, [desde, hasta]);

  useEffect(() => {
    loadMarcaciones();
  }, [loadMarcaciones]);

  const showDatePicker = (mode: 'desde' | 'hasta') => {
    setPickerMode(mode);
    setDatePickerVisibility(true);
  };

  const hideDatePicker = () => setDatePickerVisibility(false);

  const handleConfirmDate = (date: Date) => {
    hideDatePicker();
    if (pickerMode === 'desde') {
      if (dayjs(date).isAfter(dayjs(hasta))) {
        setHasta(dayjs(date).endOf('day').toDate());
      }
      setDesde(dayjs(date).startOf('day').toDate());
    } else {
      if (dayjs(date).isBefore(dayjs(desde))) {
        setDesde(dayjs(date).startOf('day').toDate());
      }
      setHasta(dayjs(date).endOf('day').toDate());
    }
  };

  const handleWebDateChange = (event: any, mode: 'desde' | 'hasta') => {
    const val = event.target.value;
    if (!val) return;
    
    const dateObj = dayjs(val).toDate();
    if (mode === 'desde') {
      setDesde(dayjs(dateObj).startOf('day').toDate());
    } else {
      setHasta(dayjs(dateObj).endOf('day').toDate());
    }
  };

  /**
   * Formatea la fecha de la marcación usando fechaHoraLocal del backend
   */
  const formatMarcacionFecha = (item: Marcacion): string => {
    // Preferir fechaHoraLocal (ya convertida por el backend)
    const fecha = item.fechaHoraLocal || item.fechaHoraUtc;
    const parsed = parseBackendDate(fecha);
    return parsed?.format('DD/MM/YYYY HH:mm:ss') ?? '--';
  };

  /**
   * Formatea la hora de almuerzo
   */
  const formatAlmuerzoHora = (fecha: string | null | undefined): string => {
    if (!fecha) return '--';
    const parsed = parseBackendDate(fecha);
    return parsed?.format('HH:mm') ?? '--';
  };

  const renderItem = ({ item }: { item: Marcacion }) => (
    <ListItem bottomDivider containerStyle={styles.listItemContainer}>
      <Icon
        name={item.tipo === 'entrada' ? 'log-in-outline' : 'log-out-outline'}
        type="ionicon"
        color={item.tipo === 'entrada' ? CorporateColors.success : CorporateColors.primary}
      />
      <ListItem.Content>
        <ListItem.Title style={styles.itemTitle}>
          Marcación de {item.tipo === 'entrada' ? 'Entrada' : 'Salida'}
        </ListItem.Title>

        <ListItem.Subtitle style={styles.itemSubtitle}>
          {formatMarcacionFecha(item)}
        </ListItem.Subtitle>

        {item.tipo === 'entrada' && item.inicioAlmuerzoLocal && (
          <View style={styles.almuerzoInfoContainer}>
            <Icon name="fast-food" type="ionicon" size={16} color={CorporateColors.secondary} />
            <Text style={styles.almuerzoInfoText}>
              Almuerzo: {formatAlmuerzoHora(item.inicioAlmuerzoLocal)}
              {item.finAlmuerzoLocal && (
                <>
                  {' - '}
                  {formatAlmuerzoHora(item.finAlmuerzoLocal)}
                  {' '}
                  ({item.tiempoAlmuerzoMinutos} min)
                </>
              )}
              {!item.finAlmuerzoLocal && ' (en curso)'}
            </Text>
          </View>
        )}
      </ListItem.Content>
    </ListItem>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.container}>
        
        {/* === FILTROS DE FECHA === */}
        <Card containerStyle={styles.filtersCard}>
          {Platform.OS === 'web' ? (
            <View style={styles.webFiltersRow}>
              <View style={styles.webInputGroup}>
                <Text style={styles.webLabel}>Desde:</Text>
                {/* @ts-ignore */}
                <input
                  type="date"
                  value={dayjs(desde).format('YYYY-MM-DD')}
                  onChange={(e: any) => handleWebDateChange(e, 'desde')}
                  style={webInputStyle}
                />
              </View>
              <View style={styles.webInputGroup}>
                <Text style={styles.webLabel}>Hasta:</Text>
                {/* @ts-ignore */}
                <input
                  type="date"
                  value={dayjs(hasta).format('YYYY-MM-DD')}
                  onChange={(e: any) => handleWebDateChange(e, 'hasta')}
                  style={webInputStyle}
                />
              </View>
            </View>
          ) : (
            <View style={styles.filtersRow}>
              <Button
                title={`Desde: ${dayjs(desde).format('DD/MM/YYYY')}`}
                type="outline"
                onPress={() => showDatePicker('desde')}
                icon={<Icon name="calendar" type="ionicon" size={18} color={CorporateColors.primary} style={{ marginRight: 6 }} />}
                containerStyle={styles.filterBtn}
                buttonStyle={styles.filterBtnStyle}
                titleStyle={styles.filterBtnTitle}
              />
              <Button
                title={`Hasta: ${dayjs(hasta).format('DD/MM/YYYY')}`}
                type="outline"
                onPress={() => showDatePicker('hasta')}
                icon={<Icon name="calendar" type="ionicon" size={18} color={CorporateColors.primary} style={{ marginRight: 6 }} />}
                containerStyle={styles.filterBtn}
                buttonStyle={styles.filterBtnStyle}
                titleStyle={styles.filterBtnTitle}
              />
            </View>
          )}
        </Card>

        {error && !loading && <Text style={styles.errorText}>{error}</Text>}

        {loading && marcaciones.length === 0 ? (
          <ActivityIndicator size="large" color={CorporateColors.primary} style={{ marginTop: 50 }} />
        ) : (
          <FlatList
            data={marcaciones}
            renderItem={renderItem}
            keyExtractor={(item) => `marcacion-${item.id}`}
            style={styles.list}
            contentContainerStyle={{ paddingBottom: 24 }}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            refreshing={loading}
            onRefresh={loadMarcaciones}
            ListEmptyComponent={
              !loading ? <Text style={styles.emptyText}>No hay marcaciones en este rango.</Text> : null
            }
          />
        )}

        {Platform.OS !== 'web' && (
          <DateTimePickerModal
            isVisible={isDatePickerVisible}
            mode="date"
            onConfirm={handleConfirmDate}
            onCancel={hideDatePicker}
            date={pickerMode === 'desde' ? desde : hasta}
            accentColor={CorporateColors.primary}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const webInputStyle = {
  padding: 10,
  borderRadius: 8,
  border: `2px solid ${CorporateColors.primary}`,
  fontSize: 16,
  fontFamily: 'System',
  width: '100%',
  outline: 'none',
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: CorporateColors.background,
  },
  container: {
    flex: 1,
  },
  filtersCard: {
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  filtersRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  filterBtn: {
    flex: 1,
  },
  filterBtnStyle: {
    borderColor: CorporateColors.primary,
    borderWidth: 1.5,
    borderRadius: 10,
  },
  filterBtnTitle: {
    color: CorporateColors.primary,
    fontSize: 13,
  },
  webFiltersRow: {
    flexDirection: 'row',
    gap: 20,
    justifyContent: 'space-between',
    padding: 5,
  },
  webInputGroup: {
    flex: 1,
  },
  webLabel: {
    fontSize: 14,
    color: CorporateColors.textLight,
    marginBottom: 5,
    fontWeight: '600',
  },
  list: {
    flex: 1,
  },
  listItemContainer: {
    backgroundColor: CorporateColors.white,
  },
  itemTitle: {
    fontWeight: 'bold',
    textTransform: 'capitalize',
    fontSize: 16,
    color: CorporateColors.textDark,
  },
  itemSubtitle: {
    color: CorporateColors.textLight,
    fontSize: 13,
    marginTop: 2,
  },
  separator: {
    height: 1,
    backgroundColor: '#f0f0f0',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 40,
    fontSize: 16,
    color: CorporateColors.textLight,
  },
  errorText: {
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 4,
    fontSize: 14,
    color: CorporateColors.primaryDark,
  },
  almuerzoInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 6,
  },
  almuerzoInfoText: {
    fontSize: 12,
    color: '#92400e',
    fontWeight: '500',
  },
});
