import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import tz from "dayjs/plugin/timezone";
dayjs.extend(utc);
dayjs.extend(tz);

export function fmt(dt) {
  const zone = import.meta.env.VITE_TZ || "America/Bogota";
  return dayjs(dt).tz(zone).format("YYYY-MM-DD HH:mm");
}
