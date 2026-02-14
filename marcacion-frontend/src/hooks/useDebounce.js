import { useState, useEffect } from "react";

/**
 * Hook para retrasar la actualización de un valor.
 * @param {any} value - El valor que cambia frecuentemente (ej. el texto de un input).
 * @param {number} delay - Tiempo en milisegundos a esperar.
 */
export function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}