import { useEffect, useMemo, useState } from "react";
import {
  Paper, Stack, Typography, TextField, Button,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TablePagination, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Alert
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import ReplayIcon from "@mui/icons-material/Replay";
import { useSnackbar } from "notistack";
import {
  getSedes, crearSede, actualizarSede, eliminarSede
} from "../api/sedes";
import MapPicker from "../components/MapPicker";
// --- AÑADIDO: Importar useAuth y definir Roles ---
import { useAuth } from "../auth/AuthContext";

const ROLES = {
  SUPERADMIN: "superadmin",
  ADMIN: "admin"
};
// --- FIN AÑADIDO ---


// --- Diálogo de Sede (Sin cambios) ---
function SedeDialog({ open, onClose, onSave, initial }) {
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
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            autoFocus
            fullWidth
          />

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              label="Latitud (opcional)"
              type="number"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              fullWidth
            />
            <TextField
              label="Longitud (opcional)"
              type="number"
              value={lon}
              onChange={(e) => setLon(e.target.value)}
              fullWidth
            />
          </Stack>

          <Button
            variant="outlined"
            onClick={() => {
              if (!navigator.geolocation) return;
              navigator.geolocation.getCurrentPosition(
                (pos) => {
                  const la = Number(pos.coords.latitude.toFixed(6));
                  const lo = Number(pos.coords.longitude.toFixed(6));
                  setLat(la);
                  setLon(lo);
                },
                () => {},
                { enableHighAccuracy: true }
              );
            }}
          >
            Usar mi ubicación
          </Button>

          <MapPicker
            lat={latNum}
            lon={lonNum}
            onChange={(la, lo) => {
              setLat(la);
              setLon(lo);
            }}
            height={300}
          />

          <Typography variant="caption" color="text.secondary">
            Consejo: puedes hacer click en el mapa o arrastrar el marcador. Los
            valores se copian a los campos de Lat/Lon automáticamente.
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button
          variant="contained"
          onClick={() =>
            onSave({
              nombre: nombre.trim(),
              lat: lat === "" ? null : Number(lat),
              lon: lon === "" ? null : Number(lon),
            })
          }
        >
          Guardar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
// --- FIN DIÁLOGO ---


export default function Sedes() {
  const { enqueueSnackbar } = useSnackbar();
  // --- AÑADIDO: Obtener usuario y rol ---
  const { user } = useAuth();
  const isSuperAdmin = useMemo(() => user?.rol === ROLES.SUPERADMIN, [user]);
  // --- FIN AÑADIDO ---

  const [search, setSearch] = useState("");
  const [data, setData] = useState({ items: [], total: 0, page: 1, pageSize: 10 });
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const query = useMemo(() => ({
    search: search.trim() || undefined,
    page: page + 1,
    pageSize: rowsPerPage,
  }), [search, page, rowsPerPage]);

  function load() {
    setLoading(true); setErr(null);
    return getSedes(query)
      .then(setData)
      .catch(e => setErr(e?.response?.data || e.message || "Error cargando sedes"))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [query]);

  // onSave y onDelete solo pueden ser llamados por SuperAdmin,
  // ya que los botones estarán ocultos para otros roles.
  async function onSave(dto) {
    try {
      if (!dto.nombre) {
        enqueueSnackbar("El nombre es obligatorio.", { variant: "warning" });
        return;
      }
      if (editing) {
        await actualizarSede(editing.id, dto);
        enqueueSnackbar("Sede actualizada", { variant: "success" });
      } else {
        await crearSede(dto);
        enqueueSnackbar("Sede creada", { variant: "success" });
      }
      setDialogOpen(false); setEditing(null);
      await load();
    } catch (e) {
      enqueueSnackbar(e?.response?.data || e.message || "Error al guardar", { variant: "error" });
    }
  }

  async function onDelete(row) {
    if (!confirm(`¿Eliminar la sede "${row.nombre}"?`)) return;
    try {
      setDeletingId(row.id);
      await eliminarSede(row.id);
      enqueueSnackbar("Sede eliminada", { variant: "success" });
      await load();
    } catch (e) {
      enqueueSnackbar(e?.response?.data || e.message || "No se pudo eliminar", { variant: "error" });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Stack spacing={2}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography variant="h5" fontWeight={800}>Sedes</Typography>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            startIcon={<ReplayIcon />}
            onClick={() => load()}
            disabled={loading}
          >
            Refrescar
          </Button>
          {/* --- MODIFICADO: Botón solo para SuperAdmin --- */}
          {isSuperAdmin && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => { setEditing(null); setDialogOpen(true); }}
            >
              Nueva sede
            </Button>
          )}
          {/* --- FIN MODIFICADO --- */}
        </Stack>
      </Stack>

      <Paper sx={{ p: 2 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <TextField
            label="Buscar por nombre"
            value={search}
            onChange={(e) => { setPage(0); setSearch(e.target.value); }}
            sx={{ minWidth: 280 }}
          />
          <Box sx={{ flexGrow: 1 }} />
        </Stack>
      </Paper>

      {err && <Alert severity="error">{String(err)}</Alert>}

      <Paper>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Nombre</TableCell>
                <TableCell>Lat</TableCell>
                <TableCell>Lon</TableCell>
                <TableCell align="right">Usuarios</TableCell>
                {/* --- MODIFICADO: Columna solo para SuperAdmin --- */}
                {isSuperAdmin && (
                  <TableCell align="right">Acciones</TableCell>
                )}
                {/* --- FIN MODIFICADO --- */}
              </TableRow>
            </TableHead>
            <TableBody>
              {data.items.map(row => (
                <TableRow key={row.id} hover>
                  <TableCell>{row.id}</TableCell>
                  <TableCell>{row.nombre}</TableCell>
                  <TableCell>{row.lat ?? "-"}</TableCell>
                  <TableCell>{row.lon ?? "-"}</TableCell>
                  <TableCell align="right">{row.usuarios}</TableCell>
                  {/* --- MODIFICADO: Celda solo para SuperAdmin --- */}
                  {isSuperAdmin && (
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => { setEditing(row); setDialogOpen(true); }}>
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => onDelete(row)}
                        disabled={deletingId === row.id}
                      >
                        <DeleteForeverIcon />
                      </IconButton>
                    </TableCell>
                  )}
                  {/* --- FIN MODIFICADO --- */}
                </TableRow>
              ))}
              {data.items.length === 0 && (
                <TableRow>
                  {/* --- MODIFICADO: ColSpan dinámico --- */}
                  <TableCell colSpan={isSuperAdmin ? 6 : 5} align="center" sx={{ py: 4, color: "text.secondary" }}>
                    Sin resultados
                  </TableCell>
                  {/* --- FIN MODIFICADO --- */}
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
      </Paper>

      {/* --- MODIFICADO: Diálogo solo para SuperAdmin --- */}
      {isSuperAdmin && (
        <SedeDialog
          open={dialogOpen}
          onClose={() => { setDialogOpen(false); setEditing(null); }}
          onSave={onSave}
          initial={editing && {
            id: editing.id,
            nombre: editing.nombre,
            lat: editing.lat,
            lon: editing.lon
          }}
        />
      )}
      {/* --- FIN MODIFICADO --- */}
    </Stack>
  );
}

