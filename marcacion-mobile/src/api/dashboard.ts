// src/api/dashboard.ts
import axios from './axios';

export interface TardanzaDetalle {
  fecha: string;          // "YYYY-MM-DDTHH:mm..." o Date
  diaSemana: string;
  horaEsperada: string;   // "HH:mm:ss"
  horaLlegada: string;    // "HH:mm:ss"
  minutosTarde: string;   // "HH:mm:ss"
  compensada: boolean;
}

export interface AusenciaDetalle {
  id: number;
  tipo: string;
  desde: string;  // "YYYY-MM-DD"
  hasta: string;  // "YYYY-MM-DD"
  observacion?: string | null;
}

export async function getTardanzasDetalleMes(): Promise<TardanzaDetalle[]> {
  const { data } = await axios.get('/api/dashboard/tardanzas-detalle-mes');
  return data;
}

export async function getAusenciasDetalleMes(): Promise<AusenciaDetalle[]> {
  const { data } = await axios.get('/api/dashboard/ausencias-detalle-mes');
  return data;
}
