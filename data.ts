import { VideoPost } from './types';

export const FEED_DATA: VideoPost[] = [
  {
    id: '1',
    videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    description: 'The ultimate portable speaker for your summer adventures! 🎵☀️ #SummerVibes #Tech',
    likes: 12400,
    comments: 450,
    shares: 120,
    user: {
      id: 'u1',
      username: 'tech_guru',
      avatarUrl: 'https://picsum.photos/100/100?random=1',
    },
    product: {
      id: 'p1',
      title: 'SoundWave Pro Portable Speaker',
      price: 89.99,
      currency: '$',
    },
  },
  {
    id: '2',
    videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    description: 'Check out this amazing 3D printed mechanical setup! 🤖⚙️ #Engineering #3DPrinting',
    likes: 8900,
    comments: 210,
    shares: 85,
    user: {
      id: 'u2',
      username: 'maker_space',
      avatarUrl: 'https://picsum.photos/100/100?random=2',
    },
    product: {
      id: 'p2',
      title: 'Creality Ender 3 V2 3D Printer',
      price: 249.00,
      currency: '$',
    },
  },
  {
    id: '3',
    videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    description: 'Morning routines made better with this coffee machine ☕✨ #CoffeeLover #MorningRoutine',
    likes: 45000,
    comments: 1200,
    shares: 3400,
    user: {
      id: 'u3',
      username: 'lifestyle_daily',
      avatarUrl: 'https://picsum.photos/100/100?random=3',
    },
    product: {
      id: 'p3',
      title: 'BaristaExpress Espresso Machine',
      price: 599.99,
      currency: '$',
    },
  },
  {
    id: '4',
    videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    description: 'Nature is wild! Look at this bunny go 🐰🌲 #Nature #Wildlife',
    likes: 3200,
    comments: 89,
    shares: 45,
    user: {
      id: 'u4',
      username: 'nature_focus',
      avatarUrl: 'https://picsum.photos/100/100?random=4',
    },
    // No product for this one to test conditional rendering
  },
  {
    id: '5',
    videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
    description: 'Road trip essentials you strictly need! 🚗💨 #Travel #RoadTrip',
    likes: 15600,
    comments: 670,
    shares: 890,
    user: {
      id: 'u5',
      username: 'travel_junkie',
      avatarUrl: 'https://picsum.photos/100/100?random=5',
    },
    product: {
      id: 'p5',
      title: 'Universal Car Mount & Organizer',
      price: 24.99,
      currency: '$',
    },
  },
];