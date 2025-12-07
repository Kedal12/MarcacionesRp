import * as SecureStore from 'expo-secure-store';

export const tokenCache = {
  // API moderna que usas en tu proyecto
  async getToken(key: string) {
    return await SecureStore.getItemAsync(key);
  },
  async saveToken(key: string, value: string) {
    await SecureStore.setItemAsync(key, value);
  },
  async deleteToken(key: string) {
    await SecureStore.deleteItemAsync(key);
  },

  // --- Compatibilidad (legacy names) ---
  // Algunas librerías o código antiguo podrían llamar a estas.
  async getValueWithKeyAsync(key: string) {
    return await SecureStore.getItemAsync(key);
  },
  async setValueWithKeyAsync(key: string, value: string) {
    return await SecureStore.setItemAsync(key, value);
  },
  async deleteValueWithKeyAsync(key: string) {
    return await SecureStore.deleteItemAsync(key);
  },
};

// export default para cubrir imports por defecto (p. ej. require() o import X from ...)
export default tokenCache;
