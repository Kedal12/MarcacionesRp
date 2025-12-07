// En web usamos localStorage; aquí también agregamos compatibilidad con los nombres legacy
export const tokenCache = {
  async getToken(key: string) {
    try {
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem(key);
      }
      return null;
    } catch (e) {
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, value);
      }
    } catch (e) {
      console.error('Error guardando en web', e);
    }
  },
  async deleteToken(key: string) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(key);
      }
    } catch (e) {
      console.error('Error borrando en web', e);
    }
  },

  // --- Compatibilidad (legacy names) ---
  async getValueWithKeyAsync(key: string) {
    try {
      if (typeof localStorage !== 'undefined') return localStorage.getItem(key);
      return null;
    } catch (e) {
      return null;
    }
  },
  async setValueWithKeyAsync(key: string, value: string) {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
    } catch (e) {
      console.error('Error guardando (legacy) en web', e);
    }
  },
  async deleteValueWithKeyAsync(key: string) {
    try {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
    } catch (e) {
      console.error('Error borrando (legacy) en web', e);
    }
  },
};

export default tokenCache;
