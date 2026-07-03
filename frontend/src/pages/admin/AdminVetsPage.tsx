import OsmLibraryPage, { type OsmLibraryConfig } from './OsmLibraryPage';

const config: OsmLibraryConfig = {
  title: 'Vet clinic library',
  entityLabel: 'vet clinic',
  totalLabel: 'Total vets',
  addLabel: '+ Add vet',
  adminBase: '/admin/vets',
  crudBase: '/vets',
  queryPrefix: 'admin-vets',
  importDescription:
    'Refresh the public vet catalog from OpenStreetMap. Re-runs are safe — ' +
    'existing OSM rows are updated in place and user-submitted clinics are never touched.',
  sourceLinks: [
    {
      href: 'https://wiki.openstreetmap.org/wiki/Tag:amenity%3Dveterinary',
      label: 'OSM · amenity=veterinary',
    },
    {
      href: 'https://wiki.openstreetmap.org/wiki/Tag:healthcare%3Dveterinary',
      label: 'healthcare=veterinary',
    },
  ],
  presets: [
    { key: 'sf', label: 'San Francisco', bbox: [37.70, -122.52, 37.83, -122.35] },
    { key: 'nyc', label: 'New York City', bbox: [40.48, -74.26, 40.92, -73.70] },
    { key: 'la', label: 'Los Angeles', bbox: [33.70, -118.67, 34.34, -118.15] },
    { key: 'us', label: 'United States', bbox: [24.40, -125.00, 49.50, -66.90], note: '~30-60s' },
    { key: 'na', label: 'North America', bbox: [7.20, -168.00, 83.20, -52.00], note: 'US + Canada + Mexico, 60-90s' },
    { key: 'eu', label: 'Europe', bbox: [34.50, -31.50, 71.20, 40.20], note: 'can take 60-90s' },
    { key: 'world', label: 'Worldwide', bbox: null, note: 'slow (90-180s), biggest coverage' },
  ],
  defaultSpinnerNote: '60s',
  extraFields: [
    { key: 'phone', label: 'Phone' },
    { key: 'website', label: 'Website' },
    { key: 'hours', label: 'Hours', placeholder: 'e.g. Mon–Fri 8am–6pm', fullWidth: true },
  ],
  rowExtra: (r) => (r.phone ? ` · ${r.phone}` : ''),
};

export default function AdminVetsPage() {
  return <OsmLibraryPage config={config} />;
}
