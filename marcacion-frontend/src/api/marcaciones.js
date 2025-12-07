import api from "./axios";

export async function getMarcaciones(params = {}) {
  const { data } = await api.get("/api/marcaciones", { params });
  return data; // { items, total, page, pageSize }
}
