import { 
  Smile, Sparkles, Heart, Frown, Zap, Ghost, Sun, Moon, Star, PartyPopper,
  Tv, Utensils, Coffee, Ticket, Plane, Headphones, Brain, BookOpen, Gamepad2, Megaphone,
  Search, Wind, Shield, Target, Compass, Anchor, Cloud, ShoppingBag, PenTool, Footprints,
  Dumbbell, Bike, Car
} from 'lucide-react';

export const getFeelingIcon = (name: string) => {
  const mapping: Record<string, any> = {
    'happy': Smile,
    'blessed': Sparkles,
    'loved': Heart,
    'sad': Frown,
    'thankful': Heart,
    'excited': Zap,
    'in love': Heart,
    'crazy': Ghost,
    'grateful': Sun,
    'blissful': Moon,
    'fantastic': Star,
    'silly': PartyPopper,
    'relaxed': Wind,
    'proud': Shield,
    'focused': Target,
    'curious': Compass,
    'calm': Anchor,
    'bored': Cloud,
  };
  
  const lower = name.toLowerCase();
  const match = Object.keys(mapping).find(key => lower.startsWith(key));
  return match ? mapping[match] : null;
};

export const getActivityIcon = (name: string) => {
  const mapping: Record<string, any> = {
    'celebrating': PartyPopper,
    'watching': Tv,
    'eating': Utensils,
    'drinking': Coffee,
    'attending': Ticket,
    'travelling to': Plane,
    'listening to': Headphones,
    'looking for': Search,
    'thinking about': Brain,
    'reading': BookOpen,
    'playing': Gamepad2,
    'supporting': Megaphone,
    'shopping': ShoppingBag,
    'studying': PenTool,
    'walking': Footprints,
    'working out': Dumbbell,
    'biking': Bike,
    'driving': Car,
  };
  
  const lower = name.toLowerCase();
  const match = Object.keys(mapping).find(key => lower.startsWith(key));
  return match ? mapping[match] : null;
};
