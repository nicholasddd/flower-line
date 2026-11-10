// The florist's stems, sold one by one for the build-your-own bouquet.
//
// PLACEHOLDER LIST: replace with the real inventory. For each stem:
//   id      unique, no spaces
//   name    as the customer should see it
//   price   per stem, in baht
//   note    optional, a few words (colour, size, season)
//   art     optional, which painted flower to show: one of roses, peonies,
//           carnations, begonias, daisies, hydrangeas, orchids, lilies,
//           chrysanthemums, ranunculus, dahlias, tulips, irises, azaleas,
//           sunflowers, violets
//   colour  used for a simple painted bloom when there is no matching art
//   soldOut optional, true to show it greyed out

export const CURRENCY = '฿';

export const STEMS = [
  { id: 'garden-rose', name: 'Garden rose', price: 120, note: 'deep red', art: 'roses' },
  { id: 'peony', name: 'Peony', price: 180, note: 'blush pink', art: 'peonies' },
  { id: 'ranunculus', name: 'Ranunculus', price: 90, note: 'apricot', art: 'ranunculus' },
  { id: 'tulip', name: 'Tulip', price: 70, note: 'orange', art: 'tulips' },
  { id: 'carnation', name: 'Carnation', price: 45, note: 'pink', art: 'carnations' },
  { id: 'lily', name: 'Lily', price: 110, note: 'pink, fragrant', art: 'lilies' },
  { id: 'hydrangea', name: 'Hydrangea', price: 160, note: 'blue, one big head', art: 'hydrangeas' },
  { id: 'dahlia', name: 'Dahlia', price: 130, note: 'violet', art: 'dahlias' },
  { id: 'chrysanthemum', name: 'Chrysanthemum', price: 50, note: 'pink spray', art: 'chrysanthemums' },
  { id: 'iris', name: 'Iris', price: 80, note: 'purple', art: 'irises' },
  { id: 'orchid', name: 'Orchid', price: 150, note: 'yellow spray', art: 'orchids' },
  { id: 'sunflower', name: 'Sunflower', price: 75, note: 'one large head', art: 'sunflowers' },
  { id: 'daisy', name: 'Field daisy', price: 30, note: 'white', art: 'daisies' },
  { id: 'azalea', name: 'Azalea sprig', price: 60, note: 'soft pink', art: 'azaleas' },
  { id: 'begonia', name: 'Begonia', price: 55, note: 'pale pink', art: 'begonias' },
  { id: 'violet', name: 'Violet bunch', price: 65, note: 'small, purple', art: 'violets' },
];

// wrapping the florist can finish it in
export const WRAPS = [
  { id: 'kraft', name: 'Kraft', paper: '#c8a57c', ribbon: '#7a2232' },
  { id: 'blush', name: 'Blush tissue', paper: '#efd2d6', ribbon: '#a0583a' },
  { id: 'ivory', name: 'Ivory', paper: '#efe8da', ribbon: '#3f5d48' },
  { id: 'night', name: 'Midnight', paper: '#2f3550', ribbon: '#d8c08a' },
];

export const MAX_PER_STEM = 50;
