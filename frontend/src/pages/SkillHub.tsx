import React, { useState, useEffect } from 'react';
import { ArrowLeft, Inbox, ClipboardList, Star, CheckCircle, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';
import Navbar from '../components/Navbar';
import { motion, AnimatePresence } from 'framer-motion';

export default function SkillHub() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'requests' | 'services'>('requests');
  const [requests, setRequests] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Review state
  const [reviewing, setReviewing] = useState<any | null>(null);
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [reqsRes, servsRes] = await Promise.all([
        api.get('/skill-market/bookings/client'),
        api.get('/skill-market/bookings/provider')
      ]);
      setRequests(reqsRes.data.bookings || []);
      setServices(servsRes.data.bookings || []);
    } catch (err) {
      console.error('Failed to load bookings', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (bookingId: string, status: string) => {
    try {
      await api.post(`/skill-market/bookings/${bookingId}/status`, { status });
      // Update local state
      setServices(prev => prev.map(b => b.booking_id === bookingId ? { ...b, status } : b));
    } catch (err) {
      console.error('Failed to update status', err);
      alert('Failed to update. Try again.');
    }
  };

  const submitReview = async () => {
    if (!rating) return alert('Please select a rating (1-5 stars).');
    setSubmittingReview(true);
    try {
      await api.post(`/skill-market/bookings/${reviewing.booking_id}/rate`, { rating, review: reviewText });
      alert('Review submitted successfully!');
      setReviewing(null);
      setRating(0);
      setReviewText('');
      fetchData(); // refresh to show rating
    } catch (err) {
      console.error('Failed to submit review', err);
      alert('Failed to submit review. Try again.');
    } finally {
      setSubmittingReview(false);
    }
  };

  const renderStatus = (status: string) => {
    switch (status) {
      case 'pending': return <span className="sh-status sh-status--pending">Pending</span>;
      case 'accepted': return <span className="sh-status sh-status--accepted">Accepted</span>;
      case 'cancelled': return <span className="sh-status sh-status--declined">Declined</span>;
      case 'completed': return <span className="sh-status sh-status--completed">Completed</span>;
      default: return null;
    }
  };

  return (
    <div className="sh-layout">
      <Navbar />

      <main className="sh-main">
        <header className="sh-header">
          <button className="sh-back" onClick={() => navigate('/skill-market')}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="sh-title">Skill Hub</h1>
            <p className="sh-subtitle">Manage your bookings and requests</p>
          </div>
        </header>

        <div className="sh-tabs">
          <button 
            className={`sh-tab ${activeTab === 'requests' ? 'sh-tab--active' : ''}`}
            onClick={() => setActiveTab('requests')}
          >
            <Inbox size={18} />
            My Requests
          </button>
          <button 
            className={`sh-tab ${activeTab === 'services' ? 'sh-tab--active' : ''}`}
            onClick={() => setActiveTab('services')}
          >
            <ClipboardList size={18} />
            My Services
          </button>
        </div>

        <div className="sh-content">
          {loading ? (
            <div className="sh-loading">Loading...</div>
          ) : activeTab === 'requests' ? (
            // ── My Requests (Where I booked someone) ──
            <div className="sh-list">
              {requests.length === 0 ? (
                <div className="sh-empty">You haven't requested any services yet.</div>
              ) : (
                requests.map(b => (
                  <div key={b.booking_id} className="sh-card">
                    <div className="sh-card-header">
                      <div className="sh-card-user">
                        <img src={b.provider_avatar || '/uploads/default-avatar.png'} alt="" className="sh-avatar" />
                        <div>
                          <p className="sh-name">{b.provider_name}</p>
                          <p className="sh-user">@{b.provider_username}</p>
                        </div>
                      </div>
                      {renderStatus(b.status)}
                    </div>
                    <div className="sh-card-body">
                      <h3 className="sh-service-title">{b.title}</h3>
                      <p className="sh-details">Date: {new Date(b.booking_date).toLocaleDateString()}</p>
                      {b.notes && <p className="sh-notes">"{b.notes}"</p>}
                    </div>
                    {b.status === 'completed' && (
                      <div className="sh-card-footer">
                        {b.my_rating ? (
                          <div className="sh-rated">
                            <Star size={14} fill="#eab308" color="#eab308" />
                            <span>You rated this {b.my_rating} stars</span>
                          </div>
                        ) : (
                          <button className="sh-btn sh-btn--primary" onClick={() => setReviewing(b)}>
                            Leave a Review
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          ) : (
            // ── My Services (Where I am the provider) ──
            <div className="sh-list">
              {services.length === 0 ? (
                <div className="sh-empty">No one has booked your services yet.</div>
              ) : (
                services.map(b => (
                  <div key={b.booking_id} className="sh-card">
                    <div className="sh-card-header">
                      <div className="sh-card-user">
                        <img src={b.client_avatar || '/uploads/default-avatar.png'} alt="" className="sh-avatar" />
                        <div>
                          <p className="sh-name">{b.client_name}</p>
                          <p className="sh-user">@{b.client_username}</p>
                        </div>
                      </div>
                      {renderStatus(b.status)}
                    </div>
                    <div className="sh-card-body">
                      <h3 className="sh-service-title">{b.title}</h3>
                      <p className="sh-details">Date: {new Date(b.booking_date).toLocaleDateString()}</p>
                      {b.notes && <p className="sh-notes">"{b.notes}"</p>}
                    </div>
                    {b.status === 'pending' && (
                      <div className="sh-card-actions">
                        <button className="sh-btn sh-btn--success" onClick={() => handleUpdateStatus(b.booking_id, 'accepted')}>
                          <CheckCircle size={16} /> Accept
                        </button>
                        <button className="sh-btn sh-btn--danger" onClick={() => handleUpdateStatus(b.booking_id, 'cancelled')}>
                          <XCircle size={16} /> Decline
                        </button>
                      </div>
                    )}
                    {b.status === 'accepted' && (
                      <div className="sh-card-actions">
                        <button className="sh-btn sh-btn--primary" onClick={() => handleUpdateStatus(b.booking_id, 'completed')}>
                          Mark as Completed
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </main>

      {/* Review Modal */}
      <AnimatePresence>
        {reviewing && (
          <div className="sh-overlay">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="sh-modal"
            >
              <h2>Rate {reviewing.provider_name}</h2>
              <p className="sh-modal-sub">How was your session for "{reviewing.title}"?</p>
              
              <div className="sh-stars">
                {[1, 2, 3, 4, 5].map(star => (
                  <button key={star} onClick={() => setRating(star)} className={`sh-star ${rating >= star ? 'sh-star--active' : ''}`}>
                    <Star size={32} fill={rating >= star ? '#eab308' : 'none'} strokeWidth={1.5} />
                  </button>
                ))}
              </div>

              <textarea 
                className="sh-textarea"
                placeholder="Write a review (optional)..."
                value={reviewText}
                onChange={e => setReviewText(e.target.value)}
                rows={3}
              />

              <div className="sh-modal-actions">
                <button className="sh-btn sh-btn--ghost" onClick={() => setReviewing(null)}>Cancel</button>
                <button className="sh-btn sh-btn--primary" disabled={!rating || submittingReview} onClick={submitReview}>
                  {submittingReview ? 'Submitting...' : 'Submit Review'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style>{`
        .sh-layout { min-height: 100vh; background: #fff; padding-top: 70px; padding-bottom: 80px; font-family: 'Inter', sans-serif; }
        .sh-main { max-width: 600px; margin: 0 auto; }
        
        .sh-header { display: flex; align-items: center; gap: 16px; padding: 20px; border-bottom: 1px solid #f3f4f6; }
        .sh-back { width: 40px; height: 40px; border-radius: 50%; border: none; background: #f3f4f6; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #111827; }
        .sh-title { font-size: 20px; font-weight: 800; color: #111827; margin: 0; }
        .sh-subtitle { font-size: 13px; color: #6b7280; margin: 0; }

        .sh-tabs { display: flex; padding: 0 20px; border-bottom: 1px solid #f3f4f6; }
        .sh-tab { flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 16px 0; background: none; border: none; font-size: 14px; font-weight: 600; color: #6b7280; border-bottom: 2px solid transparent; cursor: pointer; transition: all 0.2s; }
        .sh-tab--active { color: #e11d48; border-bottom-color: #e11d48; }

        .sh-content { padding: 20px; }
        .sh-loading { text-align: center; padding: 40px; color: #6b7280; font-size: 14px; }
        .sh-empty { text-align: center; padding: 60px 20px; color: #9ca3af; font-size: 14px; background: #f9fafb; border-radius: 16px; }

        .sh-list { display: flex; flex-direction: column; gap: 16px; }
        .sh-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 16px; overflow: hidden; }
        
        .sh-card-header { display: flex; justify-content: space-between; align-items: center; padding: 16px; background: #f9fafb; border-bottom: 1px solid #f3f4f6; }
        .sh-card-user { display: flex; align-items: center; gap: 12px; }
        .sh-avatar { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; }
        .sh-name { font-size: 14px; font-weight: 700; color: #111827; margin: 0; }
        .sh-user { font-size: 12px; color: #6b7280; margin: 0; }
        
        .sh-status { font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 99px; text-transform: uppercase; letter-spacing: 0.5px; }
        .sh-status--pending { background: #fef3c7; color: #d97706; }
        .sh-status--accepted { background: #dbeafe; color: #2563eb; }
        .sh-status--declined { background: #fee2e2; color: #dc2626; }
        .sh-status--completed { background: #ecfdf5; color: #10b981; }

        .sh-card-body { padding: 16px; }
        .sh-service-title { font-size: 16px; font-weight: 700; color: #111827; margin: 0 0 8px 0; }
        .sh-details { font-size: 13px; color: #4b5563; margin: 0 0 8px 0; }
        .sh-notes { font-size: 13px; color: #6b7280; font-style: italic; background: #f9fafb; padding: 10px; border-radius: 8px; margin: 0; }

        .sh-card-actions { display: flex; gap: 8px; padding: 16px; border-top: 1px solid #f3f4f6; }
        .sh-card-footer { padding: 16px; border-top: 1px solid #f3f4f6; display: flex; justify-content: flex-end; }
        
        .sh-btn { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 10px 16px; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; border: none; flex: 1; transition: background 0.2s; }
        .sh-btn--primary { background: #111827; color: #fff; }
        .sh-btn--primary:hover { background: #000; }
        .sh-btn--success { background: #ecfdf5; color: #10b981; }
        .sh-btn--success:hover { background: #d1fae5; }
        .sh-btn--danger { background: #fee2e2; color: #dc2626; }
        .sh-btn--danger:hover { background: #fecaca; }
        .sh-btn--ghost { background: transparent; color: #6b7280; }
        .sh-btn--ghost:hover { background: #f3f4f6; }
        
        .sh-rated { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; color: #ca8a04; }

        /* Review Modal */
        .sh-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; padding: 20px; z-index: 1000; }
        .sh-modal { background: #fff; border-radius: 20px; padding: 24px; width: 100%; max-width: 400px; box-shadow: 0 20px 40px rgba(0,0,0,0.2); }
        .sh-modal h2 { font-size: 20px; font-weight: 800; color: #111827; margin: 0 0 4px 0; text-align: center; }
        .sh-modal-sub { font-size: 13px; color: #6b7280; text-align: center; margin: 0 0 20px 0; }
        
        .sh-stars { display: flex; justify-content: center; gap: 8px; margin-bottom: 24px; }
        .sh-star { background: none; border: none; padding: 0; cursor: pointer; color: #d1d5db; transition: transform 0.1s; }
        .sh-star:hover { transform: scale(1.1); }
        .sh-star--active { color: #eab308; }

        .sh-textarea { width: 100%; padding: 12px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; font-family: inherit; font-size: 14px; outline: none; resize: none; margin-bottom: 20px; }
        .sh-textarea:focus { border-color: #111827; }

        .sh-modal-actions { display: flex; gap: 12px; }
      `}</style>
    </div>
  );
}
