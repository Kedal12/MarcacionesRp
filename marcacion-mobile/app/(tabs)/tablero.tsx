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
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

dayjs.locale('es');

// ✅ Colores corporativos "La Media Naranja"
const CorporateColors = {
  primary: '#e9501e',
  primaryDark: '#cc3625',
  secondary: '#fab626',
  white: '#ffffff',
  background: '#fff8f5',
  success: '#4caf50',
  error: '#D9534F',
  textDark: '#2d2d2d',
  textLight: '#6b7280',
};

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
  const valueColor = label === 'Sobretiempo' ? CorporateColors.success : CorporateColors.textDark;
  const showBadge = typeof rightBadge === 'number' && rightBadge > 0;

  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <View style={styles.statValueContainer}>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.statValue, { color: isZero ? CorporateColors.textLight : valueColor }]}>
            {value}
          </Text>
          {!!caption && (
            <Text style={styles.captionText}>{caption}</Text>
          )}
        </View>
        {showBadge && (
          <View style={styles.badgeContainer}>
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
            'ngrok-skip-browser-warning': 'true'
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
        <ActivityIndicator size="large" color={CorporateColors.primary} />
      </SafeAreaView>
    );
  }

  if (error && !resumen) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity onPress={fetchResumen} style={styles.retryButton}>
          <Text style={styles.retryText}>Reintentar</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (!resumen) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.noDataText}>No hay datos disponibles.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl 
            refreshing={isLoading} 
            onRefresh={fetchResumen}
            tintColor={CorporateColors.primary}
            colors={[CorporateColors.primary]}
          />
        }
      >
        {/* Header con info del usuario */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.name}>{resumen.nombreCompleto}</Text>
            {resumen.cargo && <Text style={styles.role}>{resumen.cargo}</Text>}
            {resumen.documento && <Text style={styles.id}>{resumen.documento}</Text>}
          </View>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>
              {resumen.nombreCompleto?.charAt(0)?.toUpperCase() || 'U'}
            </Text>
          </View>
        </View>

        {/* Período */}
        <View style={styles.periodoContainer}>
          <Text style={styles.periodo}>Datos del mes actual ({resumen.periodoActual})</Text>
        </View>
        
        {error && <Text style={styles.errorTextSmall}>{error}</Text>}

        {/* Stats */}
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

        {/* Footer con fecha de inicio */}
        {resumen.fechaInicioLaboral ? (
          <View style={styles.footer}>
            <Text style={styles.footerText}>Fecha de inicio laboral</Text>
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
  safeArea: { 
    flex: 1, 
    backgroundColor: CorporateColors.background,
  },
  centered: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: CorporateColors.background,
  },
  errorText: { 
    color: CorporateColors.primaryDark, 
    fontSize: 16, 
    padding: 20, 
    textAlign: 'center',
  },
  errorTextSmall: { 
    color: CorporateColors.primaryDark, 
    fontSize: 14, 
    textAlign: 'center', 
    marginVertical: 10,
  },
  noDataText: {
    color: CorporateColors.textLight,
    fontSize: 16,
  },
  retryButton: {
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: CorporateColors.primary,
    borderRadius: 8,
  },
  retryText: {
    color: CorporateColors.white,
    fontWeight: '600',
  },
  container: { 
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: CorporateColors.white,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerText: { 
    flex: 1, 
    marginRight: 15,
  },
  name: { 
    fontSize: 20, 
    fontWeight: 'bold', 
    color: CorporateColors.textDark,
  },
  role: { 
    fontSize: 15, 
    color: CorporateColors.textLight, 
    marginTop: 4,
  },
  id: { 
    fontSize: 14, 
    color: CorporateColors.textLight, 
    marginTop: 2,
  },
  avatarContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: CorporateColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: CorporateColors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  avatarText: {
    color: CorporateColors.white,
    fontSize: 24,
    fontWeight: '700',
  },
  periodoContainer: {
    backgroundColor: CorporateColors.white,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  periodo: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    fontSize: 14,
    color: CorporateColors.textDark,
    fontWeight: '600',
  },
  statsContainer: {
    backgroundColor: CorporateColors.white,
    marginTop: 10,
    borderRadius: 16,
    marginHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  statLabel: { 
    fontSize: 16, 
    color: CorporateColors.textDark,
  },
  statValueContainer: { 
    flexDirection: 'row', 
    alignItems: 'center',
  },
  statValue: { 
    fontSize: 16, 
    fontWeight: 'bold', 
    marginRight: 8,
  },
  captionText: {
    fontSize: 12,
    color: CorporateColors.textLight,
    marginTop: 2,
  },
  badgeContainer: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: CorporateColors.primary,
    marginLeft: 8,
  },
  badgeText: { 
    color: CorporateColors.white, 
    fontSize: 12, 
    fontWeight: 'bold',
  },
  footer: { 
    padding: 20, 
    marginTop: 20, 
    alignItems: 'center',
  },
  footerText: { 
    fontSize: 14, 
    color: CorporateColors.textLight,
  },
  footerDate: { 
    fontSize: 15, 
    fontWeight: '600', 
    color: CorporateColors.textDark, 
    marginTop: 4, 
    marginBottom: 30,
  },
});