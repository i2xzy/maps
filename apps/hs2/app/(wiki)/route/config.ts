export type Region = {
  id: string;
  name: string;
  description: string;
  image: string;
  imageAlt: string;
  chainageFrom: number;
  chainageTo: number;
};

export const REGIONS: Region[] = [
  {
    id: 'london',
    name: 'London Metropolitan',
    description: 'From London Euston to the Colne Valley.',
    image:
      'https://cdn.prgloo.com/media/7f6bd4699d4e43a48c8d5cd285912036.jpg?width=1120&height=1680',
    imageAlt:
      "First platforms installed at HS2's Old Oak Common station for HS2 trains - May 2025",
    chainageFrom: 0,
    chainageTo: 25800,
  },
  {
    id: 'south',
    name: 'Country South',
    description: 'From the Colne Valley to Lower Boddington, Northamptonshire.',
    image:
      'https://cdn.prgloo.com/media/869fa74e7c4b474190772c734425263b.jpg?width=1120&height=1680',
    imageAlt: 'Colne Valley Viaduct Sept 25',
    chainageFrom: 25800,
    chainageTo: 115200,
  },
  {
    id: 'north',
    name: 'Country North',
    description: 'From Wormleighton, Warwickshire to Handsacre, Staffordshire.',
    image:
      'https://cdn.prgloo.com/media/35def14d5ff3471eb3e1fb764f073ac0.jpg?width=1120&height=1680',
    imageAlt:
      'M6 South viaduct East Deck in place over the motorway September 2025',
    chainageFrom: 115200,
    chainageTo: 192765,
  },
  {
    id: 'birmingham',
    name: 'Birmingham Spur',
    description: 'From the Delta Junction to Birmingham Curzon Street.',
    image:
      'https://cdn.prgloo.com/media/ba4cbc8311aa47e9938533d068408d00.jpeg?width=1120&height=1680',
    imageAlt: 'HS2 Lawley Middleway viaduct move completed',
    chainageFrom: 160426,
    chainageTo: 175680,
  },
];
