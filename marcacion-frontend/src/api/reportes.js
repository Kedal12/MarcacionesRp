import api from "./axios";

/**
 * Obtiene los datos para el Reporte de Horas con RECARGOS incluidos.
 */
export const getHoras = async (params) => {
  console.log("=== getHoras DEBUG - INICIO ===");
  console.log("Params recibidos:", params);
  
  const cleanParams = {};
  if (params.numeroDocumento) {
    cleanParams.NumeroDocumento = params.numeroDocumento; 
  }
  if (params.idSede) cleanParams.idSede = parseInt(params.idSede);
  if (params.desde) cleanParams.desde = params.desde;
  if (params.hasta) cleanParams.hasta = params.hasta;

  console.log("cleanParams enviados:", cleanParams);
  console.log("URL: /api/reportes/horas");

  const { data } = await api.get("/api/reportes/horas", { params: cleanParams });
  
  console.log("=== RESPUESTA ===");
  console.log("Datos recibidos:", data);
  console.log("Cantidad de registros:", data?.length);
  
  // ✅ NUEVO: Verificar si los recargos vienen en la respuesta
  if (data?.length > 0) {
    console.log("Primer registro (muestra):", data[0]);
    console.log("¿Tiene recargos?", {
      horasExtraDiurnas: data[0]?.horasExtraDiurnas,
      horasExtraNocturnas: data[0]?.horasExtraNocturnas,
      horasRecargoNocturnoOrdinario: data[0]?.horasRecargoNocturnoOrdinario
    });
  }
  
  return data;
};

/**
 * Descarga el reporte de asistencia en formato Excel (.xlsx) con recargos.
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