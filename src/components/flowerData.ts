/**
 * SVG path data for different flower types
 */

export type FlowerType = 'rose' | 'tulip' | 'daisy' | 'sunflower';

interface FlowerData {
  stem: string;
  petals: string[];
  center: string;
  defaultColor: string;
  centerColor: string;
}

export const flowerTypes: Record<FlowerType, FlowerData> = {
  rose: {
    stem: 'M50 100 C50 100, 50 80, 50 60',
    petals: [
      'M40 40 C30 25, 45 15, 50 25 C55 15, 70 25, 60 40 C70 55, 55 65, 50 55 C45 65, 30 55, 40 40',
      'M35 45 C25 35, 35 25, 45 30 C40 20, 55 20, 50 30 C60 25, 70 35, 65 45 C70 55, 60 60, 50 55 C40 60, 30 55, 35 45',
      'M40 35 C30 25, 40 15, 45 22 C50 15, 60 25, 50 35 C60 45, 50 55, 45 48 C40 55, 30 45, 40 35',
    ],
    center: 'M45 40 C45 35, 55 35, 55 40 C55 45, 45 45, 45 40',
    defaultColor: '#FF6B6B',
    centerColor: '#FFAD87',
  },
  tulip: {
    stem: 'M50 100 C50 100, 50 70, 50 60',
    petals: [
      'M40 40 C30 25, 45 20, 50 35 C55 20, 70 25, 60 40 C60 55, 50 60, 50 60 C50 60, 40 55, 40 40',
      'M43 42 C35 30, 48 25, 50 38 C52 25, 65 30, 57 42 C57 52, 50 55, 50 55 C50 55, 43 52, 43 42',
    ],
    center: 'M47 45 C47 42, 53 42, 53 45 C53 48, 47 48, 47 45',
    defaultColor: '#FF5E5B',
    centerColor: '#FFD166',
  },
  daisy: {
    stem: 'M50 100 C50 100, 50 80, 50 60',
    petals: [
      'M50 25 C53 15, 58 15, 60 25 L50 40 Z',
      'M60 25 C70 20, 75 25, 75 35 L50 40 Z',
      'M75 35 C80 45, 75 55, 65 55 L50 40 Z',
      'M65 55 C60 65, 55 70, 50 65 L50 40 Z',
      'M50 65 C45 70, 40 65, 35 55 L50 40 Z',
      'M35 55 C25 50, 20 45, 25 35 L50 40 Z',
      'M25 35 C30 25, 35 20, 40 25 L50 40 Z',
      'M40 25 C45 15, 48 15, 50 25 L50 40 Z',
    ],
    center: 'M40 40 C40 30, 60 30, 60 40 C60 50, 40 50, 40 40',
    defaultColor: '#FFFFFF',
    centerColor: '#FFD166',
  },
  sunflower: {
    stem: 'M50 100 C50 100, 50 80, 50 60',
    petals: [
      'M50 15 L45 30 L50 40 L55 30 Z',
      'M65 20 L55 30 L50 40 L60 35 Z',
      'M75 35 L60 35 L50 40 L60 45 Z',
      'M80 50 L60 45 L50 40 L55 50 Z',
      'M75 65 L55 50 L50 40 L45 50 Z',
      'M65 80 L45 50 L50 40 L40 45 Z',
      'M50 85 L40 45 L50 40 L40 35 Z',
      'M35 80 L40 35 L50 40 L45 30 Z',
      'M20 65 L45 30 L50 40 L40 35 Z',
      'M15 50 L40 35 L50 40 L40 45 Z',
      'M20 35 L40 45 L50 40 L45 50 Z',
      'M35 20 L45 50 L50 40 L55 50 Z',
    ],
    center: 'M35 40 C35 25, 65 25, 65 40 C65 55, 35 55, 35 40',
    defaultColor: '#FFD60A',
    centerColor: '#614C19',
  },
};
