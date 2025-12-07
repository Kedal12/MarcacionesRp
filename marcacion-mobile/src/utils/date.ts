// src/utils/date.ts
import dayjs, { Dayjs } from 'dayjs';
import 'dayjs/locale/es';
import customParseFormat from 'dayjs/plugin/customParseFormat'; // ✅ Necesario para parsear horas custom
import relativeTime from 'dayjs/plugin/relativeTime';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(relativeTime);
dayjs.extend(customParseFormat);
dayjs.locale('es');

export const BOGOTA_TZ = 'America/Bogota';

export function nowInBogota(): Dayjs {
  return dayjs().tz(BOGOTA_TZ);
}

/**
 * Convierte cualquier fecha (string SQL, ISO, Date) a un objeto Dayjs en zona horaria Bogotá.
 * ✅ CORREGIDO: Maneja fechas con espacio en lugar de 'T' para Web.
 */
export function toLocal(value?: string | Date | null): Dayjs | null {
  if (!value) return null;

  let s = typeof value === 'string' ? value : (value as Date).toISOString();

  // 1. CORRECCIÓN CRÍTICA PARA WEB:
  // Si viene "2025-12-06 10:00:00", lo convertimos a "2025-12-06T10:00:00"
  // Antes de que entren tus Regex, aseguramos que sea ISO compatible.
  if (typeof s === 'string') {
    s = s.replace(' ', 'T');
  }

  // 2. Tu lógica original de recorte de microsegundos
  // (Ahora funcionará bien porque ya garantizamos la 'T')
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

export function parseBackendDate(value?: string | null): Dayjs | null {
  if (!value) return null;
  // Aplicamos la misma limpieza inicial
  let s = value.replace(' ', 'T');
  
  s = s.replace(
    /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.)\d+([Zz]|[+-]\d{2}:\d{2})/,
    (_all, a, b) => a + '000' + b
  );
  s = s.replace(
    /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3})\d{4}([Zz]|[+-]\d{2}:\d{2})/,
    '$1$2'
  );
  return toLocal(s);
}

/**
 * ✅ NUEVO: Helper para formatear fechas en texto legible
 * Uso: formatearFecha(item.fecha, 'DD MMM') -> "06 Dic"
 */
export const formatearFecha = (fecha?: string, formato: string = 'DD MMM YYYY') => {
  const d = toLocal(fecha);
  return d && d.isValid() ? d.format(formato) : 'Fecha inválida';
};

/**
 * ✅ NUEVO: Helper para convertir minutos o string "HH:mm:ss" a "1h 30m"
 * Soluciona el error "NaNm" en las tardanzas.
 */
export const formatearDuracion = (valor?: string | number | null) => {
  if (!valor) return '0m';

  let horas = 0;
  let minutos = 0;

  // Caso 1: Viene como string "01:30:00" (SQL TimeSpan)
  if (typeof valor === 'string' && valor.includes(':')) {
    // Truco: Usamos una fecha base para que dayjs parseé la hora
    const d = dayjs(`2020-01-01T${valor}`);
    if (d.isValid()) {
      horas = d.hour();
      minutos = d.minute();
    }
  } 
  // Caso 2: Viene como número (ej: 90 minutos)
  else if (typeof valor === 'number' || !isNaN(Number(valor))) {
    const totalMins = Number(valor);
    horas = Math.floor(totalMins / 60);
    minutos = totalMins % 60;
  }

  if (horas === 0 && minutos === 0) return '0m';
  return horas > 0 ? `${horas}h ${minutos}m` : `${minutos}m`;
};

export { dayjs };
