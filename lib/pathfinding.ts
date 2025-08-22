export type Node = { x: number; y: number }

function key(x: number, y: number) { return x + "," + y }

export function aStar(
  start: Node,
  goal: Node,
  cols: number,
  rows: number,
  isWalkable: (x: number, y: number) => boolean
): Node[] {
  if (!inBounds(start.x, start.y, cols, rows) || !inBounds(goal.x, goal.y, cols, rows)) return [start]
  if (!isWalkable(goal.x, goal.y)) return [start]

  const openSet = new Set<string>([key(start.x, start.y)])
  const cameFrom = new Map<string, string>()
  const gScore = new Map<string, number>()
  const fScore = new Map<string, number>()
  gScore.set(key(start.x, start.y), 0)
  fScore.set(key(start.x, start.y), heuristic(start, goal))

  while (openSet.size) {
    let currentKey = ""
    let best = Infinity
    for (const k of openSet) {
      const fs = fScore.get(k) ?? Infinity
      if (fs < best) { best = fs; currentKey = k }
    }
    const [cx, cy] = currentKey.split(",").map((n) => parseInt(n, 10))
    if (cx === goal.x && cy === goal.y) return reconstruct(cameFrom, currentKey)

    openSet.delete(currentKey)
    for (const [nx, ny] of neighbors(cx, cy)) {
      if (!inBounds(nx, ny, cols, rows) || !isWalkable(nx, ny)) continue
      const nKey = key(nx, ny)
      const tentative = (gScore.get(currentKey) ?? Infinity) + 1
      if (tentative < (gScore.get(nKey) ?? Infinity)) {
        cameFrom.set(nKey, currentKey)
        gScore.set(nKey, tentative)
        fScore.set(nKey, tentative + heuristic({ x: nx, y: ny }, goal))
        if (!openSet.has(nKey)) openSet.add(nKey)
      }
    }
  }
  return [start]
}

function heuristic(a: Node, b: Node) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) }
function neighbors(x: number, y: number): [number, number][] { return [[x+1,y],[x-1,y],[x,y+1],[x,y-1]] }
function inBounds(x: number, y: number, cols: number, rows: number) { return x>=0 && y>=0 && x<cols && y<rows }

function reconstruct(cameFrom: Map<string, string>, currentKey: string): Node[] {
  const path: Node[] = []
  let k: string | undefined = currentKey
  while (k) { const [x, y] = k.split(",").map((n) => parseInt(n, 10)); path.push({ x, y }); k = cameFrom.get(k) }
  path.reverse()
  return path
}
