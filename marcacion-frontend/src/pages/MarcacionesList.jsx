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
import utc from 'dayjs/plugin/utc';
import { fmt } from "../utils/date";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import ReplayIcon from "@mui/icons-material/Replay";
import SearchIcon from "@mui/icons-material/Search";
import { useAuth } from "../auth/AuthContext";
import api from "../api/axios"; // ✅ Importar axios para el export

dayjs.extend(utc);

const ROLES = {
  SUPERADMIN: "superadmin",
  ADMIN: "admin"
};

export default function MarcacionesList() {
  const { user } = useAuth();
  const isSuperAdmin = useMemo(() => user?.rol === ROLES.SUPERADMIN, [user]);

  const [data, setData] = useState({ items: [], total: 0, page: 1, pageSize: 10 });
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // --- FILTROS ---
  const [sedes, setSedes] = useState([]);
  const [idSede, setIdSede] = useState("");
  const [tipo, setTipo] = useState("");
  const [desde, setDesde] = useState(null);
  const [hasta, setHasta] = useState(null);
  const [numeroDocumento, setNumeroDocumento] = useState("");

  const [loading, setLoading] = useState(false);
  const [loadingSedes, setLoadingSedes] = useState(false);
  const [err, setErr] = useState(null);
  const [exporting, setExporting] = useState(false);

  // Carga de sedes (SuperAdmin)
  useEffect(() => {
    if (isSuperAdmin) {
      setLoadingSedes(true);
      getSedes({ page: 1, pageSize: 1000 })
        .then(data => setSedes(data.items))
        .catch(console.error)
        .finally(() => setLoadingSedes(false));
    }
  }, [isSuperAdmin]);

  // Forzar sede (Admin)
  useEffect(() => {
    if (user && !isSuperAdmin) {
      setIdSede(String(user.idSede || ""));
    }
  }, [user, isSuperAdmin]);

  // --- Query Params ---
  const query = useMemo(() => {
    const p = {
      page: page + 1,
      pageSize: rowsPerPage,
    };
    if (idSede) p.idSede = Number(idSede);
    if (tipo) p.tipo = tipo;
    if (numeroDocumento.trim()) p.numeroDocumento = numeroDocumento.trim();
    if (desde) p.desde = dayjs(desde).startOf('day').utc().toISOString();
    if (hasta) p.hasta = dayjs(hasta).endOf("day").utc().toISOString();

    return p;
  }, [page, rowsPerPage, idSede, tipo, desde, hasta, numeroDocumento]);

  // Cargar datos
  useEffect(() => {
    if (user?.rol === ROLES.ADMIN && !idSede) return;
    
    const timer = setTimeout(() => {
      loadData();
    }, 300);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, user?.rol, idSede]);

  function loadData() {
    setLoading(true);
    setErr(null);
    getMarcaciones(query)
      .then(setData)
      .catch((e) => setErr(e?.response?.data || e?.message || "Error cargando marcaciones"))
      .finally(() => setLoading(false));
  }

  function limpiarFiltros() {
    if (!isSuperAdmin) setIdSede(String(user.idSede || ""));
    else setIdSede("");
    
    setTipo("");
    setDesde(null);
    setHasta(null);
    setNumeroDocumento("");
    setPage(0);
  }

  // ✅ NUEVO: Exportar a Excel (en lugar de CSV)
  async function exportExcel() {
    try {
      setExporting(true);

      // Construir query params para el endpoint de Excel
      const params = new URLSearchParams();
      if (idSede) params.append("idSede", idSede);
      if (tipo) params.append("tipo", tipo);
      if (numeroDocumento.trim()) params.append("numeroDocumento", numeroDocumento.trim());
      if (desde) params.append("desde", dayjs(desde).startOf('day').utc().toISOString());
      if (hasta) params.append("hasta", dayjs(hasta).endOf("day").utc().toISOString());

      // Llamar al endpoint de Excel con responseType blob
      const response = await api.get(`/api/marcaciones/exportar-excel?${params.toString()}`, {
        responseType: 'blob'
      });

      // Crear enlace de descarga
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const today = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `Marcaciones_${today}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

    } catch (e) {
      console.error("Error exportando Excel:", e);
      alert(e?.response?.data?.message || e?.message || "No se pudo exportar el Excel");
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h5" fontWeight={800}>Marcaciones</Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<ReplayIcon />} onClick={loadData} disabled={loading}>
            Refrescar
          </Button>
          {/* ✅ CAMBIO: Ahora exporta Excel */}
          <Button 
            variant="contained" 
            startIcon={<FileDownloadIcon />} 
            onClick={exportExcel} 
            disabled={exporting || loading}
            color="success"
          >
            {exporting ? "Exportando..." : "Exportar Excel"}
          </Button>
        </Stack>
      </Stack>

      {/* Filtros */}
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <Paper sx={{ p: 2, mb: 2 }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="center">
            
            {isSuperAdmin && (
              <FormControl sx={{ minWidth: 160 }}>
                <InputLabel id="sede-label">Sede</InputLabel>
                <Select
                  labelId="sede-label"
                  label="Sede"
                  value={idSede}
                  onChange={(e) => { setIdSede(e.target.value); setPage(0); }}
                  disabled={loadingSedes || loading}
                >
                  <MenuItem value="">Todas</MenuItem>
                  {sedes.map(s => <MenuItem key={s.id} value={String(s.id)}>{s.nombre}</MenuItem>)}
                </Select>
              </FormControl>
            )}

            <FormControl sx={{ minWidth: 160 }}>
              <InputLabel id="tipo-label">Tipo</InputLabel>
              <Select
                labelId="tipo-label"
                label="Tipo"
                value={tipo}
                onChange={(e) => { setTipo(e.target.value); setPage(0); }}
              >
                <MenuItem value="">Todos</MenuItem>
                <MenuItem value="entrada">Entrada</MenuItem>
                <MenuItem value="salida">Salida</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="Buscar Documento"
              value={numeroDocumento}
              onChange={(e) => { setNumeroDocumento(e.target.value); setPage(0); }}
              sx={{ width: 200 }}
              placeholder="Ej: 1001"
              InputProps={{
                startAdornment: <SearchIcon color="action" sx={{ mr: 1 }} />
              }}
            />

            <DatePicker
              label="Desde"
              value={desde}
              onChange={(v) => { setDesde(v); setPage(0); }}
              slotProps={{ textField: { size: "medium" } }}
            />
            <DatePicker
              label="Hasta"
              value={hasta}
              onChange={(v) => { setHasta(v); setPage(0); }}
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
                    <TableCell><strong>Documento</strong></TableCell>
                    <TableCell><strong>Nombre</strong></TableCell>
                    <TableCell><strong>Sede</strong></TableCell>
                    <TableCell>Fecha</TableCell>
                    <TableCell>Tipo</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.items.map((m) => (
                    <TableRow key={m.id} hover>
                      <TableCell>{m.id}</TableCell>
                      <TableCell>{m.documentoUsuario || "-"}</TableCell>
                      <TableCell>{m.nombreUsuario || "Desconocido"}</TableCell>
                      <TableCell>{m.nombreSede || "Sin sede"}</TableCell>
                      <TableCell>{fmt(m.fechaHora)}</TableCell>
                      <TableCell>
                        <Chip
                          label={m.tipo}
                          color={m.tipo === "entrada" ? "success" : "warning"}
                          size="small"
                        />
                      </TableCell>
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
              rowsPerPageOptions={[5, 10, 20, 50]}
              labelRowsPerPage="Filas por página"
            />
          </>
        )}
      </Paper>
    </>
  );
}