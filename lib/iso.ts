export type IsoProjectParams = {
  tileW: number
  tileH: number
  originX: number
  originY: number
}

export function projectIso(tx: number, ty: number, p: IsoProjectParams) {
  const hw = p.tileW / 2
  const hh = p.tileH / 2
  const px = (tx - ty) * hw + p.originX
  const py = (tx + ty) * hh + p.originY
  return { px, py }
}

export function unprojectIso(px: number, py: number, p: IsoProjectParams) {
  const hw = p.tileW / 2
  const hh = p.tileH / 2
  const dx = px - p.originX
  const dy = py - p.originY
  const tx = Math.floor((dy / hh + dx / hw) / 2)
  const ty = Math.floor((dy / hh - dx / hw) / 2)
  return { tx, ty }
}
