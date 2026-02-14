import React, { useState, useMemo, useEffect } from "react";
import { useSnackbar } from "notistack";
import {
  Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TablePagination, Stack, Box, TextField,
  Select, MenuItem, Chip, CircularProgress, Button, IconButton, 
  Tooltip, InputAdornment, Dialog, DialogTitle, DialogContent, 
  DialogActions, Grid, FormControl, InputLabel,
  // ✅ AGREGAR ESTAS DOS IMPORTACIONES QUE FALTABAN:
  FormControlLabel, Switch 
} from "@mui/material";

// Iconos
import {
  Add as AddIcon, Edit as EditIcon, DeleteForever as DeleteIcon,
  VpnKey as KeyIcon, PhotoCamera as PhotoIcon, Refresh as RefreshIcon,
  Visibility as VisibilityIcon, VisibilityOff as VisibilityOffIcon,
  HelpOutline as HelpOutlineIcon, FileUpload as FileUploadIcon
} from "@mui/icons-material";

// Hooks y API
import { useUsuarios, useUsuariosMutation, useEliminarUsuario, useResetPassword } from "../hooks/useUsuarios"; 
import { useSedesAll } from "../hooks/useSedes";
import { useAuth } from "../auth/AuthContext";
import { useDebounce } from "../hooks/useDebounce"; 
import { registrarFotoPerfil } from "../api/auth"; 
import { crearUsuario, actualizarUsuario, importarUsuarios } from "../api/usuarios";

const Usuarios = () => {
  const { enqueueSnackbar } = useSnackbar();
  const { user: currentUser } = useAuth();
  const isSuperAdmin = useMemo(() => currentUser?.rol === "superadmin", [currentUser]);

  // 1. Estados de filtros y paginación
  const [page, setPage] = useState(0);
  // ✅ CAMBIO: Usar 25 para evitar el error de "out-of-range" de MUI que sale en tu consola
  const [pageSize, setPageSize] = useState(25); 
  const [search, setSearch] = useState("");
  const [docSearch, setDocSearch] = useState("");

  const [fSede, setFSede] = useState(() => {
    return isSuperAdmin ? "" : String(currentUser?.idSede || "");
  });
  
  const [fActivo, setFActivo] = useState("true");

  const debouncedSearch = useDebounce(search, 500);
  const debouncedDocSearch = useDebounce(docSearch, 500);

  const [openImportHelp, setOpenImportHelp] = useState(false);
  const [modal, setModal] = useState({ open: false, type: 'create', user: null });
  const [formData, setFormData] = useState({
    nombre: "", email: "", password: "", tipoDoc: "CC", numDoc: "", rol: "empleado", sede: "", activo: true
  });
  
  const [resetModal, setResetModal] = useState({ open: false, user: null, newPass: "", show: false });

  const { data, isLoading, refetch } = useUsuarios({
    page: page + 1,
    pageSize: pageSize,
    search: debouncedSearch,
    numeroDocumento: debouncedDocSearch,
    idSede: isSuperAdmin ? fSede : currentUser?.idSede, 
    activo: fActivo === "all" ? null : fActivo === "true"
  });

  const { data: sedesData } = useSedesAll();
  const sedesList = useMemo(() => (Array.isArray(sedesData) ? sedesData : sedesData?.items || []), [sedesData]);

  const { mutate: toggleStatus } = useUsuariosMutation();
  const { mutate: eliminar } = useEliminarUsuario();
  const { mutate: resetPassMutate, isLoading: isResetting } = useResetPassword();

  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, debouncedDocSearch, fSede, fActivo]);

  const handleResetPassword = () => {
    if (!resetModal.newPass || resetModal.newPass.length < 6) {
      enqueueSnackbar("La contraseña debe tener al menos 6 caracteres", { variant: "warning" });
      return;
    }
    resetPassMutate({ id: resetModal.user.id, password: resetModal.newPass }, {
      onSuccess: () => setResetModal({ open: false, user: null, newPass: "", show: false })
    });
  };

  const handleSave = async () => {
    try {
      if (modal.type === 'create') {
        await crearUsuario({
          nombreCompleto: formData.nombre,
          email: formData.email,
          password: formData.password,
          tipoDocumento: formData.tipoDoc,
          numeroDocumento: formData.numDoc,
          rol: isSuperAdmin ? formData.rol : "empleado",
          idSede: isSuperAdmin ? Number(formData.sede) : currentUser.idSede
        });
        enqueueSnackbar("Usuario creado", { variant: "success" });
      } else {
        await actualizarUsuario(modal.user.id, {
          nombreCompleto: formData.nombre,
          rol: formData.rol,
          idSede: Number(formData.sede),
          tipoDocumento: formData.tipoDoc,
          numeroDocumento: formData.numDoc,
          activo: formData.activo
        });
        enqueueSnackbar("Usuario actualizado", { variant: "success" });
      }
      setModal({ open: false, type: 'create', user: null });
      refetch();
    } catch (err) {
      enqueueSnackbar(err?.response?.data || "Error en la operación", { variant: "error" });
    }
  };

  const handleFileChange = async (event, targetUser) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement("canvas");
        const MAX_SIZE = 800; 
        let w = img.width, h = img.height;
        if (w > h ? w > MAX_SIZE : h > MAX_SIZE) {
          w > h ? (h *= MAX_SIZE / w, w = MAX_SIZE) : (w *= MAX_SIZE / h, h = MAX_SIZE);
        }
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        const base64 = canvas.toDataURL("image/jpeg", 0.7).split(",")[1];
        try {
          await registrarFotoPerfil(base64, targetUser.id);
          enqueueSnackbar(`Biometría de ${targetUser.nombreCompleto} actualizada`, { variant: "success" });
          refetch();
        } catch (err) { enqueueSnackbar("Error al procesar biometría", { variant: "error" }); }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (modal.type === 'edit' && modal.user) {
      const u = modal.user;
      setFormData({
        nombre: u.nombreCompleto || "", email: u.email || "", password: "",
        tipoDoc: u.tipoDocumento || "CC", numDoc: u.numeroDocumento || "",
        rol: u.rol || "empleado", sede: u.idSede ? String(u.idSede) : "", activo: u.activo
      });
    } else {
      setFormData({ nombre: "", email: "", password: "", tipoDoc: "CC", numDoc: "", rol: "empleado", sede: "", activo: true });
    }
  }, [modal]);

  return (
    <Box sx={{ p: 3, backgroundColor: "#f8f9fa", minHeight: "100vh" }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight="bold">Usuarios</Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <Tooltip title="Guía de importación"><IconButton onClick={() => setOpenImportHelp(true)} color="info"><HelpOutlineIcon /></IconButton></Tooltip>
          <Button variant="outlined" component="label" color="success" startIcon={<FileUploadIcon />}>
            Importar Excel <input type="file" hidden accept=".xlsx, .xls" onChange={(e) => {
                const file = e.target.files[0];
                if(file) importarUsuarios(file).then(res => { enqueueSnackbar(res.mensaje, {variant: 'success'}); refetch(); }).catch(() => enqueueSnackbar("Error al importar", {variant: 'error'}));
            }} />
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setModal({ open: true, type: 'create', user: null })}>Nuevo Usuario</Button>
        </Stack>
      </Stack>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <TextField label="Nombre o Email" size="small" fullWidth value={search} onChange={(e) => setSearch(e.target.value)} />
          <TextField label="Documento" size="small" fullWidth value={docSearch} onChange={(e) => setDocSearch(e.target.value)} />
          
          <FormControl fullWidth size="small">
            <InputLabel>Sede</InputLabel>
            <Select 
              value={fSede} 
              onChange={(e) => setFSede(e.target.value)} 
              label="Sede"
              disabled={!isSuperAdmin}
            >
              {isSuperAdmin ? (
                [<MenuItem key="all" value="">Sedes (Todas)</MenuItem>,
                ...sedesList.map(s => <MenuItem key={s.id} value={String(s.id)}>{s.nombre}</MenuItem>)]
              ) : (
                <MenuItem value={String(currentUser?.idSede)}>{currentUser?.nombreSede || "Mi Sede"}</MenuItem>
              )}
            </Select>
          </FormControl>

          <Select value={fActivo} onChange={(e) => setFActivo(e.target.value)} size="small" fullWidth>
            <MenuItem value="true">Activos</MenuItem>
            <MenuItem value="false">Inactivos</MenuItem>
          </Select>
          <IconButton onClick={() => refetch()} color="primary"><RefreshIcon /></IconButton>
        </Stack>
      </Paper>

      <TableContainer component={Paper}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow sx={{ backgroundColor: "#f0f2f5" }}>
              <TableCell><strong>Nombre y Email</strong></TableCell>
              <TableCell><strong>Documento</strong></TableCell>
              <TableCell><strong>Sede</strong></TableCell>
              <TableCell><strong>Rol</strong></TableCell> 
              <TableCell><strong>Estado</strong></TableCell>
              <TableCell align="right"><strong>Acciones</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} align="center" sx={{ py: 5 }}><CircularProgress size={30} /></TableCell></TableRow>
            ) : data?.items.length === 0 ? (
              <TableRow><TableCell colSpan={6} align="center" sx={{ py: 3 }}>No se encontraron usuarios</TableCell></TableRow>
            ) : (
              data?.items.map((u) => (
                <TableRow key={u.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">{u.nombreCompleto}</Typography>
                    <Typography variant="caption" color="textSecondary">{u.email}</Typography>
                  </TableCell>
                  <TableCell>{u.tipoDocumento} {u.numeroDocumento}</TableCell>
                  <TableCell>{u.sedeNombre}</TableCell>
                  <TableCell><Chip label={u.rol?.toUpperCase()} size="small" variant="outlined" color={u.rol === "superadmin" ? "secondary" : u.rol === "admin" ? "primary" : "default"} /></TableCell>
                  <TableCell><Chip label={u.activo ? "Activo" : "Inactivo"} color={u.activo ? "success" : "default"} size="small" onClick={() => toggleStatus({ id: u.id, activo: !u.activo })} sx={{ cursor: 'pointer' }} /></TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                      <IconButton component="label" size="small" color="primary"><PhotoIcon fontSize="small" /><input type="file" hidden accept="image/*" onChange={(e) => handleFileChange(e, u)} /></IconButton>
                      <IconButton size="small" color="info" onClick={() => setModal({ open: true, type: 'edit', user: u })}><EditIcon fontSize="small"/></IconButton>
                      <IconButton size="small" color="warning" onClick={() => setResetModal({ open: true, user: u, newPass: "", show: false })}><KeyIcon fontSize="small"/></IconButton>
                      <IconButton size="small" color="error" onClick={() => { if(window.confirm('¿Eliminar usuario?')) eliminar(u.id); }}><DeleteIcon fontSize="small"/></IconButton>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={data?.total || 0}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          rowsPerPage={pageSize}
          // ✅ Las opciones deben incluir el valor de pageSize (25)
          rowsPerPageOptions={[10, 25, 50, 100]} 
          onRowsPerPageChange={(e) => { setPageSize(parseInt(e.target.value, 10)); setPage(0); }}
          labelRowsPerPage="Filas por página"
        />
      </TableContainer>

      {/* MODAL RESET PASSWORD */}
      <Dialog open={resetModal.open} onClose={() => setResetModal({ ...resetModal, open: false })}>
        <DialogTitle>Restablecer Contraseña</DialogTitle>
        <DialogContent>
           <Typography variant="body2" sx={{ mb: 2 }}>Usuario: {resetModal.user?.nombreCompleto}</Typography>
          <Box sx={{ mt: 1, minWidth: 300 }}>
            <TextField fullWidth label="Nueva Contraseña" type={resetModal.show ? "text" : "password"} value={resetModal.newPass} onChange={(e) => setResetModal({ ...resetModal, newPass: e.target.value })}
              InputProps={{ endAdornment: (<InputAdornment position="end"><IconButton onClick={() => setResetModal({ ...resetModal, show: !resetModal.show })}>{resetModal.show ? <VisibilityOffIcon /> : <VisibilityIcon />}</IconButton></InputAdornment>), }}
            />
          </Box>
        </DialogContent>
        <DialogActions><Button onClick={() => setResetModal({ ...resetModal, open: false })}>Cancelar</Button><Button variant="contained" color="warning" onClick={handleResetPassword} disabled={isResetting}>Confirmar Cambio</Button></DialogActions>
      </Dialog>

      {/* MODAL CREAR/EDITAR */}
      <Dialog open={modal.open} onClose={() => setModal({ ...modal, open: false })} maxWidth="sm" fullWidth>
        <DialogTitle>{modal.type === 'create' ? 'Nuevo Usuario' : 'Editar Usuario'}</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={4}><FormControl fullWidth size="small"><InputLabel>Tipo Doc</InputLabel><Select value={formData.tipoDoc} label="Tipo Doc" onChange={(e) => setFormData({...formData, tipoDoc: e.target.value})}><MenuItem value="CC">Cédula</MenuItem><MenuItem value="CE">Extranjería</MenuItem></Select></FormControl></Grid>
            <Grid item xs={8}><TextField label="Documento" fullWidth size="small" value={formData.numDoc} onChange={(e) => setFormData({...formData, numDoc: e.target.value})} /></Grid>
            <Grid item xs={12}><TextField label="Nombre Completo" fullWidth size="small" value={formData.nombre} onChange={(e) => setFormData({...formData, nombre: e.target.value})} /></Grid>
            {modal.type === 'create' && (<><Grid item xs={12}><TextField label="Email" fullWidth size="small" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} /></Grid><Grid item xs={12}><TextField label="Contraseña" type="password" fullWidth size="small" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} /></Grid></>)}
            {isSuperAdmin && (
              <>
                <Grid item xs={6}><FormControl fullWidth size="small"><InputLabel>Sede</InputLabel><Select value={formData.sede} label="Sede" onChange={(e) => setFormData({...formData, sede: e.target.value})}>{sedesList.map(s => <MenuItem key={s.id} value={String(s.id)}>{s.nombre}</MenuItem>)}</Select></FormControl></Grid>
                <Grid item xs={6}><FormControl fullWidth size="small"><InputLabel>Rol</InputLabel><Select value={formData.rol} label="Rol" onChange={(e) => setFormData({...formData, rol: e.target.value})}><MenuItem value="empleado">Empleado</MenuItem><MenuItem value="admin">Admin</MenuItem><MenuItem value="superadmin">SuperAdmin</MenuItem></Select></FormControl></Grid>
              </>
            )}
            {/* ✅ AQUÍ ESTABA EL ERROR: FormControlLabel y Switch ahora funcionarán */}
            {modal.type === 'edit' && (
               <Grid item xs={12}>
                 <FormControlLabel
                   control={<Switch checked={formData.activo} onChange={(e) => setFormData({...formData, activo: e.target.checked})} />}
                   label="Usuario Activo"
                 />
               </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions><Button onClick={() => setModal({ ...modal, open: false })}>Cancelar</Button><Button variant="contained" onClick={handleSave}>Guardar</Button></DialogActions>
      </Dialog>
    </Box>
  );
};

export default Usuarios;