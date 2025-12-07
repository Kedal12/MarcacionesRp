// app/tabs/historial.tsx

import { getMisMarcaciones, type Marcacion } from '@/src/api/marcaciones';
// ✅ IMPORTANTE: Importamos dayjs configurado y el parser seguro
import { dayjs, parseBackendDate } from '@/src/utils/date';
import { Button, Card, Icon, ListItem, Text } from '@rneui/themed';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform, // ✅ Necesario para detectar si es Web
  StyleSheet,
  View
} from 'react-native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { SafeAreaView } from 'react-native-safe-area-context';

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
      setMarcaciones(response.items || []);
    } catch (err) {
      console.error('Error fetching historial:', err);
      setError('No se pudo cargar el historial.');
      // En Web, Alert.alert es feo, mejor un console o un toast custom, pero lo dejamos por ahora
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

  // --- LÓGICA MÓVIL (Modal) ---
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

  // --- LÓGICA WEB (Input HTML) ---
  const handleWebDateChange = (event: any, mode: 'desde' | 'hasta') => {
    const val = event.target.value; // Viene como "YYYY-MM-DD"
    if (!val) return;
    
    const dateObj = dayjs(val).toDate();
    if (mode === 'desde') {
      setDesde(dayjs(dateObj).startOf('day').toDate());
    } else {
      setHasta(dayjs(dateObj).endOf('day').toDate());
    }
  };

  const renderItem = ({ item }: { item: Marcacion }) => (
    <ListItem key={item.id} bottomDivider containerStyle={styles.listItemContainer}>
      <Icon
        name={item.tipo === 'entrada' ? 'log-in-outline' : 'log-out-outline'}
        type="ionicon"
        color={item.tipo === 'entrada' ? 'green' : 'orange'}
      />
      <ListItem.Content>
        <ListItem.Title style={styles.itemTitle}>
          Marcación de {item.tipo === 'entrada' ? 'Entrada' : 'Salida'}
        </ListItem.Title>

        {/* ✅ SOLUCIÓN LISTA: Usamos parseBackendDate para evitar 'Invalid Date' en Web */}
        <ListItem.Subtitle style={styles.itemSubtitle}>
          {parseBackendDate(item.fechaHoraLocal)?.format('DD/MM/YYYY HH:mm:ss') ?? '--'}
        </ListItem.Subtitle>

        {item.tipo === 'entrada' && item.inicioAlmuerzoLocal && (
          <View style={styles.almuerzoInfoContainer}>
            <Icon name="fast-food" type="ionicon" size={16} color="#f59e0b" />
            <Text style={styles.almuerzoInfoText}>
              Almuerzo: {parseBackendDate(item.inicioAlmuerzoLocal)?.format('HH:mm')}
              {item.finAlmuerzoLocal && (
                <>
                  {' - '}
                  {parseBackendDate(item.finAlmuerzoLocal)?.format('HH:mm')}
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
            // ✅ MODO WEB: Usamos inputs HTML nativos
            <View style={styles.webFiltersRow}>
              <View style={styles.webInputGroup}>
                <Text style={styles.webLabel}>Desde:</Text>
                {/* @ts-ignore: React Native Web soporta inputs HTML */}
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
            // ✅ MODO MÓVIL: Usamos tus botones y modal originales
            <View style={styles.filtersRow}>
              <Button
                title={`Desde: ${dayjs(desde).format('DD/MM/YYYY')}`}
                type="outline"
                onPress={() => showDatePicker('desde')}
                icon={<Icon name="calendar" type="ionicon" size={18} iconStyle={{ marginRight: 6 }} />}
                containerStyle={styles.filterBtn}
              />
              <Button
                title={`Hasta: ${dayjs(hasta).format('DD/MM/YYYY')}`}
                type="outline"
                onPress={() => showDatePicker('hasta')}
                icon={<Icon name="calendar" type="ionicon" size={18} iconStyle={{ marginRight: 6 }} />}
                containerStyle={styles.filterBtn}
              />
            </View>
          )}
        </Card>

        {error && !loading && <Text style={styles.errorText}>{error}</Text>}

        {loading && marcaciones.length === 0 ? (
          <ActivityIndicator size="large" color="#007AFF" style={{ marginTop: 50 }} />
        ) : (
          <FlatList
            data={marcaciones}
            renderItem={renderItem}
            keyExtractor={(item) => item.id.toString()}
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

        {/* ✅ SOLUCIÓN CRASH: Solo renderizamos el Modal si NO estamos en Web */}
        {Platform.OS !== 'web' && (
          <DateTimePickerModal
            isVisible={isDatePickerVisible}
            mode="date"
            onConfirm={handleConfirmDate}
            onCancel={hideDatePicker}
            date={pickerMode === 'desde' ? desde : hasta}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

// Estilos CSS-in-JS para los inputs web
const webInputStyle = {
  padding: 10,
  borderRadius: 5,
  border: '1px solid #ccc',
  fontSize: 16,
  fontFamily: 'System',
  width: '100%',
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  container: {
    flex: 1,
  },
  filtersCard: {
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 16,
  },
  filtersRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  filterBtn: {
    flex: 1,
  },
  // Estilos para la versión web
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
    color: '#666',
    marginBottom: 5,
  },
  list: {
    flex: 1,
  },
  listItemContainer: {
    backgroundColor: '#fff',
  },
  itemTitle: {
    fontWeight: 'bold',
    textTransform: 'capitalize',
    fontSize: 16,
  },
  itemSubtitle: {
    color: 'grey',
    fontSize: 13,
    marginTop: 2,
  },
  separator: {
    height: 1,
    backgroundColor: '#eee',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 40,
    fontSize: 16,
    color: 'grey',
  },
  errorText: {
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 4,
    fontSize: 14,
    color: 'red',
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