// src/utils/date.ts
import dayjs, { Dayjs } from 'dayjs';
import 'dayjs/locale/es';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import relativeTime from 'dayjs/plugin/relativeTime';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(relativeTime);
dayjs.extend(customParseFormat);
dayjs.locale('es');

export const BOGOTA_TZ = 'America/Bogota';

/**
 * Obtiene la fecha/hora actual en zona horaria de Bogotá
 */
export function nowInBogota(): Dayjs {
  return dayjs().tz(BOGOTA_TZ);
}

/**
 * Convierte cualquier fecha (string SQL, ISO, Date) a un objeto Dayjs en zona horaria Bogotá.
 */
export function toLocal(value?: string | Date | null): Dayjs | null {
  if (!value) return null;

  let s = typeof value === 'string' ? value : (value as Date).toISOString();

  if (typeof s === 'string') {
    s = s.replace(' ', 'T');
  }

  s = s.replace(
    /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3})\d{4}([Zz]|[+-]\d{2}:\d{2})/,
    '$1$2'
  );

  const hasOffset = /([Zz]|[+-]\d{2}:\d{2})$/.test(s);
  try {
    const m = hasOffset ? dayjs(s) : dayjs.utc(s);
    return m.isValid() ? m.tz(BOGOTA_TZ) : null;
  } catch {
    return null;
  }
}

/**
 * Parsea una fecha del backend y la convierte a hora local de Bogotá.
 * MEJORADO: Detecta si la fecha ya tiene offset de Bogotá (-05:00) y no la convierte de nuevo
 */
export function parseBackendDate(value?: string | null): Dayjs | null {
  if (!value) return null;
  
  try {
    let s = String(value).trim();
    s = s.replace(' ', 'T');
    
    // Limpiar microsegundos excesivos
    s = s.replace(
      /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.)\d+([Zz]|[+-]\d{2}:\d{2})/,
      (_all, a, b) => a + '000' + b
    );
    s = s.replace(
      /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3})\d{4}([Zz]|[+-]\d{2}:\d{2})/,
      '$1$2'
    );
    
    // Si ya tiene offset de Bogotá (-05:00), parsear directamente sin convertir
    if (s.includes('-05:00') || s.includes('-0500')) {
      const parsed = dayjs(s);
      return parsed.isValid() ? parsed : null;
    }
    
    // Si termina con Z (UTC), convertir a Bogotá
    if (s.endsWith('Z')) {
      const parsed = dayjs.utc(s).tz(BOGOTA_TZ);
      return parsed.isValid() ? parsed : null;
    }
    
    // Si tiene otro offset, parsear y convertir a Bogotá
    if (s.match(/[+-]\d{2}:\d{2}$/)) {
      const parsed = dayjs(s).tz(BOGOTA_TZ);
      return parsed.isValid() ? parsed : null;
    }
    
    // Sin offset: asumir que ya está en hora de Bogotá
    const parsed = dayjs(s);
    return parsed.isValid() ? parsed : null;
    
  } catch (error) {
    console.error('[parseBackendDate] Error parseando fecha:', value, error);
    return null;
  }
}

/**
 * Helper para formatear fechas en texto legible
 */
export const formatearFecha = (fecha?: string, formato: string = 'DD MMM YYYY') => {
  const d = toLocal(fecha);
  return d && d.isValid() ? d.format(formato) : 'Fecha inválida';
};

/**
 * Helper para convertir minutos o string "HH:mm:ss" a "1h 30m"
 */
export const formatearDuracion = (valor?: string | number | null) => {
  if (!valor) return '0m';

  let horas = 0;
  let minutos = 0;

  if (typeof valor === 'string' && valor.includes(':')) {
    const d = dayjs(`2020-01-01T${valor}`);
    if (d.isValid()) {
      horas = d.hour();
      minutos = d.minute();
    }
  } else if (typeof valor === 'number' || !isNaN(Number(valor))) {
    const totalMins = Number(valor);
    horas = Math.floor(totalMins / 60);
    minutos = totalMins % 60;
  }

  if (horas === 0 && minutos === 0) return '0m';
  return horas > 0 ? `${horas}h ${minutos}m` : `${minutos}m`;
};

export function formatDateTime(dateValue: string | null | undefined, format: string = 'DD/MM/YYYY HH:mm:ss'): string {
  const parsed = parseBackendDate(dateValue);
  if (!parsed) return '--';
  return parsed.format(format);
}

export function formatTime(dateValue: string | null | undefined): string {
  const parsed = parseBackendDate(dateValue);
  if (!parsed) return '--';
  return parsed.format('HH:mm');
}

export function formatDate(dateValue: string | null | undefined): string {
  const parsed = parseBackendDate(dateValue);
  if (!parsed) return '--';
  return parsed.format('DD/MM/YYYY');
}

export { dayjs };
