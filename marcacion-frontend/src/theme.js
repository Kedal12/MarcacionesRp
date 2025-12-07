import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#6366f1" },   // indigo
    secondary: { main: "#22d3ee" }, // cyan
    background: { default: "#0b0b0b", paper: "#151515" },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiButton: { styleOverrides: { root: { textTransform: "none", fontWeight: 600 } } },
    MuiPaper: { styleOverrides: { root: { borderRadius: 14 } } },
  },
});

export default theme;
