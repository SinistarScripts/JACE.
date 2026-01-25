export interface Product {
  id: string;
  title: string;
  price: number;
  currency: string;
  imageUrl?: string;
}

export interface UserProfile {
  id: string;
  username: string;
  avatarUrl: string;
}

export interface VideoPost {
  id: string;
  videoUrl: string;
  description: string;
  likes: number;
  comments: number;
  shares: number;
  user: UserProfile;
  product?: Product;
}