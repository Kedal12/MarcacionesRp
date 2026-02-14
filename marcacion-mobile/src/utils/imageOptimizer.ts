// src/utils/imageOptimizer.ts
import * as ImageManipulator from 'expo-image-manipulator';

/**
 * Configuración de compresión de imágenes
 */
const CONFIG = {
  MAX_WIDTH: 640,
  MAX_HEIGHT: 480,
  QUALITY: 0.6,
  MAX_SIZE_KB: 150,
} as const;

export interface OptimizedImage {
  uri: string;
  base64: string;
  sizeKB: number;
}

/**
 * Optimiza una imagen para envío rápido
 * Reduce resolución a 640x480 y comprime a ~100-150KB
 */
export const optimizarImagen = async (uri: string): Promise<OptimizedImage> => {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [
      {
        resize: {
          width: CONFIG.MAX_WIDTH,
          height: CONFIG.MAX_HEIGHT,
        },
      },
    ],
    {
      compress: CONFIG.QUALITY,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    }
  );

  const sizeBytes = result.base64 ? (result.base64.length * 3) / 4 : 0;
  const sizeKB = Math.round(sizeBytes / 1024);

  console.log(`[ImageOptimizer] Optimizada: ${sizeKB}KB`);

  return {
    uri: result.uri,
    base64: result.base64 ?? '',
    sizeKB,
  };
};

/**
 * Compresión agresiva para conexiones lentas
 */
export const comprimirAgresivo = async (
  uri: string,
  targetSizeKB: number = 80
): Promise<OptimizedImage> => {
  let quality = 0.5;
  let result: ImageManipulator.ImageResult | null = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 480, height: 360 } }],
      {
        compress: quality,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true,
      }
    );

    const sizeBytes = result.base64 ? (result.base64.length * 3) / 4 : 0;
    const sizeKB = Math.round(sizeBytes / 1024);

    if (sizeKB <= targetSizeKB) {
      return { uri: result.uri, base64: result.base64 ?? '', sizeKB };
    }

    quality -= 0.1;
  }

  const finalSizeKB = Math.round(((result?.base64?.length ?? 0) * 3) / 4 / 1024);
  return { 
    uri: result?.uri ?? uri, 
    base64: result?.base64 ?? '', 
    sizeKB: finalSizeKB 
  };
};

/**
 * Valida que una imagen sea usable
 */
export const validarImagen = (base64: string): boolean => {
  if (!base64 || typeof base64 !== 'string' || base64.length < 1000) {
    return false;
  }
  return /^[A-Za-z0-9+/]+=*$/.test(base64.substring(0, 100));
};
