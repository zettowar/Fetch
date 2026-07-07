import OsmLibraryPage, { type OsmLibraryConfig } from './OsmLibraryPage';

const config: OsmLibraryConfig = {
  title: 'Pet parks library',
  entityLabel: 'park',
  totalLabel: 'Total parks',
  addLabel: '+ Add park',
  adminBase: '/admin/parks',
  crudBase: '/parks',
  queryPrefix: 'admin-parks',
  importDescription:
    'Refresh the public parks catalog from OpenStreetMap. Re-runs are safe — ' +
    'existing OSM rows are updated in place and user-submitted parks are never touched.',
  sourceLinks: [
    {
      href: 'https://wiki.openstreetmap.org/wiki/Tag:leisure%3Ddog_park',
      label: 'OSM · leisure=dog_park',
    },
  ],
  presets: [
    { key: 'sf', label: 'San Francisco', bbox: [37.70, -122.52, 37.83, -122.35] },
    { key: 'nyc', label: 'New York City', bbox: [40.48, -74.26, 40.92, -73.70] },
    { key: 'la', label: 'Los Angeles', bbox: [33.70, -118.67, 34.34, -118.15] },
    { key: 'us', label: 'United States', bbox: [24.40, -125.00, 49.50, -66.90], note: '~15-30s' },
    { key: 'na', label: 'North America', bbox: [7.20, -168.00, 83.20, -52.00], note: 'US + Canada + Mexico, 30-60s' },
    { key: 'eu', label: 'Europe', bbox: [34.50, -31.50, 71.20, 40.20], note: 'can take 30-60s' },
    { key: 'world', label: 'Worldwide', bbox: null, note: 'slow (60-120s), biggest coverage' },
  ],
  defaultSpinnerNote: '30s',
  extraFields: [],
};

export default function AdminParksPage() {
  return <OsmLibraryPage config={config} />;
}
