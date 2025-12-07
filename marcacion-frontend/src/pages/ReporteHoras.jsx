import { useEffect, useState, useMemo } from "react";
import { Paper, Stack, TextField, Button, Table, TableHead, TableRow, TableCell, TableBody, TableContainer, CircularProgress, Alert, Typography, Box, IconButton, Tooltip, FormControl, InputLabel, Select, MenuItem } from "@mui/material"; 
import { DatePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { getHoras, descargarExcelAsistencia } from "../api/reportes"; 
import { useSnackbar } from "notistack";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import ReplayIcon from "@mui/icons-material/Replay";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import { useAuth } from "../auth/AuthContext";
import { getSedes } from "../api/sedes"; 

const ROLES = {
  SUPERADMIN: "superadmin",
  ADMIN: "admin"
};

dayjs.extend(utc);
dayjs.extend(timezone);

const formatDateTime = (dateTimeOffsetString) => {
  if (!dateTimeOffsetString) return "-";
  try {
    return dayjs(dateTimeOffsetString).tz(dayjs.tz.guess()).format("HH:mm:ss");
  } catch (error) {
    console.error("Error formateando fecha/hora:", error);
    return "-";
  }
};

const formatDate = (dateOnlyString) => {
  if (!dateOnlyString) return "-";
  try {
    return dayjs(dateOnlyString).format("DD/MM/YYYY");
  } catch (error) {
    console.error("Error formateando fecha:", error);
    return "-";
  }
};

const formatNumber = (value, decimals = 2) => {
  if (value === null || value === undefined || isNaN(value)) return "0";
  return Number(value).toFixed(decimals);
};

export default function ReporteHoras() {
  const { user } = useAuth();
  const isSuperAdmin = useMemo(() => user?.rol === ROLES.SUPERADMIN, [user]);

  const [desde, setDesde] = useState(dayjs().startOf("month"));
  const [hasta, setHasta] = useState(dayjs().endOf("month"));
  
  // ✅ CAMBIO: Separar el input del filtro aplicado
  const [numeroDocumentoInput, setNumeroDocumentoInput] = useState(""); 
  const [numeroDocumentoFiltro, setNumeroDocumentoFiltro] = useState(""); 
  
  const [idSede, setIdSede] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { enqueueSnackbar } = useSnackbar();
  const [exporting, setExporting] = useState(false);
  
  const [sedesList, setSedesList] = useState([]);
  const [loadingSedes, setLoadingSedes] = useState(false);

  useEffect(() => {
    if (isSuperAdmin) { 
      setLoadingSedes(true);
      getSedes({ page: 1, pageSize: 1000 })
        .then(data => {
          setSedesList(data?.items || []);
        })
        .catch((err) => {
          console.error("Error cargando sedes:", err);
          enqueueSnackbar("Error cargando lista de sedes", { variant: "error" });
          setSedesList([]);
        })
        .finally(() => setLoadingSedes(false));
    }
  }, [isSuperAdmin, enqueueSnackbar]);

  useEffect(() => {
    if (user && !isSuperAdmin) {
      setIdSede(String(user.idSede || ""));
    }
  }, [user, isSuperAdmin]);

  // ✅ CAMBIO: query ahora usa numeroDocumentoFiltro (no el input)
  const query = useMemo(() => {
    const p = {};
    if (desde) p.desde = dayjs(desde).startOf('day').utc().toISOString();
    if (hasta) p.hasta = dayjs(hasta).endOf('day').utc().toISOString();
    
    if (numeroDocumentoFiltro.trim()) {
      p.numeroDocumento = numeroDocumentoFiltro.trim();
    }

    if (idSede) p.idSede = Number(idSede);
    return p;
  }, [desde, hasta, idSede, numeroDocumentoFiltro]);

  const load = (filtrosActivos) => {
    // Si es admin y no hay sede ni documento, no cargamos nada
    if (user?.rol === ROLES.ADMIN && !filtrosActivos?.idSede) {
        return; 
    }

    setLoading(true);
    setError(null);
    setRows([]); 
    
    getHoras(filtrosActivos) 
      .then(data => {
        if (Array.isArray(data)) {
          setRows(data);
        } else {
          setRows([]);
        }
      })
      .catch(e => {
        console.error("Error:", e);
        setError("Error al cargar datos");
        setRows([]);
      })
      .finally(() => {
        setLoading(false);
      });
  };
  // ✅ CAMBIO: Solo recarga cuando cambian fechas o sede
  useEffect(() => {
    console.log("=== useEffect EJECUTADO - RECARGANDO ===");
    console.log("Enviando filtros:", query); // <--- Verifica en consola que esto tenga el documento
    load(query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // ✅ NUEVO: Función para aplicar el filtro de documento
// Línea 143 - REEMPLAZA la función aplicarFiltroDocumento:
function aplicarFiltroDocumento() {
    // SOLO actualizamos el estado.
    // Esto cambiará 'numeroDocumentoFiltro' -> cambiará 'query' -> disparará 'useEffect'
    setNumeroDocumentoFiltro(numeroDocumentoInput);
  }
  // ✅ CAMBIO: Limpiar también resetea el filtro aplicado
  function limpiarFiltros() {
    if (!isSuperAdmin) {
      setIdSede(String(user?.idSede || "")); 
    } else {
      setIdSede(""); 
    }
    setNumeroDocumentoInput("");
    setNumeroDocumentoFiltro("");
    setDesde(dayjs().startOf("month"));
    setHasta(dayjs().endOf("month"));
  }

  // ✅ NUEVO: Permitir buscar con Enter
  function handleKeyPress(e) {
    if (e.key === 'Enter') {
      aplicarFiltroDocumento();
    }
  }

  async function exportExcel() {
    setExporting(true);
    try {
      const params = {
        numeroDocumento: numeroDocumentoFiltro.trim() || undefined,
        idSede: idSede ? Number(idSede) : undefined,
        desde: dayjs(desde).startOf('day').utc().toISOString(),
        hasta: dayjs(hasta).endOf('day').utc().toISOString()
      };

      const response = await descargarExcelAsistencia(params);

      if (!response || !response.data) {
        throw new Error("Respuesta vacía del servidor");
      }

      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      const today = dayjs().format("YYYY-MM-DD");
      const fileName = numeroDocumentoFiltro.trim() 
        ? `Reporte_${numeroDocumentoFiltro.trim()}_${today}.xlsx`
        : `Reporte_Global_${today}.xlsx`;
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      
      enqueueSnackbar("Reporte Excel descargado exitosamente", { variant: "success" });
    } catch (e) {
      console.error("Error exportando Excel:", e);
      enqueueSnackbar(e?.message || "Error al generar el Excel", { variant: "error" });
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <Typography variant="h5" fontWeight={800} sx={{ mb: 2 }}>
        Reporte de Horas
      </Typography>
      <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="es">
        <Paper sx={{ p: 2, mb: 2 }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="center">
            {isSuperAdmin && (
              <FormControl sx={{ minWidth: 150 }} size="small">
                <InputLabel id="sede-filter-label">Sede</InputLabel>
                <Select
                  labelId="sede-filter-label"
                  value={idSede}
                  label="Sede"
                  onChange={(e) => setIdSede(e.target.value)}
                  disabled={loading || loadingSedes}
                >
                  <MenuItem value="">Todas las sedes</MenuItem>
                  {sedesList.map(s => (
                    <MenuItem key={s.id} value={s.id}>
                      {s.nombre}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
            <TextField
              label="Número de Documento"
              value={numeroDocumentoInput}
              onChange={e => setNumeroDocumentoInput(e.target.value)}
              onKeyPress={handleKeyPress}
              size="small"
              sx={{ minWidth: 200 }}
              placeholder="Ej: 1000000001"
              InputProps={{
                startAdornment: (
                  <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} fontSize="small" />
                ),
                endAdornment: numeroDocumentoInput && (
                  <IconButton 
                    size="small" 
                    onClick={() => {
                      setNumeroDocumentoInput("");
                      setNumeroDocumentoFiltro("");
                    }}
                    sx={{ p: 0.5 }}
                  >
                    <ClearIcon fontSize="small" />
                  </IconButton>
                )
              }}
              helperText={numeroDocumentoFiltro ? `Filtrando por: ${numeroDocumentoFiltro}` : "Presiona Enter para buscar"}
            />
            <Button
              variant="contained"
              size="small"
              onClick={aplicarFiltroDocumento}
              disabled={loading || !numeroDocumentoInput.trim()}
              sx={{ minHeight: 40 }}
            >
              Buscar
            </Button>
            <DatePicker
              label="Desde"
              value={desde}
              onChange={(v) => setDesde(v)}
              slotProps={{ textField: { size: 'small' } }}
              disabled={loading}
              format="DD/MM/YYYY"
            />
            <DatePicker
              label="Hasta"
              value={hasta}
              onChange={(v) => setHasta(v)}
              slotProps={{ textField: { size: 'small' } }}
              minDate={desde || undefined}
              disabled={loading}
              format="DD/MM/YYYY"
            />
            <Box flexGrow={1} />
            <Button 
              variant="outlined" 
              onClick={limpiarFiltros} 
              disabled={loading} 
              size="medium"
              startIcon={<ClearIcon />}
            >
              Limpiar
            </Button>
            <Button
              variant="contained"
              onClick={exportExcel}
              disabled={loading || exporting}
              startIcon={exporting ? <CircularProgress size={20} /> : <FileDownloadIcon />}
              sx={{ 
                minWidth: 140, 
                backgroundColor: '#107c41',
                '&:hover': {
                  backgroundColor: '#0e6b37'
                }
              }}
              size="medium"
            >
              {exporting ? "Generando..." : "Descargar Excel"}
            </Button>
            <Tooltip title="Refrescar datos">
              <span>
                <IconButton onClick={load} disabled={loading} color="primary">
                  <ReplayIcon />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        </Paper>
      </LocalizationProvider>

      {error && !loading && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {String(error)}
        </Alert>
      )}

      <Paper elevation={2}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell><strong>Usuario</strong></TableCell>
                <TableCell><strong>Día</strong></TableCell>
                <TableCell><strong>Nota</strong></TableCell>
                <TableCell><strong>Primera Entrada</strong></TableCell>
                <TableCell><strong>Última Salida</strong></TableCell>
                <TableCell align="right"><strong>Horas (Netas)</strong></TableCell>
                <TableCell align="right"><strong>Marc. Incompletas</strong></TableCell>
                <TableCell align="right"><strong>Tardanza (min)</strong></TableCell>
                <TableCell align="right"><strong>Salida Antic. (min)</strong></TableCell>
                <TableCell align="right"><strong>Extra (min)</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={10} align="center" sx={{ py: 6 }}>
                    <CircularProgress size={40} />
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                      Cargando datos...
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
              {!loading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} align="center" sx={{ py: 6, color: "text.secondary" }}>
                    <Typography variant="body1" gutterBottom>
                      No hay datos para mostrar
                    </Typography>
                    <Typography variant="body2" color="text.disabled">
                      {numeroDocumentoFiltro 
                        ? `No se encontraron registros para el documento: ${numeroDocumentoFiltro}`
                        : "Ajusta los filtros o descarga el Excel para ver más detalles"}
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
              {!loading && rows.map((r, i) => (
                <TableRow key={`${r.idUsuario}-${r.dia}-${i}`} hover>
                  <TableCell>{r.nombre || "-"}</TableCell>
                  <TableCell>{formatDate(r.dia)}</TableCell>
                  <TableCell sx={{ 
                    fontStyle: r.notaDia ? 'italic' : 'normal', 
                    color: r.notaDia ? 'info.main' : 'text.secondary',
                    maxWidth: 200,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {r.notaDia || "-"}
                  </TableCell>
                  <TableCell>{formatDateTime(r.primeraEntrada)}</TableCell>
                  <TableCell>{formatDateTime(r.ultimaSalida)}</TableCell>
                  <TableCell align="right">
                    <strong>{formatNumber(r.horas, 2)}</strong>
                  </TableCell>
                  <TableCell align="right">{r.marcacionesIncompletas || 0}</TableCell>
                  <TableCell 
                    align="right" 
                    sx={{ 
                      color: (r.tardanzaMin || 0) > 0 ? 'warning.main' : 'inherit',
                      fontWeight: (r.tardanzaMin || 0) > 0 ? 600 : 400
                    }}
                  >
                    {formatNumber(r.tardanzaMin, 0)}
                  </TableCell>
                  <TableCell 
                    align="right" 
                    sx={{ 
                      color: (r.salidaAnticipadaMin || 0) > 0 ? 'warning.main' : 'inherit',
                      fontWeight: (r.salidaAnticipadaMin || 0) > 0 ? 600 : 400
                    }}
                  >
                    {formatNumber(r.salidaAnticipadaMin, 0)}
                  </TableCell>
                  <TableCell 
                    align="right" 
                    sx={{ 
                      color: (r.extraMin || 0) > 0 ? 'success.main' : 'inherit',
                      fontWeight: (r.extraMin || 0) > 0 ? 600 : 400
                    }}
                  >
                    {formatNumber(r.extraMin, 0)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        
        {!loading && rows.length > 0 && (
          <Box sx={{ p: 2, bgcolor: 'background.default', borderTop: 1, borderColor: 'divider' }}>
            <Typography variant="body2" color="text.secondary">
              Mostrando {rows.length} registro{rows.length !== 1 ? 's' : ''} 
              {numeroDocumentoFiltro && ` para el documento ${numeroDocumentoFiltro}`}
            </Typography>
          </Box>
        )}
      </Paper>
    </>
  );
}