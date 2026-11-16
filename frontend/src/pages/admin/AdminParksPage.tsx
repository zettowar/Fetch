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
    // The launch market first.
    { key: 'toronto', label: 'Toronto', bbox: [43.58, -79.64, 43.86, -79.12] },
    { key: 'vancouver', label: 'Vancouver', bbox: [49.00, -123.30, 49.40, -122.40] },
    { key: 'montreal', label: 'Montréal', bbox: [45.40, -73.98, 45.71, -73.47] },
    { key: 'calgary', label: 'Calgary', bbox: [50.84, -114.32, 51.21, -113.86] },
    { key: 'edmonton', label: 'Edmonton', bbox: [53.39, -113.72, 53.72, -113.27] },
    { key: 'ottawa', label: 'Ottawa', bbox: [45.20, -76.00, 45.54, -75.40] },
    { key: 'winnipeg', label: 'Winnipeg', bbox: [49.76, -97.33, 49.98, -96.95] },
    { key: 'ca', label: 'Canada', bbox: [41.67, -141.00, 83.11, -52.62], note: '~30-60s' },
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
