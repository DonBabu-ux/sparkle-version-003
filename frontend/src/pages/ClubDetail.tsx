import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, MapPin, Settings, UserPlus, UserCheck, MessageSquare } from 'lucide-react';
import Navbar from '../components/Navbar';
import PostCard from '../components/PostCard';
import api from '../api/api';
import { useUserStore } from '../store/userStore';

interface ClubMember {
  user_id: string;
  username: string;
  avatar_url?: string;
  role?: string;
}

interface Club {
  club_id: string;
  name: string;
  description: string;
  category: string;
  campus: string;
  member_count: number;
  logo_url?: string;
  banner_url?: string;
  is_member?: boolean;
  is_admin?: boolean;
  creator_id?: string;
}

export default function ClubDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useUserStore();
  const [club, setClub] = useState<Club | null>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'posts' | 'members'>('posts');
  const [joining, setJoining] = useState(false);

  useEffect(() => { if (id) fetchClub(); }, [id]);

  const fetchClub = async () => {
    setLoading(true);
    try {
      const [clubRes, postsRes, membersRes] = await Promise.all([
        api.get(`/clubs/${id}`),
        api.get(`/clubs/${id}/posts`),
        api.get(`/clubs/${id}/members`),
      ]);
      setClub(clubRes.data.club || clubRes.data);
      setPosts(postsRes.data.posts || postsRes.data || []);
      setMembers(membersRes.data.members || membersRes.data || []);
    } catch (err) {
      console.error('Club detail error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!club) return;
    setJoining(true);
    try {
      if (club.is_member) {
        await api.delete(`/clubs/${id}/leave`);
        setClub(prev => prev ? { ...prev, is_member: false, member_count: prev.member_count - 1 } : prev);
      } else {
        await api.post(`/clubs/${id}/join`);
        setClub(prev => prev ? { ...prev, is_member: true, member_count: prev.member_count + 1 } : prev);
      }
    } catch (err) {
      console.error('Join/leave error:', err);
    } finally {
      setJoining(false);
    }
  };

  if (loading) return (
    <div className="page-wrapper">
      <Navbar />
      <div className="cd-loading">
        <div className="cd-spinner" />
        <p>Loading community...</p>
      </div>
    </div>
  );

  if (!club) return (
    <div className="page-wrapper">
      <Navbar />
      <div className="cd-not-found">
        <h2>Club not found</h2>
        <button onClick={() => navigate('/clubs')}>Browse Clubs</button>
      </div>
    </div>
  );

  const isAdmin = club.is_admin || club.creator_id === (user?.id || user?.user_id);

  return (
    <div className="page-wrapper">
      <Navbar />
      <div className="cd-content">
        <main className="cd-container">
          {/* Back */}
          <button className="cd-back-btn" onClick={() => navigate('/clubs')}>
            <ArrowLeft size={16} /> All Communities
          </button>

          {/* Banner */}
          <div className="cd-banner-wrap">
            <div className="cd-banner" style={{
              backgroundImage: `url('${club.banner_url || 'https://images.unsplash.com/photo-1541339907198-e08756ebafe3?w=1200'}')`,
            }} />
            <img
              src={club.logo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(club.name)}&background=random&color=fff`}
              className="cd-logo"
              alt={club.name}
              onError={(e) => { (e.target as HTMLImageElement).src = '/uploads/avatars/default.png'; }}
            />
          </div>

          {/* Club Info */}
          <div className="cd-info-card">
            <div className="cd-info-top">
              <div>
                <span className="cd-category">{club.category}</span>
                <h1 className="cd-name">{club.name}</h1>
                <div className="cd-meta-row">
                  <span><Users size={14} /> {club.member_count} Members</span>
                  <span><MapPin size={14} /> {club.campus}</span>
                </div>
              </div>
              <div className="cd-actions">
                {isAdmin && (
                  <button className="cd-settings-btn" onClick={() => navigate(`/clubs/${id}/settings`)}>
                    <Settings size={16} />
                  </button>
                )}
                <button
                  className={`cd-join-btn ${club.is_member ? 'leaving' : ''}`}
                  onClick={handleJoin}
                  disabled={joining}
                >
                  {club.is_member ? (
                    <><UserCheck size={16} /> Joined</>
                  ) : (
                    <><UserPlus size={16} /> Join</>
                  )}
                </button>
              </div>
            </div>
            <p className="cd-description">{club.description}</p>
          </div>

          {/* Tabs */}
          <div className="cd-tabs">
            <button className={`cd-tab ${activeTab === 'posts' ? 'active' : ''}`} onClick={() => setActiveTab('posts')}>
              <MessageSquare size={15} /> Posts ({posts.length})
            </button>
            <button className={`cd-tab ${activeTab === 'members' ? 'active' : ''}`} onClick={() => setActiveTab('members')}>
              <Users size={15} /> Members ({members.length})
            </button>
          </div>

          {/* Content */}
          {activeTab === 'posts' ? (
            <div className="cd-posts">
              {posts.length === 0 ? (
                <div className="cd-empty">
                  <MessageSquare size={40} />
                  <h3>No posts yet</h3>
                  <p>Be the first to post in this community!</p>
                </div>
              ) : (
                posts.map(post => <PostCard key={post.post_id} post={post} />)
              )}
            </div>
          ) : (
            <div className="cd-members-grid">
              {members.map(m => (
                <div key={m.user_id} className="cd-member-card" onClick={() => navigate(`/profile/${m.username}`)}>
                  <img
                    src={m.avatar_url || '/uploads/avatars/default.png'}
                    className="cd-member-avatar"
                    alt={m.username}
                    onError={(e) => { (e.target as HTMLImageElement).src = '/uploads/avatars/default.png'; }}
                  />
                  <div className="cd-member-info">
                    <div className="cd-member-name">@{m.username}</div>
                    {m.role && <div className="cd-member-role">{m.role}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      <style>{`
        .page-wrapper { display: flex; background: var(--bg-main, #f8fafc); min-height: 100vh; }
        .cd-content { flex: 1; overflow-y: auto; }
        .cd-container { max-width: 820px; margin: 0 auto; padding: 24px 20px 100px; }

        .cd-back-btn { display: inline-flex; align-items: center; gap: 8px; background: white; border: 1px solid #e2e8f0; padding: 10px 18px; border-radius: 12px; font-weight: 700; font-size: 14px; color: #334155; cursor: pointer; margin-bottom: 20px; transition: 0.2s; }
        .cd-back-btn:hover { border-color: #FF3D6D; color: #FF3D6D; }

        .cd-banner-wrap { position: relative; margin-bottom: 60px; }
        .cd-banner { height: 220px; border-radius: 24px; background-size: cover; background-position: center; box-shadow: 0 8px 30px rgba(0,0,0,0.12); }
        .cd-logo { width: 90px; height: 90px; border-radius: 26px; border: 5px solid white; position: absolute; bottom: -45px; left: 30px; object-fit: cover; background: white; box-shadow: 0 8px 24px rgba(0,0,0,0.12); }

        .cd-info-card { background: white; border-radius: 24px; padding: 28px; margin-bottom: 20px; border: 1px solid rgba(0,0,0,0.06); box-shadow: 0 4px 20px rgba(0,0,0,0.04); }
        .cd-info-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 16px; flex-wrap: wrap; }
        .cd-category { font-size: 11px; font-weight: 900; text-transform: uppercase; color: #FF3D6D; letter-spacing: 1.5px; display: block; margin-bottom: 6px; }
        .cd-name { font-size: 1.8rem; font-weight: 900; color: #0f172a; margin: 0 0 10px; letter-spacing: -0.8px; }
        .cd-meta-row { display: flex; gap: 16px; font-size: 14px; color: #64748b; font-weight: 700; }
        .cd-meta-row span { display: flex; align-items: center; gap: 6px; }
        .cd-actions { display: flex; gap: 10px; align-items: center; flex-shrink: 0; }
        .cd-settings-btn { background: #f1f5f9; border: none; width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #64748b; transition: 0.2s; }
        .cd-settings-btn:hover { background: #e2e8f0; }
        .cd-join-btn { display: inline-flex; align-items: center; gap: 8px; background: linear-gradient(135deg, #FF6B8B, #FF3D6D); color: white; border: none; padding: 12px 22px; border-radius: 14px; font-weight: 800; cursor: pointer; transition: 0.2s; box-shadow: 0 4px 14px rgba(255,61,109,0.25); }
        .cd-join-btn.leaving { background: #f1f5f9; color: #334155; box-shadow: none; }
        .cd-join-btn:disabled { opacity: 0.6; cursor: wait; }
        .cd-description { color: #475569; line-height: 1.7; font-size: 0.95rem; margin: 0; }

        .cd-tabs { display: flex; gap: 8px; margin-bottom: 20px; }
        .cd-tab { padding: 11px 22px; border-radius: 14px; background: white; border: 1px solid rgba(0,0,0,0.08); color: #64748b; font-weight: 700; cursor: pointer; transition: 0.2s; display: flex; align-items: center; gap: 7px; font-size: 0.9rem; }
        .cd-tab.active { background: linear-gradient(135deg, #FF6B8B, #FF3D6D); color: white; border-color: transparent; }

        .cd-posts { display: flex; flex-direction: column; gap: 16px; }
        .cd-empty { text-align: center; padding: 60px 40px; background: white; border-radius: 20px; border: 1px solid rgba(0,0,0,0.05); color: #94a3b8; }
        .cd-empty svg { margin-bottom: 16px; }
        .cd-empty h3 { font-size: 1.2rem; font-weight: 800; color: #334155; margin: 0 0 6px; }
        .cd-empty p { font-size: 14px; margin: 0; }

        .cd-members-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 14px; }
        .cd-member-card { background: white; border-radius: 18px; padding: 18px; display: flex; align-items: center; gap: 14px; border: 1px solid rgba(0,0,0,0.05); cursor: pointer; transition: 0.2s; }
        .cd-member-card:hover { transform: translateY(-3px); box-shadow: 0 8px 20px rgba(0,0,0,0.08); }
        .cd-member-avatar { width: 44px; height: 44px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
        .cd-member-name { font-weight: 700; font-size: 14px; color: #1e293b; }
        .cd-member-role { font-size: 12px; color: #FF3D6D; font-weight: 700; text-transform: capitalize; }

        .cd-loading, .cd-not-found { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; text-align: center; color: #64748b; }
        .cd-spinner { width: 40px; height: 40px; border: 4px solid #f1f5f9; border-top-color: #FF3D6D; border-radius: 50%; animation: cdSpin 0.8s linear infinite; }
        @keyframes cdSpin { to { transform: rotate(360deg); } }
        .cd-not-found button { background: linear-gradient(135deg, #FF6B8B, #FF3D6D); color: white; border: none; padding: 12px 24px; border-radius: 14px; font-weight: 700; cursor: pointer; margin-top: 8px; }
      `}</style>
    </div>
  );
}
