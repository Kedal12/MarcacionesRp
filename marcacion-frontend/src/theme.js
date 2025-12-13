import { createTheme } from "@mui/material/styles";

// Colores corporativos "La Media Naranja"
const corporateColors = {
  primary: "#e9501e",    // Naranja principal
  secondary: "#fab626",  // Amarillo/Dorado
  dark: "#cc3625",       // Rojo/Naranja oscuro
  white: "#ffffff",
  textDark: "#2d2d2d",
};

const theme = createTheme({
  palette: {
    mode: "light",
    primary: { 
      main: corporateColors.primary,
      dark: corporateColors.dark,
      contrastText: corporateColors.white,
    },
    secondary: { 
      main: corporateColors.secondary,
      contrastText: corporateColors.textDark,
    },
    background: { 
      default: "transparent",
      paper: "rgba(255, 255, 255, 0.95)",
    },
    text: {
      primary: "#2d2d2d",
      secondary: "#555555",
    },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundImage: "url('/fondo-corporativo.webp')", // <--- Ojo: Cambiar a .webp si ya convertiste la imagen
          backgroundSize: "100% auto",
          backgroundPosition: "bottom center",
          backgroundAttachment: "fixed",
          backgroundRepeat: "no-repeat",
          backgroundColor: "#f97316",
          minHeight: "100vh",
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: "rgba(204, 54, 37, 0.95)",
          backdropFilter: "blur(10px)",
          color: corporateColors.white,
        },
      },
    },
    MuiButton: { 
      styleOverrides: { 
        root: { 
          textTransform: "none", 
          fontWeight: 600,
          borderRadius: 8,
        },
        contained: {
          boxShadow: "0 2px 8px rgba(233, 80, 30, 0.3)",
          "&:hover": {
            boxShadow: "0 4px 12px rgba(233, 80, 30, 0.4)",
          },
        },
        text: {
          color: corporateColors.white,
          "&:hover": {
            backgroundColor: "rgba(255, 255, 255, 0.1)",
          },
        },
      },
    },
    MuiPaper: { 
      styleOverrides: { 
        root: { 
          borderRadius: 14,
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.1)",
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(10px)",
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          "& .MuiTableCell-head": {
            backgroundColor: corporateColors.primary,
            color: corporateColors.white,
            fontWeight: 700,
          },
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          "&:hover": {
            backgroundColor: "rgba(233, 80, 30, 0.05)",
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        colorSuccess: {
          backgroundColor: "#4caf50",
          color: "#fff",
        },
        colorWarning: {
          backgroundColor: corporateColors.secondary,
          color: corporateColors.textDark,
        },
        colorError: {
          backgroundColor: corporateColors.dark,
          color: "#fff",
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            backgroundColor: "rgba(255, 255, 255, 0.9)",
            "&:hover .MuiOutlinedInput-notchedOutline": {
              borderColor: corporateColors.primary,
            },
            "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
              borderColor: corporateColors.primary,
            },
          },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        root: {
          backgroundColor: "rgba(255, 255, 255, 0.9)",
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        standardInfo: {
          backgroundColor: "rgba(250, 182, 38, 0.15)",
          color: corporateColors.textDark,
        },
        standardSuccess: {
          backgroundColor: "rgba(76, 175, 80, 0.15)",
        },
        standardWarning: {
          backgroundColor: "rgba(250, 182, 38, 0.2)",
        },
        standardError: {
          backgroundColor: "rgba(204, 54, 37, 0.15)",
        },
      },
    },
    MuiTypography: {
      styleOverrides: {
        h5: {
          fontWeight: 800,
          color: corporateColors.textDark,
        },
        h6: {
          fontWeight: 700,
          color: corporateColors.textDark,
        },
      },
    },
  },
});

export default theme;