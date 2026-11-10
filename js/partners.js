// Partner florists shown on the map.
//
// PLACEHOLDER LIST: replace with the real partners. For each:
//   name     shop name
//   area     neighbourhood or city, shown under the name
//   address  optional, shown in the list
//   contact  optional, LINE ID or phone
//   hours    optional
//   lat, lng where to drop the pin (right-click a spot in Google Maps to copy them)

export const PARTNERS = [
  { name: 'Partner florist one', area: 'Ari, Bangkok', address: 'placeholder address', contact: '@placeholder', hours: '9:00–19:00', lat: 13.7797, lng: 100.5446 },
  { name: 'Partner florist two', area: 'Thonglor, Bangkok', address: 'placeholder address', contact: '@placeholder', hours: '10:00–20:00', lat: 13.7325, lng: 100.5830 },
  { name: 'Partner florist three', area: 'Pak Khlong Talat, Bangkok', address: 'placeholder address', contact: '@placeholder', hours: 'open all night', lat: 13.7428, lng: 100.4970 },
  { name: 'Partner florist four', area: 'Nimman, Chiang Mai', address: 'placeholder address', contact: '@placeholder', hours: '9:00–18:00', lat: 18.7980, lng: 98.9680 },
];

// how close the map starts when a florist is picked (higher is closer)
export const ZOOM = 15;
