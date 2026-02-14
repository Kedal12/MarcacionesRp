import { useEffect, useMemo, useState } from "react";
import { useMarcaciones } from "../hooks/useMarcaciones";
import { useSedesAll } from "../hooks/useSedes";
import { useAuth } from "../auth/AuthContext";
import { fmt } from "../utils/date";

import {
  Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TablePagination, Stack, Chip,
  FormControl, InputLabel, Select, MenuItem, CircularProgress,
  Alert, TextField, IconButton, Grid 
} from "@mui/material";

import { DatePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";
import utc from 'dayjs/plugin/utc';
import ReplayIcon from "@mui/icons-material/Replay";
import SearchIcon from "@mui/icons-material/Search";

dayjs.extend(utc);

export default function MarcacionesList() {
  const { user } = useAuth();
  const isSuperAdmin = useMemo(() => user?.rol === "superadmin", [user]);

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [idSede, setIdSede] = useState("");
  const [tipo, setTipo] = useState("");
  const [textoBusqueda, setTextoBusqueda] = useState("");
  
  const [desde, setDesde] = useState(dayjs("2025-12-01"));
  const [hasta, setHasta] = useState(dayjs("2026-02-28"));

  // Solo auto-seleccionar sede si NO es superadmin
  useEffect(() => {
    if (user && !isSuperAdmin) {
      setIdSede(String(user.idSede || ""));
    }
  }, [user, isSuperAdmin]);

  const queryParams = useMemo(() => ({
    page: page + 1,
    pageSize: rowsPerPage,
    idSede: idSede ? Number(idSede) : undefined,
    tipo: tipo || undefined,
    // Mapeamos a numeroDocumento para que el hook lo convierta en NumeroDocumento para C#
    numeroDocumento: textoBusqueda.trim() || undefined, 
    desde: desde ? desde.startOf('day').toISOString() : undefined,
    hasta: hasta ? hasta.endOf('day').toISOString() : undefined,
  }), [page, rowsPerPage, idSede, tipo, textoBusqueda, desde, hasta]);

  const { data, isLoading, isError, error, refetch } = useMarcaciones(queryParams);
  const { data: sedesData, isLoading: loadingSedes } = useSedesAll();
  
  // CORRECCIÓN: Extracción robusta de sedes para manejar arrays directos
  const sedes = useMemo(() => {
    if (!sedesData) return [];
    if (Array.isArray(sedesData)) return sedesData;
    return sedesData.items || sedesData.data || [];
  }, [sedesData]);

  const items = useMemo(() => data?.items || data?.data || [], [data]);

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="es">
      <Stack spacing={2}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="h5" fontWeight={800}>Marcaciones</Typography>
          <IconButton onClick={() => refetch()} disabled={isLoading} color="primary">
            <ReplayIcon />
          </IconButton>
        </Stack>

        <Paper sx={{ p: 2 }}>
          <Grid container spacing={2} alignItems="center">
            {/* 1. FILTRO DE SEDES (Actualizado para mostrar múltiples opciones) */}
            <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Sede</InputLabel>
              <Select 
                value={idSede} 
                label="Sede" 
                onChange={(e) => { setIdSede(e.target.value); setPage(0); }}
                // ✅ SI NO ES SUPERADMIN, EL SELECT SE BLOQUEA
                disabled={loadingSedes || !isSuperAdmin} 
              >
                {/* ✅ SI NO ES SUPERADMIN, SOLO SE MUESTRA SU SEDE */}
                {isSuperAdmin ? (
                  <>
                    <MenuItem value=""><em>Todas las sedes</em></MenuItem>
                    {sedes.map(s => <MenuItem key={s.id} value={String(s.id)}>{s.nombre}</MenuItem>)}
                  </>
                ) : (
                  <MenuItem value={String(user?.idSede)}>{user?.nombreSede}</MenuItem>
                )}
              </Select>
            </FormControl>
            </Grid>
            
            {/* 2. FILTRO POR TIPO */}
            <Grid item xs={12} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Tipo</InputLabel>
                <Select 
                  value={tipo} 
                  label="Tipo" 
                  onChange={(e) => { setTipo(e.target.value); setPage(0); }}
                >
                  <MenuItem value=""><em>Ambos</em></MenuItem>
                  <MenuItem value="entrada">Entrada</MenuItem>
                  <MenuItem value="salida">Salida</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* 3. BUSCADOR POR DOCUMENTO */}
            <Grid item xs={12} md={3}>
              <TextField 
                fullWidth size="small" label="Documento..." 
                value={textoBusqueda} 
                onChange={(e) => { setTextoBusqueda(e.target.value); setPage(0); }} 
                InputProps={{ startAdornment: <SearchIcon fontSize="small" sx={{mr:1, color:'gray'}}/> }}
              />
            </Grid>

            {/* 4. FECHAS */}
            <Grid item xs={6} md={2}>
              <DatePicker label="Desde" value={desde} onChange={(v) => {setDesde(v); setPage(0);}} slotProps={{ textField: { size: 'small', fullWidth: true } }} />
            </Grid>
            <Grid item xs={6} md={2}>
              <DatePicker label="Hasta" value={hasta} onChange={(v) => {setHasta(v); setPage(0);}} slotProps={{ textField: { size: 'small', fullWidth: true } }} />
            </Grid>
          </Grid>
        </Paper>

        <Paper elevation={3}>
          {isError && <Alert severity="error" sx={{ m: 2 }}>{error?.message || "Error al cargar"}</Alert>}
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                  <TableCell>Usuario</TableCell>
                  <TableCell>Sede</TableCell>
                  <TableCell>Fecha / Hora</TableCell>
                  <TableCell>Tipo</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={4} align="center" sx={{ py: 4 }}><CircularProgress size={30} /></TableCell></TableRow>
                ) : (
                  <>
                    {items.map((m) => (
                      <TableRow key={m.id} hover>
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>{m.nombreUsuario}</Typography>
                          <Typography variant="caption" color="text.secondary">{m.documentoUsuario}</Typography>
                        </TableCell>
                        <TableCell>{m.nombreSede || "-"}</TableCell>
                        <TableCell>{fmt(m.fechaHora)}</TableCell>
                        <TableCell>
                          <Chip 
                            label={m.tipo?.toUpperCase()} 
                            color={m.tipo?.toLowerCase() === "entrada" ? "success" : "warning"} 
                            size="small" 
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                    {items.length === 0 && <TableRow><TableCell colSpan={4} align="center" sx={{ py: 6 }}>No hay registros.</TableCell></TableRow>}
                  </>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination component="div" count={data?.total || 0} page={page} onPageChange={(_, p) => setPage(p)} rowsPerPage={rowsPerPage} onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }} />
        </Paper>
      </Stack>
    </LocalizationProvider>
  );
}