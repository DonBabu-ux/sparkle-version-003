import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, BadgeCheck, ShieldCheck, Star, FileText, Upload, Send, CheckCircle2 } from 'lucide-react';
import Navbar from '../components/Navbar';
import { useUserStore } from '../store/userStore';

export default function Verified() {
  const navigate = useNavigate();
  const { user } = useUserStore();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    category: '',
    documentType: '',
    description: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setStep(3);
    }, 2000);
  };

  return (
    <div className="verified-root">
      <Navbar />
      <div className="verified-content">
        <div className="verified-container responsive-container">
          <header className="verified-header">
            <button onClick={() => navigate(-1)} className="back-btn">
              <ArrowLeft size={24} />
            </button>
            <div className="header-info">
              <h1>Request Verification</h1>
              <p>Apply for a Sparkle Verified badge to show authenticity.</p>
            </div>
          </header>

          <div className="verified-main">
            {step === 1 && (
              <div className="verified-intro responsive-card animate-fade-in">
                <div className="badge-preview">
                  <div className="preview-avatar">
                    <img src={user?.avatar_url || '/uploads/avatars/default.png'} alt="" />
                    <div className="floating-badge">
                      <BadgeCheck size={32} fill="#1d9bf0" color="white" />
                    </div>
                  </div>
                  <h3>Apply for Verification</h3>
                  <p>A verified badge confirms that this is the authentic profile for this public figure, celebrity, or campus leader.</p>
                </div>

                <div className="verified-benefits">
                  <div className="benefit-item">
                    <div className="benefit-icon"><ShieldCheck size={24} /></div>
                    <div className="benefit-text">
                      <h4>Increased Authenticity</h4>
                      <p>Let people know you are who you say you are.</p>
                    </div>
                  </div>
                  <div className="benefit-item">
                    <div className="benefit-icon"><Star size={24} /></div>
                    <div className="benefit-text">
                      <h4>Premium Status</h4>
                      <p>Unlock exclusive creator features and analytics.</p>
                    </div>
                  </div>
                </div>

                <button onClick={() => setStep(2)} className="start-btn mobile-full-btn">
                  Start Application
                </button>
              </div>
            )}

            {step === 2 && (
              <form onSubmit={handleSubmit} className="verified-form responsive-card animate-fade-in">
                <div className="form-section">
                  <label><Star size={16} /> Category</label>
                  <select
                    required
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                  >
                    <option value="">Select a category</option>
                    <option value="student_leader">Student Leader</option>
                    <option value="creator">Content Creator</option>
                    <option value="athlete">Campus Athlete</option>
                    <option value="influencer">Social Influencer</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="form-section">
                  <label><FileText size={16} /> Identity Document</label>
                  <select
                    required
                    value={formData.documentType}
                    onChange={e => setFormData({ ...formData, documentType: e.target.value })}
                  >
                    <option value="">Select ID type</option>
                    <option value="student_id">Student ID Card</option>
                    <option value="passport">Passport</option>
                    <option value="drivers_license">Driver's License</option>
                  </select>
                </div>

                <div className="form-section">
                  <label><Upload size={16} /> Upload Document</label>
                  <div className="upload-box">
                    <input type="file" id="id-upload" className="hidden" required />
                    <label htmlFor="id-upload" className="upload-label">
                      <Upload size={32} className="text-slate-300 mb-2" />
                      <span>Select image or PDF</span>
                    </label>
                  </div>
                </div>

                <div className="form-section">
                  <label>Why should you be verified?</label>
                  <textarea
                    rows={4}
                    placeholder="Tell us about your online presence..."
                    required
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                  ></textarea>
                </div>

                <button type="submit" disabled={loading} className="submit-btn mobile-full-btn">
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <Send size={18} />
                      Submit Application
                    </>
                  )}
                </button>
              </form>
            )}

            {step === 3 && (
              <div className="verified-success responsive-card animate-scale-in">
                <div className="success-icon">
                  <CheckCircle2 size={80} className="text-emerald-500" />
                </div>
                <h2>Application Submitted!</h2>
                <p>We've received your request for verification. Our Sparkle moderators will review your application and documents within 24–48 hours.</p>
                <div className="status-timeline">
                  <div className="timeline-item active">
                    <div className="dot"></div>
                    <span>Submitted</span>
                  </div>
                  <div className="timeline-item">
                    <div className="dot"></div>
                    <span>Under Review</span>
                  </div>
                  <div className="timeline-item">
                    <div className="dot"></div>
                    <span>Decision</span>
                  </div>
                </div>
                <button onClick={() => navigate('/dashboard')} className="back-home-btn mobile-full-btn">
                  Back to Dashboard
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .verified-root { display: flex; background: #F8FAFC; min-height: 100vh; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
        .verified-content { flex: 1; height: 100vh; overflow-y: auto; padding: 20px; }
        .verified-container { max-width: 600px; margin: 40px auto; padding-bottom: 100px; }
        .verified-header { display: flex; gap: 20px; margin-bottom: 40px; align-items: flex-start; }
        .back-btn { background: white; border: none; width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #1e293b; shadow: 0 4px 12px rgba(0,0,0,0.05); cursor: pointer; }
        .header-info h1 { font-size: 2rem; font-weight: 800; color: #0f172a; margin-bottom: 4px; font-family: 'Outfit', sans-serif; }
        .header-info p { color: #64748b; font-size: 1rem; }

        .verified-intro { background: white; border-radius: 32px; padding: 40px; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.03); border: 1px solid #f1f5f9; }
        .badge-preview { margin-bottom: 40px; }
        .preview-avatar { position: relative; width: 120px; height: 120px; margin: 0 auto 24px; }
        .preview-avatar img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; border: 4px solid #fff; box-shadow: 0 10px 20px rgba(0,0,0,0.1); }
        .floating-badge { position: absolute; bottom: 0; right: 0; }
        .badge-preview h3 { font-size: 1.5rem; font-weight: 800; color: #1e293b; margin-bottom: 12px; }
        .badge-preview p { color: #64748b; line-height: 1.6; }

        .verified-benefits { display: grid; gap: 20px; margin-bottom: 40px; text-align: left; }
        .benefit-item { display: flex; gap: 16px; align-items: flex-start; padding: 20px; background: #f8fafc; border-radius: 20px; }
        .benefit-icon { width: 48px; height: 48px; border-radius: 14px; background: #fff; display: flex; align-items: center; justify-content: center; color: #1d9bf0; box-shadow: 0 4px 10px rgba(0,0,0,0.05); flex-shrink: 0; }
        .benefit-text h4 { font-weight: 800; color: #1e293b; margin-bottom: 4px; }
        .benefit-text p { font-size: 0.9rem; color: #64748b; }

        .start-btn, .submit-btn, .back-home-btn { width: 100%; padding: 18px; border-radius: 20px; background: #1d9bf0; color: white; font-weight: 800; font-size: 1rem; cursor: pointer; border: none; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 10px; }
        .start-btn:hover, .submit-btn:hover { background: #0c85d0; transform: translateY(-2px); }

        .verified-form { background: white; border-radius: 32px; padding: 40px; box-shadow: 0 10px 30px rgba(0,0,0,0.03); border: 1px solid #f1f5f9; }
        .form-section { margin-bottom: 24px; }
        .form-section label { display: flex; align-items: center; gap: 8px; font-weight: 800; color: #475569; margin-bottom: 10px; font-size: 0.9rem; }
        .form-section select, .form-section textarea { width: 100%; padding: 16px; border-radius: 16px; border: 1.5px solid #e2e8f0; outline: none; font-family: inherit; font-size: 1rem; transition: border-color 0.2s; }
        .form-section select:focus, .form-section textarea:focus { border-color: #1d9bf0; }
        .upload-box { border: 2px dashed #e2e8f0; border-radius: 16px; text-align: center; cursor: pointer; }
        .upload-label { display: flex; flex-direction: column; align-items: center; padding: 30px; cursor: pointer; color: #94a3b8; font-weight: 700; font-size: 0.9rem; }
        .upload-box:hover { background: #f8fafc; border-color: #1d9bf0; }

        .verified-success { background: white; border-radius: 32px; padding: 40px; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.03); border: 1px solid #f1f5f9; }
        .success-icon { margin-bottom: 24px; }
        .verified-success h2 { font-size: 1.8rem; font-weight: 800; color: #1e293b; margin-bottom: 12px; }
        .verified-success p { color: #64748b; line-height: 1.6; margin-bottom: 40px; }
        .status-timeline { display: flex; justify-content: space-between; margin-bottom: 40px; position: relative; padding: 0 20px; }
        .status-timeline::before { content: ''; position: absolute; top: 12px; left: 40px; right: 40px; height: 2px; background: #e2e8f0; z-index: 0; }
        .timeline-item { position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; gap: 10px; color: #94a3b8; font-weight: 700; font-size: 0.75rem; }
        .timeline-item.active { color: #1d9bf0; }
        .dot { width: 24px; height: 24px; border-radius: 50%; background: #e2e8f0; border: 4px solid #fff; }
        .timeline-item.active .dot { background: #1d9bf0; }
      `}</style>
    </div>
  );
}
