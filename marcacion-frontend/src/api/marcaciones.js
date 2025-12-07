import api from "./axios";

export async function getMarcaciones(params = {}) {
  const cleanParams = { ...params };

  // Mapeo seguro para el Backend
  if (params.numeroDocumento) {
    cleanParams.NumeroDocumento = params.numeroDocumento;
    // Eliminamos la versión camelCase para no ensuciar la URL
    delete cleanParams.numeroDocumento;
  }

  const { data } = await api.get("/api/marcaciones", { params: cleanParams });
  return data; 
}