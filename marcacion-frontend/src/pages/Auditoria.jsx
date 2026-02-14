import { useState, useMemo } from "react";
import { useSnackbar } from "notistack";
import {
  Paper, Stack, Typography, Box, Alert, CircularProgress,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip,
  TextField, Grid, Button, IconButton, TablePagination,
  FormControl, InputLabel, Select, MenuItem
} from "@mui/material";
import ReplayIcon from "@mui/icons-material/Replay";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import { LocalizationProvider, DateTimePicker } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

// 1. Importar Hooks de React Query
import { useAuditorias } from "../hooks/useAuditoria";
import { useSedesAll } from "../hooks/useSedes";
import { useUsuariosSimple } from "../hooks/useUsuarios";
import { useAuth } from "../auth/AuthContext";

dayjs.extend(utc);
dayjs.extend(timezone);

const ROLES = { SUPERADMIN: "superadmin", ADMIN: "admin" };

// Helpers de formato
const formatDateTime = (ts) => ts ? dayjs(ts).tz(dayjs.tz.guess()).format("DD/MM/YYYY HH:mm:ss") : "-";
const toCsvValue = (v) => {
    if (v === null || v === undefined) return '""';
    const s = String(v).replace(/"/g, '""');
    return `"${s}"`;
};

export default function AuditoriaPage() {
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuth();
  const isSuperAdmin = useMemo(() => user?.rol === ROLES.SUPERADMIN, [user]);

  // Estados de paginación y filtros
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [filtroSede, setFiltroSede] = useState(isSuperAdmin ? "" : String(user?.idSede || ""));
  const [filtroUsuario, setFiltroUsuario] = useState("");
  const [filtroAccion, setFiltroAccion] = useState("");
  const [filtroEntidad, setFiltroEntidad] = useState("");
  const [filtroEntidadId, setFiltroEntidadId] = useState("");
  const [filtroDesde, setFiltroDesde] = useState(null);
  const [filtroHasta, setFiltroHasta] = useState(null);
  const [exporting, setExporting] = useState(false);

  // 2. Definir parámetros para el Query
  const queryFilter = useMemo(() => ({
      idUsuarioAdmin: filtroUsuario || undefined,
      idSede: filtroSede || undefined,
      accion: filtroAccion || undefined,
      entidad: filtroEntidad || undefined,
      entidadId: filtroEntidadId || undefined,
      desde: filtroDesde ? dayjs(filtroDesde).toISOString() : undefined,
      hasta: filtroHasta ? dayjs(filtroHasta).toISOString() : undefined,
      page: page + 1,
      pageSize: rowsPerPage,
  }), [filtroUsuario, filtroSede, filtroAccion, filtroEntidad, filtroEntidadId, filtroDesde, filtroHasta, page, rowsPerPage]);

  // 3. Usar Hooks (Reemplazan useEffect y load manual)
  const { data, isLoading, isError, error, refetch } = useAuditorias(queryFilter);
  const { data: sedesData, isLoading: loadingSedes } = useSedesAll();
  const { data: usuariosData, isLoading: loadingUsers } = useUsuariosSimple({ 
      idSede: filtroSede || undefined,
      enabled: !!user 
  });

  const logs = data?.items || [];
  const totalLogs = data?.total || 0;

  async function exportCsv() {
      if (logs.length === 0) {
          enqueueSnackbar("No hay datos para exportar.", { variant: "info" });
          return;
      }
      setExporting(true);
      try {
          const header = ["ID", "Fecha", "Usuario Admin", "Acción", "Entidad", "ID Entidad", "Datos JSON"];
          const dataRows = logs.map(a => ([
              a.id,
              formatDateTime(a.fecha),
              a.nombreUsuarioAdmin || a.idUsuarioAdmin, 
              a.accion,
              a.entidad,
              a.entidadId,
              a.dataJson
          ]));

          const csvContent = [header, ...dataRows].map(r => r.map(toCsvValue).join(",")).join("\n");
          const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = `auditoria_${dayjs().format("YYYY-MM-DD")}_p${page + 1}.csv`;
          link.click();
          URL.revokeObjectURL(url);
          enqueueSnackbar("Página exportada a CSV", { variant: "success" });
      } catch (e) {
          enqueueSnackbar("Error al generar CSV", { variant: "error" });
      } finally {
          setExporting(false);
      }
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="es">
      <Stack spacing={3}>
        <Typography variant="h5" fontWeight={800}>Registros de Auditoría</Typography>

        <Paper sx={{ p: 2 }}>
          <Grid container spacing={2} alignItems="center">
            {isSuperAdmin && (
              <Grid item xs={12} sm={4} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Sede</InputLabel>
                  <Select value={filtroSede} label="Sede" onChange={(e) => { setFiltroSede(e.target.value); setFiltroUsuario(""); setPage(0); }}>
                    <MenuItem value="">Todas</MenuItem>
                    {sedesData?.items?.map(s => <MenuItem key={s.id} value={s.id}>{s.nombre}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
            )}

            <Grid item xs={12} sm={4} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Usuario Admin</InputLabel>
                <Select value={filtroUsuario} label="Usuario Admin" onChange={(e) => { setFiltroUsuario(e.target.value); setPage(0); }}>
                  <MenuItem value="">Todos</MenuItem>
                  {usuariosData?.items?.map(u => <MenuItem key={u.id} value={u.id}>{u.nombreCompleto}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={6} sm={4} md={2}>
              <TextField label="Acción" value={filtroAccion} onChange={e => { setFiltroAccion(e.target.value); setPage(0); }} size="small" fullWidth />
            </Grid>
            
            <Grid item xs={6} sm={4} md={2}>
                <DateTimePicker label="Desde" value={filtroDesde} onChange={(v) => { setFiltroDesde(v); setPage(0); }} slotProps={{ textField: { size: 'small', fullWidth: true } }} ampm={false} format="DD/MM/YYYY HH:mm" />
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
                <DateTimePicker label="Hasta" value={filtroHasta} onChange={(v) => { setFiltroHasta(v); setPage(0); }} slotProps={{ textField: { size: 'small', fullWidth: true } }} ampm={false} format="DD/MM/YYYY HH:mm" />
            </Grid>

            <Grid item xs sx={{ textAlign: 'right' }}>
              <IconButton onClick={() => refetch()} disabled={isLoading} color="primary"><ReplayIcon /></IconButton>
            </Grid>
          </Grid>
        </Paper>

        <Paper elevation={3}>
          {isError && <Alert severity="error" sx={{ m: 2 }}>{error?.message || "Error al cargar datos"}</Alert>}
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Fecha/Hora</TableCell>
                  <TableCell>Admin</TableCell>
                  <TableCell>Acción</TableCell>
                  <TableCell>Entidad</TableCell>
                  <TableCell>Datos (JSON)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4 }}><CircularProgress /></TableCell></TableRow>
                ) : logs.map((a) => (
                  <TableRow key={a.id} hover>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDateTime(a.fecha)}</TableCell>
                    <TableCell>{a.nombreUsuarioAdmin || `ID: ${a.idUsuarioAdmin}`}</TableCell>
                    <TableCell>{a.accion}</TableCell>
                    <TableCell>{a.entidad} (ID: {a.entidadId})</TableCell>
                    <TableCell>
                      <Tooltip title={a.dataJson || ""}>
                        <Typography variant="caption" noWrap sx={{ maxWidth: 250, display: 'block', fontFamily: 'monospace' }}>
                          {a.dataJson || "-"}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={totalLogs}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
            labelRowsPerPage="Filas"
          />
          <Box sx={{ p: 1, textAlign: 'right' }}>
            <Button variant="outlined" onClick={exportCsv} disabled={isLoading || exporting || logs.length === 0} startIcon={exporting ? <CircularProgress size={20}/> : <FileDownloadIcon />} size="small">
              {exporting ? "Exportando..." : "Exportar Página CSV"}
            </Button>
          </Box>
        </Paper>
      </Stack>
    </LocalizationProvider>
  );
}