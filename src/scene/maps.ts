// the paintings you can walk into — ordered early to late
export type MapId = 'wheatfield' | 'auvers' | 'crowfield'

export const MAPS: { id: MapId; titleKey: 'mapWheatfield' | 'mapAuvers' | 'mapCrowfield'; sub: string }[] = [
  { id: 'wheatfield', titleKey: 'mapWheatfield', sub: 'Saint-Rémy · 1889' },
  { id: 'auvers', titleKey: 'mapAuvers', sub: 'Auvers-sur-Oise · 1890' },
  { id: 'crowfield', titleKey: 'mapCrowfield', sub: 'Auvers-sur-Oise · July 1890' },
]

const STORAGE_KEY = 'wheatfield-map'

export function detectMap(): MapId {
  const saved = localStorage.getItem(STORAGE_KEY)
  return saved === 'auvers' || saved === 'crowfield' ? saved : 'wheatfield'
}

export function saveMap(id: MapId) {
  localStorage.setItem(STORAGE_KEY, id)
}
