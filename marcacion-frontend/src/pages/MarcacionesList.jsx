import { useEffect, useMemo, useState } from "react";
import { getMarcaciones } from "../api/marcaciones";
import { getSedes } from "../api/sedes";
import {
  Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TablePagination, Stack, Chip, Box,
  FormControl, InputLabel, Select, MenuItem, Button, CircularProgress,
  Alert, TextField
} from "@mui/material";
import { DatePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";
import { fmt } from "../utils/date";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import ReplayIcon from "@mui/icons-material/Replay";
// --- AÑADIDO: Importar useAuth y definir Roles ---
import { useAuth } from "../auth/AuthContext";

const ROLES = {
  SUPERADMIN: "superadmin",
  ADMIN: "admin"
};
// --- FIN AÑADIDO ---


export default function MarcacionesList() {
  // --- AÑADIDO: Obtener usuario y rol ---
  const { user } = useAuth();
  const isSuperAdmin = useMemo(() => user?.rol === ROLES.SUPERADMIN, [user]);
  // --- FIN AÑADIDO ---

  // datos
  const [data, setData] = useState({ items: [], total: 0, page: 1, pageSize: 10 });

  // paginación MUI (0-based)
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // filtros
  const [sedes, setSedes] = useState([]);
  const [idSede, setIdSede] = useState(""); // El estado se llenará automáticamente si es admin
  const [tipo, setTipo] = useState("");
  const [desde, setDesde] = useState(null);  // dayjs | null
  const [hasta, setHasta] = useState(null);  // dayjs | null
  const [idUsuario, setIdUsuario] = useState(""); // opcional

  // estados UI
  const [loading, setLoading] = useState(false);
  const [loadingSedes, setLoadingSedes] = useState(false); // <-- AÑADIDO
  const [err, setErr] = useState(null);
  const [exporting, setExporting] = useState(false);

  // --- MODIFICADO: Cargar sedes solo si es SuperAdmin ---
  useEffect(() => {
    if (isSuperAdmin) { // Solo superadmin necesita la lista
      setLoadingSedes(true);
      getSedes({ page: 1, pageSize: 1000 })
        .then(data => setSedes(data.items))
        .catch(console.error)
        .finally(() => setLoadingSedes(false));
    }
  }, [isSuperAdmin]); // Depende de si es superadmin
  // --- FIN MODIFICADO ---

  // --- AÑADIDO: Efecto para forzar la sede si el usuario es admin ---
  useEffect(() => {
    if (user && !isSuperAdmin) {
      // Si el usuario es admin (no superadmin), forzar su ID de sede
      setIdSede(String(user.idSede || ""));
    }
    // Si es superadmin, idSede se queda como "" (Todas) por defecto.
  }, [user, isSuperAdmin]);
  // --- FIN AÑADIDO ---


  // construir parámetros de consulta
  const query = useMemo(() => {
    const p = {
      page: page + 1,              // backend 1-based
      pageSize: rowsPerPage,
    };
    // Esta lógica funciona para ambos roles:
    // SuperAdmin: idSede es "" (todas) o el ID seleccionado.
    // Admin: idSede es forzado al de su token por el useEffect.
    if (idSede)   p.idSede = Number(idSede);
    if (tipo)     p.tipo = tipo;
    if (idUsuario) p.idUsuario = Number(idUsuario);

    if (desde) p.desde = dayjs(desde).utc().toISOString(); // envia UTC ISO
    if (hasta) p.hasta = dayjs(hasta).endOf("day").utc().toISOString();

    return p;
  }, [page, rowsPerPage, idSede, tipo, desde, hasta, idUsuario]);

  // cargar marcaciones cuando cambien filtros/paginación
  useEffect(() => {
    // Evita la llamada inicial si eres admin pero tu sede aún no se ha seteado
    if (user?.rol === ROLES.ADMIN && !idSede) {
        return; 
    }
    
    setLoading(true); setErr(null);
    getMarcaciones(query)
      .then(setData)
      .catch((e) => setErr(e?.response?.data || e?.message || "Error cargando marcaciones"))
      .finally(() => setLoading(false));
  }, [query, user?.rol, idSede]); // Añadido user.rol e idSede para el chequeo inicial

  function limpiarFiltros() {
    // SuperAdmin limpia todo. Admin solo limpia lo que puede ver.
    if (!isSuperAdmin) {
        // Admin no puede limpiar la sede (está forzada)
        setIdSede(String(user.idSede || "")); // Restablece por si acaso
    } else {
        setIdSede(""); // SuperAdmin sí puede limpiar la sede
    }
    setTipo(""); setDesde(null); setHasta(null); setIdUsuario("");
    setPage(0);
  }

  // util CSV
  function toCsvValue(v) {
    if (v === null || v === undefined) return '""';
    const s = String(v).replace(/"/g, '""');
    return `"${s}"`;
  }

  async function exportCsv() {
    try {
      setExporting(true);
      // getMarcaciones ya usa el 'query' que está filtrado por sede si es admin
      const { items } = await getMarcaciones({ ...query, page: 1, pageSize: 10000 });

      const header = ["Id","IdUsuario","Fecha","Tipo","Latitud","Longitud"];
      const rows = items.map(m => ([
        m.id,
        m.idUsuario,
        fmt(m.fechaHora),
        m.tipo,
        m.latitud,
        m.longitud
      ]));

      const lines = [header, ...rows]
        .map(r => r.map(toCsvValue).join(","))
        .join("\n");

      const csvWithBom = "\uFEFF" + lines;
      const blob = new Blob([csvWithBom], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const today = new Date().toISOString().slice(0,10);
      a.href = url;
      a.download = `marcaciones_${today}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(e?.message || "No se pudo exportar");
    } finally {
      setExporting(false);
    }
  }

  function load() {
    setLoading(true); setErr(null);
    return getMarcaciones(query)
      .then(setData)
      .catch((e) => setErr(e?.response?.data || e?.message || "Error cargando marcaciones"))
      .finally(() => setLoading(false));
  }

  return (
    <>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h5" fontWeight={800}>
          Marcaciones
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            startIcon={<ReplayIcon />}
            onClick={load}
            disabled={loading}
          >
            Refrescar
          </Button>
          <Button
            variant="contained"
            startIcon={<FileDownloadIcon />}
            onClick={exportCsv}
            disabled={exporting || loading}
          >
            {exporting ? "Exportando..." : "Exportar CSV"}
          </Button>
        </Stack>
      </Stack>

      {/* Filtros */}
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <Paper sx={{ p: 2, mb: 2 }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="center">
            
            {/* --- MODIFICADO: Mostrar filtro de Sede solo a SuperAdmin --- */}
            {isSuperAdmin && (
              <FormControl sx={{ minWidth: 160 }}>
                <InputLabel id="sede-label">Sede</InputLabel>
                <Select
                  labelId="sede-label" label="Sede"
                  value={idSede}
                  onChange={(e)=>{ setIdSede(e.target.value); setPage(0); }}
                  disabled={loadingSedes || loading} // Deshabilitado si carga sedes o datos
                >
                  <MenuItem value="">Todas</MenuItem>
                  {sedes.map(s => <MenuItem key={s.id} value={String(s.id)}>{s.nombre}</MenuItem>)}
                </Select>
              </FormControl>
            )}
            {/* --- FIN MODIFICADO --- */}

            <FormControl sx={{ minWidth: 160 }}>
              <InputLabel id="tipo-label">Tipo</InputLabel>
              <Select
                labelId="tipo-label" label="Tipo"
                value={tipo} onChange={(e)=>{ setTipo(e.target.value); setPage(0); }}
              >
                <MenuItem value="">Todos</MenuItem>
                <MenuItem value="entrada">Entrada</MenuItem>
                <MenuItem value="salida">Salida</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="Id Usuario (opcional)"
              type="number"
              value={idUsuario}
              onChange={(e)=>{ setIdUsuario(e.target.value); setPage(0); }}
              sx={{ width: 180 }}
              // Opcional: Podrías deshabilitar esto si el admin solo puede ver 1 usuario
            />

            <DatePicker
              label="Desde"
              value={desde}
              onChange={(v)=>{ setDesde(v); setPage(0); }}
              slotProps={{ textField: { size: "medium" } }}
            />
            <DatePicker
              label="Hasta"
              value={hasta}
              onChange={(v)=>{ setHasta(v); setPage(0); }}
              slotProps={{ textField: { size: "medium" } }}
            />

            <Box sx={{ flexGrow: 1 }} />
            <Button variant="outlined" onClick={limpiarFiltros}>Limpiar</Button>
          </Stack>
        </Paper>
      </LocalizationProvider>

      {/* Tabla */}
      <Paper elevation={3}>
        {err && <Alert severity="error">{String(err)}</Alert>}
        {loading && (
          <Box sx={{ display: "grid", placeItems: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {!loading && (
          <>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>ID</TableCell>
                    <TableCell>Usuario</TableCell>
                    <TableCell>Fecha</TableCell>
                    <TableCell>Tipo</TableCell>
                    <TableCell>Lat</TableCell>
                    <TableCell>Lon</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.items.map((m) => (
                    <TableRow key={m.id} hover>
                      <TableCell>{m.id}</TableCell>
                      <TableCell>{m.idUsuario}</TableCell>
                      <TableCell>{fmt(m.fechaHora)}</TableCell>
                      <TableCell>
                        <Chip
                          label={m.tipo}
                          color={m.tipo === "entrada" ? "success" : "warning"}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{m.latitud}</TableCell>
                      <TableCell>{m.longitud}</TableCell>
                    </TableRow>
                  ))}
                  {data.items.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 4, color: "text.secondary" }}>
                        No hay registros.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            <TablePagination
              component="div"
              count={data.total}
              page={page}
              onPageChange={(_, p) => setPage(p)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
              rowsPerPageOptions={[5,10,20,50]}
              labelRowsPerPage="Filas por página"
            />
          </>
        )}
      </Paper>
    </>
  );
}

