import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ThemeColors {
  primary: string;
  primary600: string;
  primary400: string;
  backgroundLight: string;
  backgroundDark: string;
  chatBubbleSent: string;
  chatBubbleReceived: string;
  chatBubbleSentText: string;
  chatBubbleReceivedText: string;
}

export type AnimationType = 'none' | 'rain' | 'snow' | 'stars' | 'particles' | 'fireflies' | 'clouds' | 'lofi_cat';

export interface SparkleTheme {
  id: string;
  name: string;
  category: string;
  colors: ThemeColors;
  isDarkDefault: boolean;
  wallpaperUrl?: string; // Optional custom wallpaper
  blurIntensity?: number; // 0 to 100
  darknessOverlay?: number; // 0 to 100
  animationType?: AnimationType;
}

export interface WordEffect {
  word: string;
  emoji: string;
  id: string;
}

// Helper to generate a theme quickly
const createTheme = (
  id: string, name: string, category: string, primary: string, primary600: string, primary400: string, bgDark: string, bgLight: string,
  isDark: boolean, bubbleSent: string, bubbleRecv: string, sentText: string = '#FFFFFF', recvText: string = '#FFFFFF', 
  wallpaperUrl?: string, animationType: AnimationType = 'none'
): SparkleTheme => ({
  id, name, category, isDarkDefault: isDark, wallpaperUrl, animationType, blurIntensity: 20, darknessOverlay: 50,
  colors: { primary, primary600, primary400, backgroundDark: bgDark, backgroundLight: bgLight, chatBubbleSent: bubbleSent, chatBubbleReceived: bubbleRecv, chatBubbleSentText: sentText, chatBubbleReceivedText: recvText }
});

export const PRESET_THEMES: SparkleTheme[] = [
  createTheme('whatsapp_v5', 'WhatsApp Black Ultra', 'Premium', '#7B61FF', '#8B5CFF', '#9C27B0', '#000000', '#000000', true, '#7B61FF', '#21173A', '#ffffff', '#ffffff', '/assets/chat_wallpaper.png'),
  createTheme('amoled_black', 'AMOLED Black', 'Dark', '#00E5FF', '#00B8CC', '#33EAFF', '#000000', '#000000', true, '#00E5FF', '#111111', '#000000', '#ffffff'),
  createTheme('cyberpunk_neon', 'Cyberpunk Neon', 'Neon', '#00FF9D', '#00CC7D', '#33FFB0', '#090A0F', '#090A0F', true, '#FF0055', '#1a1b26', '#ffffff', '#00FF9D'),
  createTheme('purple_galaxy', 'Purple Galaxy', 'Space', '#B14AED', '#8E3BC0', '#C775F5', '#1A0B2E', '#1A0B2E', true, '#B14AED', '#2D1B4E', '#ffffff', '#e9d5ff', 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?q=80&w=800&auto=format&fit=crop', 'stars'),
  createTheme('luxury_gold', 'Luxury Gold', 'Premium', '#D4AF37', '#AA8C2C', '#E2C45E', '#111111', '#111111', true, '#D4AF37', '#222222', '#000000', '#D4AF37'),
  createTheme('glassmorphism', 'Glassmorphism', 'Glass', '#ffffff', '#f3f4f6', '#ffffff', '#000000', '#f8fafc', false, 'rgba(255,255,255,0.2)', 'rgba(255,255,255,0.1)', '#000000', '#000000'),
  createTheme('ocean_blue', 'Ocean Blue', 'Nature', '#0077B6', '#005F92', '#0096C7', '#03045E', '#E0FBFC', false, '#0077B6', '#CAF0F8', '#ffffff', '#03045E', 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?q=80&w=800&auto=format&fit=crop'),
  createTheme('sunset_orange', 'Sunset Orange', 'Gradient', '#FF7E67', '#E66A55', '#FFA08A', '#2C1B18', '#FFE9E3', false, '#FF7E67', '#FFD1C1', '#ffffff', '#2C1B18', 'https://images.unsplash.com/photo-1495616811223-4d98c6e9c869?q=80&w=800&auto=format&fit=crop'),
  createTheme('anime_sakura', 'Anime Sakura', 'Anime', '#FFB7B2', '#E5A4A0', '#FFC8C4', '#2D2A2A', '#FDFBF7', false, '#FFB7B2', '#FFE5E5', '#ffffff', '#2D2A2A', 'https://images.unsplash.com/photo-1522383225653-ed111181a951?q=80&w=800&auto=format&fit=crop', 'particles'),
  createTheme('matrix_hacker', 'Matrix Hacker', 'Neon', '#00FF00', '#00CC00', '#33FF33', '#000000', '#000000', true, '#00FF00', '#0a2e0a', '#000000', '#00FF00', undefined, 'rain'),
  createTheme('midnight_rain', 'Midnight Rain', 'Live', '#4C516D', '#3B4058', '#666C8A', '#1C1F2E', '#1C1F2E', true, '#4C516D', '#2A2E43', '#ffffff', '#C5C9D8', 'https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?q=80&w=800&auto=format&fit=crop', 'rain'),
  createTheme('winter_snow', 'Winter Snow', 'Live', '#87CEFA', '#4682B4', '#B0E0E6', '#1A2A3A', '#F0F8FF', false, '#87CEFA', '#D1E8E2', '#112233', '#112233', 'https://images.unsplash.com/photo-1478265409131-1f65c88f965c?q=80&w=800&auto=format&fit=crop', 'snow'),
  createTheme('fireflies', 'Enchanted Forest', 'Live', '#32CD32', '#228B22', '#7CFC00', '#0B240B', '#E8F5E9', true, '#32CD32', '#A5D6A7', '#ffffff', '#0B240B', 'https://images.unsplash.com/photo-1448375240586-882707db888b?q=80&w=800&auto=format&fit=crop', 'fireflies'),
  createTheme('dreamy_clouds', 'Dreamy Clouds', 'Sky', '#87CEEB', '#00BFFF', '#ADD8E6', '#1A2A3A', '#F0F8FF', false, '#87CEEB', '#D1E8E2', '#112233', '#112233', 'https://images.unsplash.com/photo-1513002749550-c59d786b8e6c?q=80&w=800&auto=format&fit=crop', 'clouds'),
  createTheme('lofi_rooftop', 'Lofi Rooftop', 'Live', '#3D2AE5', '#2414A5', '#604DFA', '#1C003D', '#1C003D', true, '#3D2AE5', '#2A185A', '#ffffff', '#9FA8DA', 'https://img.freepik.com/premium-photo/lofi-anime-city-background_950002-311224.jpg?w=800', 'lofi_cat'),

  // 10 Nature Themes
  createTheme('deep_forest', 'Deep Forest', 'Nature', '#2E8B57', '#228B22', '#3CB371', '#0D1A0D', '#E8F5E9', true, '#2E8B57', '#1B331B', '#ffffff', '#C8E6C9', 'https://images.unsplash.com/photo-1448375240586-882707db888b?q=80&w=800&auto=format&fit=crop'),
  createTheme('autumn_woods', 'Autumn Woods', 'Nature', '#D2691E', '#A0522D', '#CD853F', '#2A1608', '#FFF3E0', false, '#D2691E', '#FFCC80', '#ffffff', '#3E2723', 'https://images.unsplash.com/photo-1476610182048-b716b8518aae?q=80&w=800&auto=format&fit=crop'),
  createTheme('mountain_peaks', 'Mountain Peaks', 'Nature', '#708090', '#2F4F4F', '#778899', '#1A2421', '#ECEFF1', false, '#708090', '#CFD8DC', '#ffffff', '#263238', 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=800&auto=format&fit=crop'),
  createTheme('desert_dunes', 'Desert Dunes', 'Nature', '#F4A460', '#D2B48C', '#DEB887', '#3E2723', '#FFF8E1', false, '#F4A460', '#FFE082', '#000000', '#4E342E', 'https://images.unsplash.com/photo-1473580044384-7ba9967e16a0?q=80&w=800&auto=format&fit=crop'),
  createTheme('tropical_rainforest', 'Tropical Rainforest', 'Nature', '#006400', '#004d00', '#228B22', '#001a00', '#E0F2F1', true, '#006400', '#003300', '#ffffff', '#80CBC4', 'https://images.unsplash.com/photo-1518182170546-076616fdcb18?q=80&w=800&auto=format&fit=crop'),
  createTheme('misty_valley', 'Misty Valley', 'Nature', '#5F9EA0', '#4682B4', '#B0C4DE', '#102027', '#E3F2FD', false, '#5F9EA0', '#BBDEFB', '#ffffff', '#1C313A', 'https://images.unsplash.com/photo-1433838552652-f9a46b332c40?q=80&w=800&auto=format&fit=crop'),
  createTheme('spring_meadow', 'Spring Meadow', 'Nature', '#9ACD32', '#6B8E23', '#ADFF2F', '#1B5E20', '#F1F8E9', false, '#9ACD32', '#DCEDC8', '#000000', '#33691E', 'https://images.unsplash.com/photo-1490750967868-88cb44cb2754?q=80&w=800&auto=format&fit=crop'),
  createTheme('canyon_rivers', 'Canyon Rivers', 'Nature', '#CD5C5C', '#8B0000', '#F08080', '#3E2723', '#FBE9E7', false, '#CD5C5C', '#FFCCBC', '#ffffff', '#4E342E', 'https://images.unsplash.com/photo-1469521669194-babbdf9aa9f2?q=80&w=800&auto=format&fit=crop'),
  createTheme('pine_grove', 'Pine Grove', 'Nature', '#2F4F4F', '#002E2C', '#4A7C59', '#081C15', '#D8F3DC', true, '#2F4F4F', '#1B4332', '#ffffff', '#95D5B2', 'https://images.unsplash.com/photo-1542273917363-3b1817f50a26?q=80&w=800&auto=format&fit=crop'),
  createTheme('bamboo_garden', 'Bamboo Garden', 'Nature', '#6B8E23', '#556B2F', '#9ACD32', '#1B5E20', '#F1F8E9', false, '#6B8E23', '#C5E1A5', '#ffffff', '#33691E', 'https://images.unsplash.com/photo-1533423996375-f914ab1efbb2?q=80&w=800&auto=format&fit=crop'),

  // 10 Galaxy and Sky
  createTheme('orion_nebula', 'Orion Nebula', 'Galaxy', '#8A2BE2', '#4B0082', '#9370DB', '#0F0518', '#F3E5F5', true, '#8A2BE2', '#38006B', '#ffffff', '#CE93D8', 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?q=80&w=800&auto=format&fit=crop'),
  createTheme('milky_way', 'Milky Way', 'Galaxy', '#483D8B', '#191970', '#6A5ACD', '#050514', '#E8EAF6', true, '#483D8B', '#1A237E', '#ffffff', '#9FA8DA', 'https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?q=80&w=800&auto=format&fit=crop'),
  createTheme('starry_night', 'Starry Night', 'Galaxy', '#000080', '#00008B', '#4169E1', '#000000', '#E3F2FD', true, '#000080', '#011936', '#ffffff', '#64B5F6', 'https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?q=80&w=800&auto=format&fit=crop'),
  createTheme('deep_space', 'Deep Space', 'Galaxy', '#800080', '#4B0082', '#8B008B', '#000000', '#FCE4EC', true, '#800080', '#12001A', '#ffffff', '#F48FB1', 'https://images.unsplash.com/photo-1537420327992-d6e192287183?q=80&w=800&auto=format&fit=crop'),
  createTheme('northern_lights', 'Northern Lights', 'Galaxy', '#00FA9A', '#00FF7F', '#7FFFD4', '#001A10', '#E0F2F1', true, '#00FA9A', '#003322', '#000000', '#80CBC4', 'https://images.unsplash.com/photo-1531366936337-77b5d1901a88?q=80&w=800&auto=format&fit=crop'),
  createTheme('pink_sunset', 'Pink Sunset', 'Sky', '#FF69B4', '#FF1493', '#DB7093', '#260B15', '#FCE4EC', false, '#FF69B4', '#F8BBD0', '#ffffff', '#880E4F', 'https://images.unsplash.com/photo-1472141521881-95d0e87e2e39?q=80&w=800&auto=format&fit=crop'),
  createTheme('golden_hour', 'Golden Hour', 'Sky', '#FFD700', '#FFA500', '#FF8C00', '#332200', '#FFF8E1', false, '#FFD700', '#FFE082', '#000000', '#FF6F00', 'https://images.unsplash.com/photo-1495616811223-4d98c6e9c869?q=80&w=800&auto=format&fit=crop'),
  createTheme('midnight_sky', 'Midnight Sky', 'Sky', '#191970', '#000080', '#483D8B', '#00001a', '#E8EAF6', true, '#191970', '#0A0A3A', '#ffffff', '#9FA8DA', 'https://images.unsplash.com/photo-1507400492013-162706c8c05e?q=80&w=800&auto=format&fit=crop'),
  createTheme('twilight_zone', 'Twilight Zone', 'Sky', '#4B0082', '#483D8B', '#8A2BE2', '#0D001A', '#F3E5F5', true, '#4B0082', '#220044', '#ffffff', '#CE93D8', 'https://images.unsplash.com/photo-1488866022504-f2584929ca5f?q=80&w=800&auto=format&fit=crop'),
  createTheme('cosmic_dust', 'Cosmic Dust', 'Galaxy', '#FF4500', '#DC143C', '#FF6347', '#1A0400', '#FBE9E7', true, '#FF4500', '#330D00', '#ffffff', '#FFAB91', 'https://images.unsplash.com/photo-1464802686167-b939a6910659?q=80&w=800&auto=format&fit=crop'),

  // 5 Beaches and Coast
  createTheme('white_sand_beach', 'White Sand Beach', 'Coast', '#00CED1', '#20B2AA', '#48D1CC', '#001A1A', '#E0F7FA', false, '#00CED1', '#B2EBF2', '#000000', '#006064', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=800&auto=format&fit=crop'),
  createTheme('rocky_coast', 'Rocky Coast', 'Coast', '#4682B4', '#5F9EA0', '#708090', '#101B24', '#ECEFF1', false, '#4682B4', '#CFD8DC', '#ffffff', '#263238', 'https://images.unsplash.com/photo-1414445092210-ee1a2da43a14?q=80&w=800&auto=format&fit=crop'),
  createTheme('tropical_island', 'Tropical Island', 'Coast', '#2E8B57', '#3CB371', '#20B2AA', '#0A2013', '#E8F5E9', false, '#2E8B57', '#C8E6C9', '#ffffff', '#1B5E20', 'https://images.unsplash.com/photo-1519046904884-53103b34b206?q=80&w=800&auto=format&fit=crop'),
  createTheme('ocean_waves', 'Ocean Waves', 'Coast', '#0000CD', '#00008B', '#4169E1', '#00002A', '#E3F2FD', true, '#0000CD', '#000055', '#ffffff', '#64B5F6', 'https://images.unsplash.com/photo-1488344605151-507deaf5f3cb?q=80&w=800&auto=format&fit=crop'),
  createTheme('sunset_pier', 'Sunset Pier', 'Coast', '#FF8C00', '#FF4500', '#FFA500', '#2B1200', '#FFF3E0', false, '#FF8C00', '#FFE0B2', '#000000', '#E65100', 'https://images.unsplash.com/photo-1505228395891-9a51e7e86bf6?q=80&w=800&auto=format&fit=crop'),

  // 4 Live Ones
  createTheme('blizzard', 'Blizzard', 'Live', '#B0E0E6', '#ADD8E6', '#87CEEB', '#1A2A3A', '#F0F8FF', false, '#B0E0E6', '#D1E8E2', '#112233', '#112233', 'https://images.unsplash.com/photo-1483664852095-d6cc6870702d?q=80&w=800&auto=format&fit=crop', 'snow'),
  createTheme('monsoon', 'Monsoon', 'Live', '#2F4F4F', '#1C2E2E', '#4A7C7C', '#0C1313', '#E0ECEC', true, '#2F4F4F', '#192828', '#ffffff', '#80A8A8', 'https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?q=80&w=800&auto=format&fit=crop', 'rain'),
  createTheme('starlight', 'Starlight', 'Live', '#FFF8DC', '#FFE4B5', '#FFDAB9', '#1A1811', '#FFFAF0', true, '#FFD700', '#332D15', '#000000', '#FFE082', 'https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?q=80&w=800&auto=format&fit=crop', 'stars'),
  createTheme('meteor_shower', 'Meteor Shower', 'Live', '#FF6347', '#DC143C', '#FF4500', '#1A0604', '#FBE9E7', true, '#FF6347', '#33110A', '#ffffff', '#FFAB91', 'https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=800&auto=format&fit=crop', 'particles'),

  // 10 Anime & Minimal Themes
  createTheme('naruto_clouds', 'Akatsuki Red', 'Anime', '#FF0000', '#CC0000', '#FF3333', '#000000', '#111111', true, '#FF0000', '#222222', '#ffffff', '#FF0000', 'https://wallpaperaccess.com/full/1125215.jpg'),
  createTheme('one_piece', 'Grand Line', 'Anime', '#FFD700', '#FFA500', '#FF4500', '#004488', '#88CCFF', false, '#004488', '#E0F2F1', '#ffffff', '#004488', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=800&auto=format&fit=crop'),
  createTheme('dragon_ball', 'Z-Fighters', 'Anime', '#FF8C00', '#FF4500', '#FFA500', '#1A1A2E', '#F0F0F0', true, '#FF8C00', '#2E2E4E', '#ffffff', '#FF8C00', 'https://images.unsplash.com/photo-1578632738981-4320f6618d3e?q=80&w=800&auto=format&fit=crop'),
  createTheme('minimal_zen', 'Zen White', 'Minimal', '#808080', '#606060', '#A0A0A0', '#FFFFFF', '#FFFFFF', false, '#E0E0E0', '#F5F5F5', '#000000', '#000000'),
  createTheme('minimal_ink', 'Ink Black', 'Minimal', '#000000', '#202020', '#404040', '#000000', '#000000', true, '#202020', '#111111', '#FFFFFF', '#FFFFFF'),
  createTheme('aesthetic_beige', 'Warm Aesthetic', 'Minimal', '#D2B48C', '#BC8F8F', '#DEB887', '#F5F5DC', '#FDF5E6', false, '#D2B48C', '#EEDC82', '#4E342E', '#4E342E'),
  createTheme('pastel_dream', 'Pastel Pink', 'Minimal', '#FFB6C1', '#FF69B4', '#FFC0CB', '#FFF0F5', '#FFF0F5', false, '#FFB6C1', '#FFE4E1', '#880E4F', '#880E4F'),
  createTheme('glass_deep', 'Glass Deep Blue', 'Glassmorphism', '#1E88E5', '#1565C0', '#42A5F5', '#0D47A1', '#0D47A1', true, 'rgba(255,255,255,0.15)', 'rgba(255,255,255,0.05)', '#FFFFFF', '#FFFFFF'),
  createTheme('glass_emerald', 'Glass Emerald', 'Glassmorphism', '#00C853', '#009624', '#69F0AE', '#004D40', '#004D40', true, 'rgba(255,255,255,0.15)', 'rgba(255,255,255,0.05)', '#FFFFFF', '#FFFFFF'),
  createTheme('glass_ruby', 'Glass Ruby', 'Glassmorphism', '#D81B60', '#AD1457', '#F06292', '#880E4F', '#880E4F', true, 'rgba(255,255,255,0.15)', 'rgba(255,255,255,0.05)', '#FFFFFF', '#FFFFFF'),

  // 10 AI & Solid Themes
  createTheme('ai_cyber', 'AI Cyber-Future', 'AI Generated', '#00FFFF', '#00B8CC', '#33EAFF', '#090A0F', '#090A0F', true, '#00FFFF', '#1A1B26', '#000000', '#00FFFF'),
  createTheme('ai_organic', 'AI Organic Flow', 'AI Generated', '#8BC34A', '#689F38', '#AED581', '#1B2E1C', '#E8F5E9', true, '#8BC34A', '#2D4C2F', '#FFFFFF', '#8BC34A'),
  createTheme('ai_ethereal', 'AI Ethereal Mist', 'AI Generated', '#E1BEE7', '#BA68C8', '#F3E5F5', '#2A1A2D', '#F3E5F5', true, '#E1BEE7', '#3D2A41', '#FFFFFF', '#E1BEE7'),
  createTheme('solid_red', 'Classic Crimson', 'Solid', '#B71C1C', '#D32F2F', '#E57373', '#000000', '#FFFFFF', true, '#B71C1C', '#212121', '#FFFFFF', '#FFFFFF'),
  createTheme('solid_blue', 'Royal Blue', 'Solid', '#0D47A1', '#1976D2', '#64B5F6', '#000000', '#FFFFFF', true, '#0D47A1', '#212121', '#FFFFFF', '#FFFFFF'),
  createTheme('solid_green', 'Forest Green', 'Solid', '#1B5E20', '#388E3C', '#81C784', '#000000', '#FFFFFF', true, '#1B5E20', '#212121', '#FFFFFF', '#FFFFFF'),
  createTheme('solid_purple', 'Deep Purple', 'Solid', '#4A148C', '#7B1FA2', '#BA68C8', '#000000', '#FFFFFF', true, '#4A148C', '#212121', '#FFFFFF', '#FFFFFF'),
  createTheme('solid_teal', 'Dark Teal', 'Solid', '#004D40', '#00796B', '#4DB6AC', '#000000', '#FFFFFF', true, '#004D40', '#212121', '#FFFFFF', '#FFFFFF'),
  createTheme('solid_orange', 'Vivid Orange', 'Solid', '#E65100', '#F57C00', '#FFB74D', '#000000', '#FFFFFF', true, '#E65100', '#212121', '#FFFFFF', '#FFFFFF'),
  createTheme('solid_pink', 'Hot Pink', 'Solid', '#880E4F', '#C2185B', '#F06292', '#000000', '#FFFFFF', true, '#880E4F', '#212121', '#FFFFFF', '#FFFFFF'),
];

interface ThemeState {
  chatThemes: Record<string, SparkleTheme>; // Maps chatId -> full theme object
  customThemes: SparkleTheme[];
  quickReactions: Record<string, string>; // Maps chatId -> emoji
  chatWordEffects: Record<string, WordEffect[]>; // Maps chatId -> array of effects
  
  getThemeForChat: (chatId: string) => SparkleTheme;
  setThemeForChat: (chatId: string, theme: SparkleTheme) => void;
  removeThemeForChat: (chatId: string) => void;

  getQuickReaction: (chatId: string) => string;
  setQuickReaction: (chatId: string, emoji: string) => void;

  getWordEffects: (chatId: string) => WordEffect[];
  addWordEffect: (chatId: string, word: string, emoji: string) => void;
  removeWordEffect: (chatId: string, effectId: string) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      chatThemes: {},
      customThemes: [],
      quickReactions: {},
      chatWordEffects: {},
      
      getThemeForChat: (chatId: string) => {
        if (!chatId) return PRESET_THEMES[0];
        const { chatThemes } = get();
        return chatThemes[chatId] || PRESET_THEMES[0];
      },
      
      setThemeForChat: (chatId: string, theme: SparkleTheme) => {
        if (!chatId) return;
        set(state => ({
          chatThemes: {
            ...state.chatThemes,
            [chatId]: theme
          }
        }));
      },

      removeThemeForChat: (chatId: string) => {
        set(state => {
          const newThemes = { ...state.chatThemes };
          delete newThemes[chatId];
          return { chatThemes: newThemes };
        });
      },

      getQuickReaction: (chatId: string) => {
        return get().quickReactions[chatId] || '👍';
      },

      setQuickReaction: (chatId: string, emoji: string) => {
        set(state => ({
          quickReactions: {
            ...state.quickReactions,
            [chatId]: emoji
          }
        }));
      },

      getWordEffects: (chatId: string) => {
        return get().chatWordEffects[chatId] || [];
      },

      addWordEffect: (chatId: string, word: string, emoji: string) => {
        set(state => {
          const current = state.chatWordEffects[chatId] || [];
          if (current.length >= 5) return state; // Max 5
          return {
            chatWordEffects: {
              ...state.chatWordEffects,
              [chatId]: [...current, { id: Math.random().toString(36).substr(2, 9), word: word.toLowerCase(), emoji }]
            }
          };
        });
      },

      removeWordEffect: (chatId: string, effectId: string) => {
        set(state => {
          const current = state.chatWordEffects[chatId] || [];
          return {
            chatWordEffects: {
              ...state.chatWordEffects,
              [chatId]: current.filter(e => e.id !== effectId)
            }
          };
        });
      }
    }),
    {
      name: 'sparkle-chat-themes-v2',
    }
  )
);
