import type { Post } from '../types/post';

export const SEEDED_POSTS: Post[] = [
  {
    post_id: 'seed_post_1',
    user_id: 'seed_user_1',
    username: 'campus_explorer',
    name: 'Alex Mercer',
    avatar_url: 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=150',
    content: 'Just discovered this quiet study corner in the old campus library. The vibes here are immaculate for midterm prep! 📚✨ Who wants to join for a study session later?',
    media_url: 'https://images.pexels.com/photos/207691/pexels-photo-207691.jpeg?auto=compress&cs=tinysrgb&w=800',
    media_type: 'image',
    spark_count: 124,
    comment_count: 18,
    reshare_count: 5,
    is_sparked: false,
    is_saved: false,
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(), // 2 hours ago
    campus: 'Main Campus',
    post_type: 'public'
  },
  {
    post_id: 'seed_post_2',
    user_id: 'seed_user_2',
    username: 'sparkle_official',
    name: 'Sparkle Community',
    avatar_url: 'https://images.pexels.com/photos/771742/pexels-photo-771742.jpeg?auto=compress&cs=tinysrgb&w=150',
    content: '🔥 Sparkle Version 003 is officially live! We\'ve upgraded the feed engine, enhanced real-time chats, and added a premium pull-to-refresh. Explore the new experience and share your feedback below! 👇✨',
    media_url: 'https://images.pexels.com/photos/1007066/pexels-photo-1007066.jpeg?auto=compress&cs=tinysrgb&w=800',
    media_type: 'image',
    spark_count: 1420,
    comment_count: 89,
    reshare_count: 45,
    is_sparked: false,
    is_saved: false,
    created_at: new Date(Date.now() - 3600000 * 5).toISOString(), // 5 hours ago
    campus: 'Global',
    post_type: 'public'
  },
  {
    post_id: 'seed_post_3',
    user_id: 'seed_user_3',
    username: 'tech_guru',
    name: 'Sarah Chen',
    avatar_url: 'https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=150',
    content: 'Late night coding session in the tech lab. Building something cool with React and Capacitor! 💻🚀 Who else is burning the midnight oil?',
    media_url: 'https://images.pexels.com/photos/159844/pexels-photo-159844.jpeg?auto=compress&cs=tinysrgb&w=800',
    media_type: 'image',
    spark_count: 85,
    comment_count: 12,
    reshare_count: 2,
    is_sparked: false,
    is_saved: false,
    created_at: new Date(Date.now() - 3600000 * 10).toISOString(), // 10 hours ago
    campus: 'Science Complex',
    post_type: 'public'
  },
  {
    post_id: 'seed_post_4',
    user_id: 'seed_user_4',
    username: 'athletics_star',
    name: 'David Kiprop',
    avatar_url: 'https://images.pexels.com/photos/91227/pexels-photo-91227.jpeg?auto=compress&cs=tinysrgb&w=150',
    content: 'Morning training done! Preparing for the upcoming inter-university championship. Let\'s bring that trophy home! 🏃‍♂️🏆🔥',
    media_url: 'https://images.pexels.com/photos/1438072/pexels-photo-1438072.jpeg?auto=compress&cs=tinysrgb&w=800',
    media_type: 'image',
    spark_count: 310,
    comment_count: 42,
    reshare_count: 15,
    is_sparked: false,
    is_saved: false,
    created_at: new Date(Date.now() - 3600000 * 24).toISOString(), // 1 day ago
    campus: 'Sports Arena',
    post_type: 'public'
  }
];
