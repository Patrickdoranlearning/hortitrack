
export interface Variety {
  name: string;
  family: string;
  category: string;
  commonName?: string;
  rating?: string;
  salesPeriod?: string;
  floweringPeriod?: string;
  flowerColour?: string;
  evergreen?: string;
}

export const VARIETIES: Variety[] = [
  { name: 'Hidcote', family: 'Lavender', category: 'Perennial', commonName: 'English Lavender', rating: '5', salesPeriod: 'Spring-Summer', floweringPeriod: 'Summer', flowerColour: 'Purple', evergreen: 'Yes' },
  { name: 'Peace', family: 'Rose', category: 'Shrub', commonName: 'Peace Rose', rating: '5', salesPeriod: 'Spring-Summer', floweringPeriod: 'Summer', flowerColour: 'Yellow Blend', evergreen: 'No' },
  { name: 'Annabelle', family: 'Hydrangea', category: 'Shrub', commonName: 'Smooth Hydrangea', rating: '4', salesPeriod: 'Summer', floweringPeriod: 'Summer', flowerColour: 'White', evergreen: 'No' },
  { name: 'Winter Gem', family: 'Boxwood', category: 'Shrub', commonName: 'Boxwood', rating: '4', salesPeriod: 'Year-round', floweringPeriod: 'Spring', flowerColour: 'Insignificant', evergreen: 'Yes' },
  { name: 'Kramer\'s Red', family: 'Erica x darleyensis', category: 'Heather', commonName: 'Winter Heath', rating: '5', salesPeriod: 'Winter-Spring', floweringPeriod: 'Winter-Spring', flowerColour: 'Magenta', evergreen: 'Yes' },
];
