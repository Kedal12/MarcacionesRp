import { useEffect, useMemo, useState } from "react";
import {
  Paper, Stack, Typography, TextField, Button,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TablePagination, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Alert, CircularProgress
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import ReplayIcon from "@mui/icons-material/Replay";
import { useSnackbar } from "notistack";

// 1. Importar Hooks de React Query y Auth
import { 
  useSedes, 
  useCrearSede, 
  useActualizarSede, 
  useEliminarSede 
} from "../hooks/useSedes";
import { useAuth } from "../auth/AuthContext";
import MapPicker from "../components/MapPicker";

const ROLES = {
  SUPERADMIN: "superadmin",
  ADMIN: "admin"
};

// --- Diálogo de Sede Integrado para evitar errores de referencia ---
function SedeDialog({ open, onClose, onSave, initial, isSaving }) {
  const [nombre, setNombre] = useState(initial?.nombre ?? "");
  const [lat, setLat] = useState(initial?.lat ?? "");
  const [lon, setLon] = useState(initial?.lon ?? "");

  useEffect(() => {
    setNombre(initial?.nombre ?? "");
    setLat(initial?.lat ?? "");
    setLon(initial?.lon ?? "");
  }, [initial]);

  const latNum = lat === "" ? null : Number(lat);
  const lonNum = lon === "" ? null : Number(lon);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{initial ? "Editar sede" : "Nueva sede"}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            autoFocus
            fullWidth
            disabled={isSaving}
          />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              label="Latitud"
              type="number"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              fullWidth
              disabled={isSaving}
            />
            <TextField
              label="Longitud"
              type="number"
              value={lon}
              onChange={(e) => setLon(e.target.value)}
              fullWidth
              disabled={isSaving}
            />
          </Stack>
          <MapPicker
            lat={latNum}
            lon={lonNum}
            onChange={(la, lo) => {
              setLat(la);
              setLon(lo);
            }}
            height={300}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isSaving}>Cancelar</Button>
        <Button
          variant="contained"
          disabled={isSaving || !nombre.trim()}
          onClick={() =>
            onSave({
              nombre: nombre.trim(),
              lat: lat === "" ? null : Number(lat),
              lon: lon === "" ? null : Number(lon),
            })
          }
        >
          {isSaving ? <CircularProgress size={24} /> : "Guardar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// --- Componente Principal ---
export default function Sedes() {
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuth();
  const isSuperAdmin = useMemo(() => user?.rol === ROLES.SUPERADMIN, [user]);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  // 2. Parámetros de Query
  const queryParams = useMemo(() => ({
    search: search.trim() || undefined,
    page: page + 1,
    pageSize: rowsPerPage,
  }), [search, page, rowsPerPage]);

  // 3. Hooks de Datos y Acciones (React Query)
  const { data, isLoading, isError, error, refetch } = useSedes(queryParams);
  const createMutation = useCrearSede();
  const updateMutation = useActualizarSede();
  const deleteMutation = useEliminarSede();

  const isActionLoading = createMutation.isLoading || updateMutation.isLoading;

  async function onSave(dto) {
    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, dto });
      } else {
        await createMutation.mutateAsync(dto);
      }
      setDialogOpen(false);
      setEditing(null);
    } catch (e) {
      // Errores ya manejados en los hooks con snackbars
    }
  }

  const handleDelete = (row) => {
    if (window.confirm(`¿Eliminar la sede "${row.nombre}"?`)) {
      deleteMutation.mutate(row.id);
    }
  };

  return (
    <Stack spacing={2}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography variant="h5" fontWeight={800}>Sedes</Typography>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            startIcon={<ReplayIcon />}
            onClick={() => refetch()}
            disabled={isLoading}
          >
            Refrescar
          </Button>
          {isSuperAdmin && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => { setEditing(null); setDialogOpen(true); }}
            >
              Nueva sede
            </Button>
          )}
        </Stack>
      </Stack>

      <Paper sx={{ p: 2 }}>
        <TextField
          label="Buscar por nombre"
          value={search}
          size="small"
          onChange={(e) => { setPage(0); setSearch(e.target.value); }}
          sx={{ minWidth: 280 }}
        />
      </Paper>

      {isError && <Alert severity="error">{error?.message || "Error al cargar sedes"}</Alert>}

      <Paper elevation={3}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Nombre</TableCell>
                <TableCell>Lat</TableCell>
                <TableCell>Lon</TableCell>
                <TableCell align="right">Usuarios</TableCell>
                {isSuperAdmin && <TableCell align="right">Acciones</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4 }}><CircularProgress /></TableCell></TableRow>
              ) : data?.items?.map(row => (
                <TableRow key={row.id} hover>
                  <TableCell>{row.id}</TableCell>
                  <TableCell>{row.nombre}</TableCell>
                  <TableCell>{row.lat ?? "-"}</TableCell>
                  <TableCell>{row.lon ?? "-"}</TableCell>
                  <TableCell align="right">{row.usuarios}</TableCell>
                  {isSuperAdmin && (
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => { setEditing(row); setDialogOpen(true); }}>
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDelete(row)}
                        disabled={deleteMutation.isLoading && deleteMutation.variables === row.id}
                      >
                        <DeleteForeverIcon />
                      </IconButton>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          component="div"
          count={data?.total || 0}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
          labelRowsPerPage="Filas"
        />
      </Paper>

      {isSuperAdmin && (
        <SedeDialog
          open={dialogOpen}
          onClose={() => { setDialogOpen(false); setEditing(null); }}
          onSave={onSave}
          isSaving={isActionLoading}
          initial={editing}
        />
      )}
    </Stack>
  );
}