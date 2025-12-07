// ARCHIVO: app/(tabs)/tablero.tsx

import { formatearFecha } from '@/src/utils/date';
import { tokenCache } from '@/src/utils/tokenStorage';
import axios from 'axios';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

dayjs.locale('es');

const ROUTES = {
  ausencias: '/ausencias',
  tardanzas: '/tardanzas',
} as const;

interface ResumenMensual {
  nombreCompleto: string;
  cargo: string;
  documento: string;
  fechaInicioLaboral: string;
  periodoActual: string;
  totalAusencias: number;
  totalTardanzas: number;
  totalDescansosExtendidos: number;
  totalRetirosTempranos: number;
  sobretiempo: string;
  tardanzasCompensadas?: number;
  tiempoTotalTardanzas?: number;
}

const formatTime = (mins?: number) => {
  if (!mins || mins <= 0) return '0m';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const StatRowBase = ({
  label,
  value,
  caption,
  rightBadge,
}: {
  label: string;
  value: string | number;
  caption?: string;
  rightBadge?: number | null;
}) => {
  const isZero =
    typeof value === 'number' ? value === 0 : value === '00:00' || value === '0' || value === '0m';
  const valueColor = label === 'Sobretiempo' ? '#28A745' : '#000';
  const showBadge = typeof rightBadge === 'number' && rightBadge > 0;

  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <View style={styles.statValueContainer}>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.statValue, { color: isZero ? '#888' : valueColor }]}>{value}</Text>
          {!!caption && (
            <Text style={{ fontSize: 12, color: '#666', marginTop: 2 }}>{caption}</Text>
          )}
        </View>
        {showBadge && (
          <View style={[styles.badgeContainer, { backgroundColor: '#D9534F', marginLeft: 8 }]}>
            <Text style={styles.badgeText}>{rightBadge}</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const StatRowLink = ({
  onPress,
  ...rest
}: React.ComponentProps<typeof StatRowBase> & { onPress: () => void }) => {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75}>
      <StatRowBase {...rest} />
    </TouchableOpacity>
  );
};

export default function TableroScreen() {
  const [resumen, setResumen] = useState<ResumenMensual | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchResumen = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const token = await tokenCache.getToken('auth-token');
      if (!token) throw new Error('No hay token de autenticación');

      const API_URL = Constants.expoConfig?.extra?.apiUrl as string | undefined;
      if (!API_URL) throw new Error('La URL de la API no está configurada');

      const { data } = await axios.get<ResumenMensual>(
        `${API_URL}/api/dashboard/resumen-mensual-usuario`,
        { 
          headers: { 
            Authorization: `Bearer ${token}`,
            'ngrok-skip-browser-warning': 'true' // Para ngrok
          } 
        }
      );

      setResumen(data);
    } catch (err: any) {
      console.error('Error al cargar resumen:', err);
      setError(err?.message ?? 'No se pudo cargar el resumen.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchResumen();
  }, []);

  if (isLoading && !resumen) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  if (error && !resumen) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity onPress={fetchResumen}>
          <Text style={{ color: 'blue' }}>Reintentar</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (!resumen) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text>No hay datos disponibles.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={fetchResumen} />}
      >
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.name}>{resumen.nombreCompleto}</Text>
            {resumen.cargo && <Text style={styles.role}>{resumen.cargo}</Text>}
            {resumen.documento && <Text style={styles.id}>{resumen.documento}</Text>}
          </View>
          <Image source={{ uri: 'https://via.placeholder.com/60' }} style={styles.profilePic} />
        </View>

        <Text style={styles.periodo}>Datos del mes actual ({resumen.periodoActual})</Text>
        {error && <Text style={styles.errorTextSmall}>{error}</Text>}

        <View style={styles.statsContainer}>
          <StatRowLink
            label="Ausencias"
            value={resumen.totalAusencias}
            rightBadge={resumen.totalAusencias}
            onPress={() => router.push(ROUTES.ausencias)}
          />

          <StatRowLink
            label="Tardanzas"
            value={resumen.totalTardanzas}
            rightBadge={resumen.totalTardanzas}
            caption={
              (resumen.tardanzasCompensadas ?? 0) > 0
                ? `${resumen.tardanzasCompensadas} compensadas`
                : formatTime(resumen.tiempoTotalTardanzas)
            }
            onPress={() => router.push(ROUTES.tardanzas)}
          />

          <StatRowBase label="Descansos extendidos" value={resumen.totalDescansosExtendidos} />
          <StatRowBase
            label="Retiros tempranos"
            value={resumen.totalRetirosTempranos}
            rightBadge={resumen.totalRetirosTempranos}
          />
          <StatRowBase label="Sobretiempo" value={resumen.sobretiempo} />
        </View>

        {resumen.fechaInicioLaboral ? (
          <View style={styles.footer}>
            <Text style={styles.footerText}>Fecha de inicio laboral</Text>
            {/* ✅ Usando formatearFecha para arreglar el parseo en web */}
            <Text style={styles.footerDate}>
              {formatearFecha(resumen.fechaInicioLaboral, 'DD [de] MMMM [de] YYYY')}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F9F9F9' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9F9F9' },
  errorText: { color: 'red', fontSize: 16, padding: 20, textAlign: 'center' },
  errorTextSmall: { color: 'red', fontSize: 14, textAlign: 'center', marginVertical: 10 },
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  headerText: { flex: 1, marginRight: 15 },
  name: { fontSize: 18, fontWeight: 'bold', color: '#111' },
  role: { fontSize: 15, color: '#555', marginTop: 2 },
  id: { fontSize: 14, color: '#777', marginTop: 2 },
  profilePic: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#EEE' },
  periodo: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  statsContainer: {
    backgroundColor: '#FFF',
    marginTop: 10,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  statLabel: { fontSize: 16, color: '#333' },
  statValueContainer: { flexDirection: 'row', alignItems: 'center' },
  statValue: { fontSize: 16, fontWeight: 'bold', marginRight: 8 },
  badgeContainer: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  footer: { padding: 20, marginTop: 20, alignItems: 'center' },
  footerText: { fontSize: 14, color: '#777' },
  footerDate: { fontSize: 15, fontWeight: '600', color: '#555', marginTop: 4, marginBottom: 30 },
});
