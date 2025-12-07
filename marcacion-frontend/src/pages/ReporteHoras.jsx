import { useEffect, useState, useMemo } from "react";
import { Paper, Stack, TextField, Button, Table, TableHead, TableRow, TableCell, TableBody, TableContainer, CircularProgress, Alert, Typography, Box, IconButton, Tooltip, FormControl, InputLabel, Select, MenuItem } from "@mui/material"; // Added FormControl, InputLabel, Select, MenuItem
import { DatePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { getHoras } from "../api/reportes";
import { useSnackbar } from "notistack";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import ReplayIcon from "@mui/icons-material/Replay";
// --- AÑADIDO: Importar useAuth, Roles y getSedes ---
import { useAuth } from "../auth/AuthContext";
import { getSedes } from "../api/sedes"; // Para el filtro de sedes

const ROLES = {
  SUPERADMIN: "superadmin",
  ADMIN: "admin"
};
// --- FIN AÑADIDO ---

dayjs.extend(utc);
dayjs.extend(timezone);

// (Funciones helper formatDateTime, formatDate, toCsvValue - sin cambios)
// ...
const formatDateTime = (dateTimeOffsetString) => {
  if (!dateTimeOffsetString) return "-";
  return dayjs(dateTimeOffsetString).tz(dayjs.tz.guess()).format("HH:mm:ss");
};
const formatDate = (dateOnlyString) => {
    if (!dateOnlyString) return "-";
    return dayjs(dateOnlyString).format("DD/MM/YYYY");
};
function toCsvValue(v) {
    if (v === null || v === undefined) return '""';
    const s = String(v).replace(/"/g, '""');
    if (s.includes(',') || s.includes('\n') || s.includes('"')) {
        return `"${s}"`;
    }
    return `"${s}"`;
}
// ...

export default function ReporteHoras() {
  // --- AÑADIDO: Obtener usuario y rol ---
  const { user } = useAuth();
  const isSuperAdmin = useMemo(() => user?.rol === ROLES.SUPERADMIN, [user]);
  // --- FIN AÑADIDO ---

  const [desde, setDesde] = useState(dayjs().startOf("month"));
  const [hasta, setHasta] = useState(dayjs().endOf("month"));
  const [idUsuario, setIdUsuario] = useState("");
  // --- MODIFICADO: El estado inicial se seteará en el useEffect ---
  const [idSede, setIdSede] = useState("");
  // --- FIN MODIFICADO ---
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { enqueueSnackbar } = useSnackbar();
  const [exporting, setExporting] = useState(false);
  
  // --- AÑADIDO: Estados para filtro de sedes ---
  const [sedesList, setSedesList] = useState([]);
  const [loadingSedes, setLoadingSedes] = useState(false);
  // --- FIN AÑADIDO ---

  // --- AÑADIDO: Cargar sedes solo si es SuperAdmin ---
  useEffect(() => {
    if (isSuperAdmin) { // Solo superadmin necesita la lista
      setLoadingSedes(true);
      getSedes({ page: 1, pageSize: 1000 })
        .then(data => setSedesList(data.items))
        .catch(() => enqueueSnackbar("Error cargando lista de sedes", { variant: "error" }))
        .finally(() => setLoadingSedes(false));
    }
  }, [isSuperAdmin, enqueueSnackbar]);
  // --- FIN AÑADIDO ---

  // --- AÑADIDO: Efecto para forzar la sede si el usuario es admin ---
  useEffect(() => {
    if (user && !isSuperAdmin) {
      // Si el usuario es admin (no superadmin), forzar su ID de sede
      setIdSede(String(user.idSede || ""));
    }
  }, [user, isSuperAdmin]);
  // --- FIN AÑADIDO ---


  const query = useMemo(() => {
    const p = {};
    if (desde) p.desde = dayjs(desde).startOf('day').utc().toISOString();
    if (hasta) p.hasta = dayjs(hasta).endOf('day').utc().toISOString();
    if (idUsuario.trim()) p.idUsuario = Number(idUsuario.trim());
    // idSede se toma del estado, que es forzado para admin o seleccionado por superadmin
    if (idSede) p.idSede = Number(idSede);
    return p;
  }, [desde, hasta, idUsuario, idSede]);

  // --- MODIFICADO: Función load separada ---
  const load = () => {
    // Evita la llamada inicial si eres admin pero tu sede aún no se ha seteado
    if (user?.rol === ROLES.ADMIN && !idSede) {
        return; 
    }

    setLoading(true);
    setError(null);
    setRows([]); // Limpia filas en cada carga
    getHoras(query)
      .then(data => {
        setRows(data);
      })
      .catch(e => {
        const errorMsg = e?.response?.data || e?.message || "Error al cargar el reporte";
        setError(errorMsg);
        enqueueSnackbar(String(errorMsg), { variant: "error" });
        setRows([]);
      })
      .finally(() => {
        setLoading(false);
      });
  };
  // --- FIN MODIFICADO ---

  useEffect(() => {
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, user?.rol, idSede]); // Depende de query (que depende de idSede)

  // --- AÑADIDO: Limpiar filtros según rol ---
  function limpiarFiltros() {
    if (!isSuperAdmin) {
        setIdSede(String(user.idSede || "")); // Restablece
    } else {
        setIdSede(""); // SuperAdmin sí puede limpiar
    }
    setIdUsuario("");
    setDesde(dayjs().startOf("month"));
    setHasta(dayjs().endOf("month"));
    setPage(0); // Asumiendo que tienes paginación
  }
  // --- FIN AÑADIDO ---


  // (Función exportCsv sin cambios)
  async function exportCsv() {
      if (rows.length === 0) {
          enqueueSnackbar("No hay datos para exportar.", { variant: "info" });
          return;
      }
      setExporting(true);
      try {
          // query ya incluye el filtro de sede correcto (forzado o seleccionado)
          // Si quieres exportar TODO (no solo la página actual), llama a la API de nuevo
          // const { items } = await getHoras({ ...query, page: 1, pageSize: 10000 });
          // O exporta solo las 'rows' actuales:
          
          const header = [
              "Usuario", "Dia", "NotaDia", "Primera Entrada", "Ultima Salida", "Horas Netas",
              "Marc. Incompletas", "Tardanza (min)", "Salida Antic. (min)", "Extra (min)"
          ];
          const dataRows = rows.map(r => ([
              r.nombre,
              formatDate(r.dia),
              r.notaDia || "", // Incluir NotaDia
              formatDateTime(r.primeraEntrada),
              formatDateTime(r.ultimaSalida),
              r.horas?.toFixed(2),
              r.marcacionesIncompletas,
              r.tardanzaMin?.toFixed(0),
              r.salidaAnticipadaMin?.toFixed(0),
              r.extraMin?.toFixed(0)
          ]));
          const csvContent = [header, ...dataRows]
              .map(r => r.map(toCsvValue).join(","))
              .join("\n");
          const csvWithBom = "\uFEFF" + csvContent;
          const blob = new Blob([csvWithBom], { type: "text/csv;charset=utf-8;" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          const today = dayjs().format("YYYY-MM-DD");
          a.href = url;
          a.download = `reporte_horas_${today}.csv`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
          enqueueSnackbar("Reporte exportado a CSV.", { variant: "success" });
      } catch (e) {
          enqueueSnackbar("Error al generar el CSV.", { variant: "error" });
          console.error("Error exporting CSV:", e);
      } finally {
          setExporting(false);
      }
  }

  return (
    <>
      <Typography variant="h5" fontWeight={800} sx={{ mb: 2 }}>Reporte de Horas</Typography>
      <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="es">
        <Paper sx={{ p:2, mb:2 }}>
          <Stack direction={{ xs:"column", md:"row" }} spacing={2} alignItems="center">
            
            {/* --- MODIFICADO: Mostrar filtro Sede (Select) solo a SuperAdmin --- */}
            {isSuperAdmin && (
              <FormControl sx={{ minWidth: 150 }} size="small">
                <InputLabel id="sede-filter-label">Sede</InputLabel>
                <Select
                  labelId="sede-filter-label"
                  value={idSede}
                  label="Sede"
                  onChange={(e) => {setIdSede(e.target.value); setPage(0);}}
                  disabled={loading || loadingSedes}
                >
                  <MenuItem value="">Todas</MenuItem>
                  {sedesList.map(s => <MenuItem key={s.id} value={s.id}>{s.nombre}</MenuItem>)}
                </Select>
              </FormControl>
            )}
            {/* --- FIN MODIFICADO --- */}

            <TextField
                 label="Id Usuario (opcional)"
                 value={idUsuario}
                 onChange={e=>{setIdUsuario(e.target.value); setPage(0);}}
                 type="number"
                 size="small"
                 sx={{minWidth: 150}}
             />
            <DatePicker
                 label="Desde"
                 value={desde}
                 onChange={(v) => {setDesde(v); setPage(0);}}
                 slotProps={{ textField: { size: 'small' } }}
                 disabled={loading}
            />
            <DatePicker
                 label="Hasta"
                 value={hasta}
                 onChange={(v) => {setHasta(v); setPage(0);}}
                 slotProps={{ textField: { size: 'small' } }}
                 minDate={desde || undefined}
                 disabled={loading}
            />
            <Box flexGrow={1} />
            
            {/* Botón Limpiar */}
            <Button variant="outlined" onClick={limpiarFiltros} disabled={loading} size="medium">Limpiar</Button>

            {/* Botón Exportar */}
             <Button
                 variant="contained"
                 onClick={exportCsv}
                 disabled={loading || exporting || rows.length === 0}
                 startIcon={exporting ? <CircularProgress size={20}/> : <FileDownloadIcon />}
                 sx={{ minWidth: 120 }}
                 size="medium" // Alineado con Limpiar
             >
                 {exporting ? "Exportando..." : "Exportar"}
             </Button>
            
            {/* Refresh Button */}
            <Tooltip title="Refrescar">
                <span> {/* IconButton a veces necesita span para Tooltip si está disabled */}
                 <IconButton onClick={load} disabled={loading}>
                    <ReplayIcon />
                 </IconButton>
                </span>
            </Tooltip>
          </Stack>
        </Paper>
      </LocalizationProvider>

      {error && !loading && <Alert severity="error" sx={{ mb: 2 }}>{String(error)}</Alert>}

      <Paper>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Usuario</TableCell>
                <TableCell>Día</TableCell>
                <TableCell>Nota</TableCell> {/* --- AÑADIDO: NotaDia --- */}
                <TableCell>Primera Entrada</TableCell>
                <TableCell>Última Salida</TableCell>
                <TableCell align="right">Horas (Netas)</TableCell>
                <TableCell align="right">Marc. Incompletas</TableCell>
                <TableCell align="right">Tardanza (min)</TableCell>
                <TableCell align="right">Salida Antic. (min)</TableCell>
                <TableCell align="right">Extra (min)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={10} align="center" sx={{ py: 4 }}> {/* Ajustado colSpan */}
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              )}
              {!loading && rows.length === 0 && (
                 <TableRow>
                   <TableCell colSpan={10} align="center" sx={{ py: 4, color: "text.secondary" }}> {/* Ajustado colSpan */}
                     No hay datos para mostrar con los filtros seleccionados.
                   </TableCell>
                 </TableRow>
              )}
              {!loading && rows.map((r, i) => (
                <TableRow key={`${r.idUsuario}-${r.dia}-${i}`} hover>
                  <TableCell>{r.nombre}</TableCell>
                  <TableCell>{formatDate(r.dia)}</TableCell>
                  {/* --- AÑADIDO: Celda NotaDia --- */}
                  <TableCell sx={{ fontStyle: 'italic', color: r.notaDia ? 'text.secondary' : 'inherit' }}>
                    {r.notaDia || "-"}
                  </TableCell>
                  {/* --- FIN AÑADIDO --- */}
                  <TableCell>{formatDateTime(r.primeraEntrada)}</TableCell>
                  <TableCell>{formatDateTime(r.ultimaSalida)}</TableCell>
                  <TableCell align="right">{r.horas?.toFixed(2)}</TableCell>
                  <TableCell align="right">{r.marcacionesIncompletas}</TableCell>
                  <TableCell align="right" sx={{ color: r.tardanzaMin > 0 ? 'warning.main' : 'inherit' }}>
                    {r.tardanzaMin?.toFixed(0)}
                  </TableCell>
                  <TableCell align="right" sx={{ color: r.salidaAnticipadaMin > 0 ? 'warning.main' : 'inherit' }}>
                    {r.salidaAnticipadaMin?.toFixed(0)}
                  </TableCell>
                   <TableCell align="right" sx={{ color: r.extraMin > 0 ? 'success.main' : 'inherit' }}>
                    {r.extraMin?.toFixed(0)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
         {/* No hay paginación en este reporte (carga todo) */}
      </Paper>
    </>
  );
}

