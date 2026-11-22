// WGS84 <-> Rijksdriehoek (RD New) met de benaderingsformules van Schreutelaar (fout < 1 m).
const R = [[0, 1, 190094.945], [1, 1, -11832.228], [2, 1, -114.221], [0, 3, -32.391], [1, 0, -0.705], [3, 1, -2.34], [1, 3, -0.608], [0, 2, -0.008], [2, 3, 0.148]];
const S = [[1, 0, 309056.544], [0, 2, 3638.893], [2, 0, 73.077], [1, 2, -157.984], [3, 0, 59.788], [0, 1, 0.433], [2, 2, -6.439], [1, 1, -0.032], [0, 4, 0.092], [1, 4, -0.054]];

export function naarRD(lat, lon) {
  const dp = 0.36 * (lat - 52.1551744), dl = 0.36 * (lon - 5.38720621);
  let x = 155000, y = 463000;
  for (const [p, q, r] of R) x += r * dp ** p * dl ** q;
  for (const [p, q, s] of S) y += s * dp ** p * dl ** q;
  return [x, y];
}
