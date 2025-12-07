// app/tardanzas.tsx

import { formatearDuracion, parseBackendDate } from '@/src/utils/date';
import { tokenCache } from '@/src/utils/tokenStorage';
import axios from 'axios';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import Constants from 'expo-constants';
import { Stack, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

dayjs.locale('es');

type Item = {
  fecha: string;
  diaSemana: string;
  horaEsperada: string;
  horaLlegada: string;
  minutosTarde: string;
  compensada: boolean;
};

export default function TardanzasScreen() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setErr(null);

      const token = await tokenCache.getToken('auth-token');
      if (!token) throw new Error('No hay token de autenticación');

      const API_URL = Constants.expoConfig?.extra?.apiUrl;
      if (!API_URL) throw new Error('La URL de la API no está configurada');

      const { data } = await axios.get(`${API_URL}/api/dashboard/tardanzas-detalle-mes`, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'ngrok-skip-browser-warning': 'true' // Para ngrok
        },
      });

      let payload: any[] = [];
      if (Array.isArray(data)) {
        payload = data;
      } else if (data && Array.isArray(data.items)) {
        payload = data.items;
      } else if (data && typeof data === 'object' && Object.keys(data).length === 0) {
        payload = [];
      } else {
        payload = data ? [data] : [];
      }

      const normalized: Item[] = payload.map((it: any) => {
        return {
          fecha: it.fecha ?? it.date ?? '',
          diaSemana: it.diaSemana ?? it.dayName ?? '',
          horaEsperada: it.horaEsperada ?? it.hora_esperada ?? it.expectedTime ?? '',
          horaLlegada: it.horaLlegada ?? it.hora_llegada ?? it.arrivalTime ?? '',
          minutosTarde:
            typeof it.minutosTarde === 'number'
              ? `${it.minutosTarde}`
              : it.minutosTarde ?? it.minutesLate ?? '0',
          compensada: !!(it.compensada ?? it.compensated ?? false),
        };
      });

      setItems(normalized);
    } catch (e: any) {
      console.error('❌ Error cargando tardanzas:', e);
      const msg = e?.response?.data || e?.message || 'No se pudo cargar';
      setErr(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Detalle de Tardanzas',
          headerShown: true,
          headerBackTitle: 'Volver',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ paddingLeft: 10 }}>
              <Text style={{ color: '#007AFF', fontSize: 17 }}>← Volver</Text>
            </TouchableOpacity>
          ),
        }}
      />

      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
        {loading && (
          <View style={s.center}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={{ marginTop: 10, color: '#666' }}>Cargando tardanzas...</Text>
          </View>
        )}

        {!loading && err && (
          <View style={s.center}>
            <Text style={{ color: 'red', fontSize: 16 }}>⚠️ {err}</Text>
            <TouchableOpacity onPress={load} style={{ marginTop: 20 }}>
              <Text style={{ color: '#007AFF', fontSize: 16 }}>Reintentar</Text>
            </TouchableOpacity>
          </View>
        )}

        {!loading && !err && items.length === 0 && (
          <View style={s.center}>
            <Text style={{ fontSize: 40, marginBottom: 10 }}>🎉</Text>
            <Text style={{ color: '#999', fontSize: 16 }}>¡Perfecto! No hay tardanzas</Text>
          </View>
        )}

        {!loading && !err && items.length > 0 && (
          <FlatList
            data={items}
            keyExtractor={(it, i) => `${it.fecha}-${i}`}
            ItemSeparatorComponent={() => <View style={s.sep} />}
            renderItem={({ item }) => (
              <View style={s.row}>
                <View style={{ flex: 1 }}>
                  {/* ✅ Usando parseBackendDate para arreglar INVALID DATE */}
                  <Text style={s.title}>
                    {parseBackendDate(item.fecha)?.format('ddd DD MMM').toUpperCase() ?? 'FECHA INVÁLIDA'}
                  </Text>
                  <Text style={s.sub}>
                    Esperada {item.horaEsperada} · Llegada {item.horaLlegada}
                  </Text>
                  {item.compensada && (
                    <View style={s.compensatedBadge}>
                      <Text style={s.compensatedText}>✓ Compensada con tiempo extra</Text>
                    </View>
                  )}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <View
                    style={[
                      s.badge,
                      { backgroundColor: item.compensada ? '#28A745' : '#D9534F' },
                    ]}
                  >
                    {/* ✅ Usando formatearDuracion para arreglar NaNm */}
                    <Text style={s.badgeText}>
                      {item.compensada ? '✓ Comp.' : formatearDuracion(item.minutosTarde)}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          />
        )}
      </SafeAreaView>
    </>
  );
}

const s = StyleSheet.create({
  center: { 
    flex: 1, 
    alignItems: 'center', 
    justifyContent: 'center', 
    backgroundColor: '#fff',
    padding: 20 
  },
  row: { 
    padding: 16, 
    flexDirection: 'row', 
    alignItems: 'center',
    backgroundColor: '#fff'
  },
  sep: { height: 1, backgroundColor: '#eee' },
  title: { fontWeight: '600', fontSize: 15, color: '#111' },
  sub: { color: '#666', marginTop: 4 },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    minWidth: 60,
    alignItems: 'center'
  },
  badgeText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  compensatedBadge: {
    marginTop: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#E8F5E9',
    borderRadius: 6,
    alignSelf: 'flex-start'
  },
  compensatedText: { color: '#28A745', fontSize: 12, fontWeight: '600' }
});