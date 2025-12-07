import api from "./axios";

/**
 * Obtiene los datos para el Reporte de Horas (visualización en pantalla).
 */
export const getHoras = async (params) => {
  // ✅ LOGS ANTES DE PROCESAR
  console.log("=== getHoras DEBUG - INICIO ===");
  console.log("Params recibidos:", params);
  
  const cleanParams = {};
  if (params.numeroDocumento) {
      cleanParams.NumeroDocumento = params.numeroDocumento; 
  }
  if (params.idSede) cleanParams.idSede = parseInt(params.idSede);
  if (params.desde) cleanParams.desde = params.desde;
  if (params.hasta) cleanParams.hasta = params.hasta;

  // ✅ LOGS DESPUÉS DE LIMPIAR
  console.log("cleanParams enviados:", cleanParams);
  console.log("URL que se va a llamar: /api/reportes/horas");
  console.log("====================");

  const { data } = await api.get("/api/reportes/horas", { params: cleanParams });
  
  // ✅ LOGS DE LA RESPUESTA
  console.log("=== RESPUESTA ===");
  console.log("Datos recibidos:", data);
  console.log("Cantidad de registros:", data?.length);
  console.log("=================");
  
  return data;
};

/**
 * Descarga el reporte de asistencia en formato Excel (.xlsx).
 */
export const descargarExcelAsistencia = async (params) => {
  const cleanParams = {};

  if (params.numeroDocumento?.trim()) {
    cleanParams.numeroDocumento = params.numeroDocumento.trim();
  }
  
  if (params.idSede) {
    cleanParams.idSede = parseInt(params.idSede);
  }

  if (params.desde) cleanParams.desde = params.desde;
  if (params.hasta) cleanParams.hasta = params.hasta;

  try {
    const response = await api.get("/api/reportes/exportar-excel", {
      params: cleanParams,
      responseType: 'blob',
      timeout: 60000
    });

    return response;
  } catch (error) {
    console.error("Error en descargarExcelAsistencia:", error);
    console.error("Params enviados:", cleanParams);
    throw error;
  }
};
