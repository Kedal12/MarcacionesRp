import { useState, useMemo } from "react";
import { 
  Paper, Stack, TextField, Button, Table, TableHead, TableRow, TableCell, 
  TableBody, TableContainer, CircularProgress, Alert, Typography, Box, 
  IconButton, FormControl, InputLabel, Select, MenuItem 
} from "@mui/material"; 
import { DatePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import ReplayIcon from "@mui/icons-material/Replay";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";

import { useGestionReportes } from "../hooks/useReportes";
import { useSedesAll } from "../hooks/useSedes";
import { useAuth } from "../auth/AuthContext";

dayjs.extend(utc);
dayjs.extend(timezone);

const ROLES = { SUPERADMIN: "superadmin", ADMIN: "admin" };

// Helpers de formato
const formatDate = (d) => d ? dayjs(d).format("DD/MM/YYYY") : "-";
const formatNumber = (v, dec = 2) => (v === null || v === undefined || isNaN(v)) ? "0.00" : Number(v).toFixed(dec);

export default function ReporteHoras() {
  const { user } = useAuth();
  const isSuperAdmin = useMemo(() => user?.rol === ROLES.SUPERADMIN, [user]);

  // Estados de filtros
  const [desde, setDesde] = useState(dayjs().startOf("month"));
  const [hasta, setHasta] = useState(dayjs().endOf("month"));
  const [docInput, setDocInput] = useState(""); 
  const [docFiltro, setDocFiltro] = useState(""); 
  const [idSede, setIdSede] = useState(isSuperAdmin ? "" : String(user?.idSede || ""));

  // 1. Hook de Sedes - Ajustado para manejar la respuesta del backend
  const { data: sedesData, isLoading: loadingSedes } = useSedesAll();
  
  // IMPORTANTE: Si tu API devuelve un objeto con 'items', usamos sedesData.items
  const sedesList = useMemo(() => {
    if (!sedesData) return [];
    return Array.isArray(sedesData) ? sedesData : (sedesData.items || []);
  }, [sedesData]);

  // 2. Parámetros para el reporte
  const reportParams = useMemo(() => ({
    desde: desde ? dayjs(desde).startOf('day').toISOString() : undefined,
    hasta: hasta ? dayjs(hasta).endOf('day').toISOString() : undefined,
    numeroDocumento: docFiltro.trim() || undefined,
    idSede: idSede !== "" ? Number(idSede) : undefined,
  }), [desde, hasta, docFiltro, idSede]);

  const { 
    reporte: rows, 
    isLoading: loadingReport, 
    error, 
    refetch, 
    descargar, 
    isDownloading 
  } = useGestionReportes(reportParams);

  const aplicarFiltroDoc = () => setDocFiltro(docInput);
  const limpiarFiltros = () => {
    setIdSede(isSuperAdmin ? "" : String(user?.idSede || ""));
    setDocInput("");
    setDocFiltro("");
    setDesde(dayjs().startOf("month"));
    setHasta(dayjs().endOf("month"));
  };

  return (
    <>
      <Typography variant="h5" fontWeight={800} sx={{ mb: 2 }}>Reporte de Horas</Typography>
      
      <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="es">
        <Paper sx={{ p: 2, mb: 2 }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="center">
            {isSuperAdmin && (
              <FormControl sx={{ minWidth: 200 }} size="small">
                <InputLabel>Sede</InputLabel>
                <Select 
                  value={idSede} 
                  label="Sede" 
                  onChange={(e) => setIdSede(e.target.value)}
                  disabled={loadingSedes}
                >
                  <MenuItem value="">Todas las Sedes</MenuItem>
                  {sedesList.map(s => (
                    <MenuItem key={s.id} value={String(s.id)}>{s.nombre}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            <TextField
              label="Documento"
              value={docInput}
              onChange={e => setDocInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && aplicarFiltroDoc()}
              size="small"
              sx={{ minWidth: 180 }}
              InputProps={{
                startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} fontSize="small" />,
                endAdornment: docInput && (
                  <IconButton size="small" onClick={() => { setDocInput(""); setDocFiltro(""); }}>
                    <ClearIcon fontSize="small" />
                  </IconButton>
                )
              }}
            />
            
            <Button variant="contained" onClick={aplicarFiltroDoc} disabled={loadingReport}>Buscar</Button>
            
            <DatePicker label="Desde" value={desde} onChange={setDesde} slotProps={{ textField: { size: 'small' } }} format="DD/MM/YYYY" />
            <DatePicker label="Hasta" value={hasta} onChange={setHasta} slotProps={{ textField: { size: 'small' } }} format="DD/MM/YYYY" />

            <Box flexGrow={1} />
            
            <Button
              variant="contained"
              onClick={() => descargar(reportParams)}
              disabled={loadingReport || isDownloading}
              startIcon={isDownloading ? <CircularProgress size={20} /> : <FileDownloadIcon />}
              sx={{ bgcolor: '#107c41', '&:hover': { bgcolor: '#0e6b37' } }}
            >
              Excel
            </Button>

            <IconButton onClick={() => refetch()} color="primary"><ReplayIcon /></IconButton>
          </Stack>
        </Paper>
      </LocalizationProvider>

      {error && <Alert severity="error" sx={{ mb: 2 }}>Error al cargar datos del reporte</Alert>}

      <Paper elevation={2}>
        <TableContainer sx={{ maxHeight: '60vh' }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell><strong>Usuario</strong></TableCell>
                <TableCell><strong>Día</strong></TableCell>
                <TableCell><strong>Nota</strong></TableCell>
                <TableCell align="right"><strong>H. Netas</strong></TableCell>
                <TableCell align="right"><strong>Tardanza</strong></TableCell>
                <TableCell align="right" sx={{ bgcolor: "#e3f2fd" }}><strong>HED (h)</strong></TableCell>
                <TableCell align="right" sx={{ bgcolor: "#fff3e0" }}><strong>HEN (h)</strong></TableCell>
                <TableCell align="right" sx={{ bgcolor: "#f3e5f5" }}><strong>RNO (h)</strong></TableCell>
                <TableCell align="right" sx={{ bgcolor: "#e8f5e9" }}><strong>Total Rec.</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loadingReport ? (
                <TableRow><TableCell colSpan={9} align="center" sx={{ py: 6 }}><CircularProgress /></TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={9} align="center" sx={{ py: 6 }}>No hay datos para mostrar</TableCell></TableRow>
              ) : rows.map((r, i) => (
                <TableRow key={`${r.idUsuario}-${r.dia}-${i}`} hover>
                  <TableCell>{r.nombre}</TableCell>
                  <TableCell>{formatDate(r.dia)}</TableCell>
                  <TableCell sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>{r.notaDia || "-"}</TableCell>
                  <TableCell align="right"><strong>{formatNumber(r.horas)}</strong></TableCell>
                  <TableCell align="right" sx={{ color: r.tardanzaMin > 0 ? 'warning.main' : 'inherit' }}>
                    {formatNumber(r.tardanzaMin, 0)}
                  </TableCell>
                  <TableCell align="right" sx={{ bgcolor: "#e3f2fd" }}>{formatNumber(r.horasExtraDiurnas)}</TableCell>
                  <TableCell align="right" sx={{ bgcolor: "#fff3e0" }}>{formatNumber(r.horasExtraNocturnas)}</TableCell>
                  <TableCell align="right" sx={{ bgcolor: "#f3e5f5" }}>{formatNumber(r.horasRecargoNocturnoOrdinario)}</TableCell>
                  <TableCell align="right" sx={{ bgcolor: "#e8f5e9", fontWeight: "bold" }}>
                    {formatNumber((r.horasExtraDiurnas || 0) + (r.horasExtraNocturnas || 0) + (r.horasRecargoNocturnoOrdinario || 0))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Sección de Totales Inferiores */}
        {!loadingReport && rows.length > 0 && (() => {
          const t = rows.reduce((acc, r) => ({
            hed: acc.hed + (r.horasExtraDiurnas || 0),
            hen: acc.hen + (r.horasExtraNocturnas || 0),
            rno: acc.rno + (r.horasRecargoNocturnoOrdinario || 0)
          }), { hed: 0, hen: 0, rno: 0 });
          
          return (
            <Box sx={{ p: 2, bgcolor: "#f5f5f5", borderTop: "2px solid #ddd" }}>
              <Stack direction="row" spacing={4} justifyContent="flex-start">
                <Box>
                  <Typography variant="caption" display="block" color="text.secondary">TOTAL HED</Typography>
                  <Typography variant="h6" color="primary">{formatNumber(t.hed)}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" display="block" color="text.secondary">TOTAL HEN</Typography>
                  <Typography variant="h6" color="warning.main">{formatNumber(t.hen)}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" display="block" color="text.secondary">TOTAL RNO</Typography>
                  <Typography variant="h6" color="secondary">{formatNumber(t.rno)}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" display="block" color="success.main" fontWeight="bold">TOTAL RECARGOS (h)</Typography>
                  <Typography variant="h6" color="success.main" fontWeight="bold">{formatNumber(t.hed + t.hen + t.rno)}</Typography>
                </Box>
              </Stack>
            </Box>
          );
        })()}
      </Paper>
    </>
  );
}