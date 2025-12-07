import { useEffect, useState, useMemo } from "react";
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
import { getAuditorias } from "../api/auditoria"; // API
// --- AÑADIDO: Importar useAuth, Roles y getSedes ---
import { useAuth } from "../auth/AuthContext";
import { getUsuarios } from "../api/usuarios";
import { getSedes } from "../api/sedes";

const ROLES = {
  SUPERADMIN: "superadmin",
  ADMIN: "admin"
};
// --- FIN AÑADIDO ---

dayjs.extend(utc);
dayjs.extend(timezone);

// (Funciones helper formatDateTime y toCsvValue - sin cambios)
// ...
const formatDateTime = (dateTimeOffsetString) => {
  if (!dateTimeOffsetString) return "-";
  return dayjs(dateTimeOffsetString).tz(dayjs.tz.guess()).format("DD/MM/YYYY HH:mm:ss");
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

export default function AuditoriaPage() {
  const { enqueueSnackbar } = useSnackbar();
  // --- AÑADIDO: Obtener usuario y rol ---
  const { user } = useAuth();
  const isSuperAdmin = useMemo(() => user?.rol === ROLES.SUPERADMIN, [user]);
  // --- FIN AÑADIDO ---

  // Estados de datos y paginación
  const [data, setData] = useState({ items: [], total: 0, page: 1, pageSize: 20 });
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);

  // Estados de filtros
  const [sedesList, setSedesList] = useState([]); // AÑADIDO
  const [filtroSede, setFiltroSede] = useState(""); // AÑADIDO
  const [usuariosAdmins, setUsuariosAdmins] = useState([]);
  const [filtroUsuario, setFiltroUsuario] = useState("");
  const [filtroAccion, setFiltroAccion] = useState("");
  const [filtroEntidad, setFiltroEntidad] = useState("");
  const [filtroEntidadId, setFiltroEntidadId] = useState("");
  const [filtroDesde, setFiltroDesde] = useState(null);
  const [filtroHasta, setFiltroHasta] = useState(null);

  // Estados UI
  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingSedes, setLoadingSedes] = useState(false); // AÑADIDO
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);

  // --- AÑADIDO: Efecto para forzar la sede si el usuario es admin ---
  useEffect(() => {
    if (user && !isSuperAdmin) {
      // Si el usuario es admin (no superadmin), forzar su ID de sede
      setFiltroSede(String(user.idSede || ""));
    }
  }, [user, isSuperAdmin]);
  // --- FIN AÑADIDO ---
  
  // --- AÑADIDO: Cargar sedes (solo SuperAdmin) ---
  useEffect(() => {
    if (isSuperAdmin) {
      setLoadingSedes(true);
      getSedes({ page: 1, pageSize: 1000 })
        .then(data => setSedesList(data.items))
        .catch(() => enqueueSnackbar("Error cargando lista de sedes", { variant: "error" }))
        .finally(() => setLoadingSedes(false));
    }
  }, [isSuperAdmin, enqueueSnackbar]);
  // --- FIN AÑADIDO ---

  // --- MODIFICADO: Cargar lista de usuarios (filtrada por sede) ---
  useEffect(() => {
    if (!user) return; // Espera a que el usuario (admin) cargue
    
    // Determina la sede por la cual filtrar
    const sedeIdParaFiltrarUsuarios = isSuperAdmin ? filtroSede : (user.idSede || "");

    setLoadingUsers(true);
    const userFilter = { 
        page: 1, 
        pageSize: 1000, 
        idSede: sedeIdParaFiltrarUsuarios ? Number(sedeIdParaFiltrarUsuarios) : undefined
    };
    
    // Carga solo usuarios (admins) de la sede seleccionada (o todas si es superadmin y no hay filtro)
    getUsuarios(userFilter)
      .then(res => setUsuariosAdmins(res.items))
      .catch(() => enqueueSnackbar("Error cargando usuarios para filtro", { variant: "warning"}))
      .finally(() => setLoadingUsers(false));
  }, [user, isSuperAdmin, filtroSede, enqueueSnackbar]); // Recarga si cambia el filtro de sede
  // --- FIN MODIFICADO ---


  // Construye el objeto de filtro para la API
  const queryFilter = useMemo(() => ({
      idUsuarioAdmin: filtroUsuario || undefined,
      idSede: filtroSede || undefined, // --- AÑADIDO: Pasa el filtro de sede a la API ---
      accion: filtroAccion || undefined,
      entidad: filtroEntidad || undefined,
      entidadId: filtroEntidadId || undefined,
      desde: filtroDesde ? dayjs(filtroDesde).toISOString() : undefined, // API espera DateTimeOffset
      hasta: filtroHasta ? dayjs(filtroHasta).toISOString() : undefined,
      page: page + 1,
      pageSize: rowsPerPage,
  }), [filtroUsuario, filtroSede, filtroAccion, filtroEntidad, filtroEntidadId, filtroDesde, filtroHasta, page, rowsPerPage]);


  // Carga los registros de auditoría
  const loadAuditorias = () => {
    // Evita carga inicial si es admin y el filtroSede (forzado) aún no se ha seteado
    if (user?.rol === ROLES.ADMIN && !filtroSede) {
        return;
    }
    
    setLoading(true);
    setError(null);
    getAuditorias(queryFilter)
      .then(setData)
      .catch(e => {
        setError(e?.response?.data || e.message || "Error cargando auditoría");
        setData({ items: [], total: 0, page: 1, pageSize: rowsPerPage });
      })
      .finally(() => setLoading(false));
  };

  // Carga al inicio y cuando cambian los filtros/paginación
  useEffect(() => {
    loadAuditorias();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryFilter, user?.rol, filtroSede]); // Depende de queryFilter (que incluye filtroSede)

  // (Función exportCsv - sin cambios)
  async function exportCsv() {
      if (data.items.length === 0) {
          enqueueSnackbar("No hay datos para exportar.", { variant: "info" });
          return;
      }
      setExporting(true);
      try {
          // NOTA: Esto exporta solo la página actual.
          // Para exportar todo, llama a getAuditorias({ ...queryFilter, page: 1, pageSize: data.total })
          const header = ["ID", "Fecha", "ID Admin", "Usuario Admin", "Acción", "Entidad", "ID Entidad", "Datos JSON"];
          const dataRows = data.items.map(a => ([
              a.id,
              formatDateTime(a.fecha),
              a.idUsuarioAdmin,
              a.nombreUsuarioAdmin, 
              a.accion,
              a.entidad,
              a.entidadId,
              a.dataJson
          ]));

          const csvContent = [header, ...dataRows]
              .map(r => r.map(toCsvValue).join(","))
              .join("\n");

          const csvWithBom = "\uFEFF" + csvContent;
          const blob = new Blob([csvWithBom], { type: "text/csv;charset=utf-8;" });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          const today = dayjs().format("YYYY-MM-DD");
          link.href = url;
          link.download = `auditoria_${today}_p${page + 1}.csv`;
          document.body.appendChild(link);
          link.click();
          link.remove();
          URL.revokeObjectURL(url);
          enqueueSnackbar("Página actual exportada a CSV.", { variant: "success" });

      } catch (e) {
          enqueueSnackbar("Error al generar el CSV.", { variant: "error" });
          console.error("Error exporting CSV:", e);
      } finally {
          setExporting(false);
      }
  }


  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="es">
      <Stack spacing={3}>
        <Typography variant="h5" fontWeight={800}>Registros de Auditoría</Typography>

        {/* Filtros */}
        <Paper sx={{ p: 2 }}>
          <Grid container spacing={2} alignItems="center">
            
            {/* --- AÑADIDO: Filtro Sede (Select) solo para SuperAdmin --- */}
             {isSuperAdmin && (
                <Grid item xs={12} sm={4} md={2}>
                    <FormControl fullWidth size="small">
                        <InputLabel id="sede-filter-label">Filtrar Sede</InputLabel>
                        <Select
                            labelId="sede-filter-label"
                            value={filtroSede}
                            label="Filtrar Sede"
                            onChange={(e) => {
                                setFiltroSede(e.target.value);
                                setFiltroUsuario(""); // Limpia el filtro de usuario al cambiar de sede
                                setPage(0);
                            }}
                            disabled={loading || loadingSedes}
                        >
                            <MenuItem value="">Todas</MenuItem>
                            {sedesList.map(s => <MenuItem key={s.id} value={s.id}>{s.nombre}</MenuItem>)}
                        </Select>
                    </FormControl>
                </Grid>
             )}
            {/* --- FIN AÑADIDO --- */}

            {/* Filtro Usuario Admin */}
            <Grid item xs={12} sm={4} md={2}>
                 <FormControl fullWidth size="small">
                    <InputLabel id="usuario-admin-filter-label">Usuario Admin</InputLabel>
                    <Select
                        labelId="usuario-admin-filter-label"
                        value={filtroUsuario}
                        label="Usuario Admin"
                        onChange={(e) => { setFiltroUsuario(e.target.value); setPage(0); }}
                        disabled={loading || loadingUsers}
                    >
                        <MenuItem value="">Todos</MenuItem>
                        {/* La lista de usuarios ya está filtrada por sede si es admin */}
                        {usuariosAdmins.map(u => <MenuItem key={u.id} value={u.id}>{u.nombreCompleto}</MenuItem>)}
                    </Select>
                </FormControl>
            </Grid>
             <Grid item xs={6} sm={4} md={2}>
                <TextField label="Acción (contiene)" value={filtroAccion} onChange={e => { setFiltroAccion(e.target.value); setPage(0);}} size="small" fullWidth />
            </Grid>
            <Grid item xs={6} sm={4} md={1}>
                <TextField label="Entidad" value={filtroEntidad} onChange={e => { setFiltroEntidad(e.target.value); setPage(0);}} size="small" fullWidth />
            </Grid>
             <Grid item xs={6} sm={4} md={1}>
                <TextField label="ID Entidad" value={filtroEntidadId} onChange={e => { setFiltroEntidadId(e.target.value); setPage(0);}} size="small" fullWidth type="number"/>
            </Grid>
            <Grid item xs={12} sm={4} md={2}>
                <DateTimePicker
                    label="Desde"
                    value={filtroDesde}
                    onChange={(val) => {setFiltroDesde(val); setPage(0);}}
                    slotProps={{ textField: { size: 'small', fullWidth: true } }}
                    ampm={false}
                    format="DD/MM/YYYY HH:mm"
                />
            </Grid>
            <Grid item xs={12} sm={4} md={2}>
                 <DateTimePicker
                    label="Hasta"
                    value={filtroHasta}
                    onChange={(val) => {setFiltroHasta(val); setPage(0);}}
                    slotProps={{ textField: { size: 'small', fullWidth: true } }}
                    minDateTime={filtroDesde || undefined}
                    ampm={false}
                    format="DD/MM/YYYY HH:mm"
                />
            </Grid>
             <Grid item xs={12} sm={12} md={isSuperAdmin ? "auto" : 2} sx={{ textAlign: 'right' }}> {/* Ajuste de tamaño si Sede está oculta */}
                 <Tooltip title="Refrescar Lista">
                     <span>
                         <IconButton onClick={loadAuditorias} disabled={loading}>
                             <ReplayIcon />
                         </IconButton>
                     </span>
                 </Tooltip>
             </Grid>
          </Grid>
        </Paper>

        {/* Tabla de Auditoría */}
        <Paper>
          {error && <Alert severity="error" sx={{ m: 2 }}>{String(error)}</Alert>}
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Fecha/Hora</TableCell>
                  <TableCell>Usuario Admin</TableCell>
                  <TableCell>Acción</TableCell>
                  <TableCell>Entidad</TableCell>
                  <TableCell>ID Entidad</TableCell>
                  <TableCell>Datos (JSON)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading && (
                  <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4 }}><CircularProgress /></TableCell></TableRow>
                )}
                {!loading && data.items.length === 0 && (
                  <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4, color: "text.secondary" }}>No hay registros que coincidan con los filtros.</TableCell></TableRow>
                )}
                {!loading && data.items.map((a) => (
                  <TableRow key={a.id} hover>
                    <TableCell sx={{whiteSpace: 'nowrap'}}>{formatDateTime(a.fecha)}</TableCell>
                    <TableCell>{a.nombreUsuarioAdmin || `ID: ${a.idUsuarioAdmin}`}</TableCell>
                    <TableCell>{a.accion}</TableCell>
                    <TableCell>{a.entidad}</TableCell>
                    <TableCell>{a.entidadId}</TableCell>
                    <TableCell>
                      <Tooltip title={a.dataJson || ""}>
                        <Typography variant="body2" noWrap sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'monospace', fontSize:'0.75rem' }}>
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
              count={data.total}
              page={page}
              onPageChange={(_, p) => setPage(p)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(e) => {
                  setRowsPerPage(parseInt(e.target.value, 10));
                  setPage(0);
              }}
              rowsPerPageOptions={[10, 20, 50, 100]}
              labelRowsPerPage="Filas por página"
              labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count !== -1 ? count : `más de ${to}`}`}
           />
            <Box sx={{ p: 1, textAlign: 'right' }}>
                <Button
                    variant="outlined"
                    onClick={exportCsv}
                    disabled={loading || exporting || data.items.length === 0}
                    startIcon={exporting ? <CircularProgress size={20}/> : <FileDownloadIcon />}
                    size="small"
                >
                    {exporting ? "Exportando..." : "Exportar Página"}
                </Button>
            </Box>
        </Paper>
      </Stack>
    </LocalizationProvider>
  );
}

