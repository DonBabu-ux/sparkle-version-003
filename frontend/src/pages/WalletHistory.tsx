import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';
import { motion } from 'framer-motion';
import {
  ArrowLeft, RefreshCw, Filter, Search, ChevronLeft, ChevronRight,
  TrendingUp, TrendingDown, ArrowDownCircle, ArrowUpCircle, Heart,
  Zap, BadgeCheck, DollarSign, Megaphone, Store, RefreshCw as RefundIcon,
  Activity, Calendar, ShieldCheck
} from 'lucide-react';
import Spinner from '../components/ui/Spinner';
import { logger } from '../utils/logger';

interface Transaction {
  transaction_id: string;
  reference: string;
  type: string;
  status: 'Pending' | 'Completed' | 'Failed' | 'Refunded';
  amount: number; // cents
  currency: string;
  payment_provider: string | null;
  created_at: string;
}

const TXN_ICONS: Record<string, React.ReactNode> = {
  Deposit:        <ArrowDownCircle size={18} className="text-emerald-500" />,
  Withdrawal:     <ArrowUpCircle size={18} className="text-red-500" />,
  Revenue:        <TrendingUp size={18} className="text-amber-500" />,
  AdRevenue:      <Megaphone size={18} className="text-purple-500" />,
  Tip:            <Heart size={18} className="text-pink-500" />,
  BoostPurchase:  <Zap size={18} className="text-yellow-500" />,
  BoostSpend:     <Zap size={18} className="text-orange-500" />,
  Subscription:   <BadgeCheck size={18} className="text-sky-500" />,
  CreatorPayment: <DollarSign size={18} className="text-violet-500" />,
  Purchase:       <Store size={18} className="text-indigo-500" />,
  Refund:         <RefundIcon size={18} className="text-sky-500" />,
};

const formatKES = (cents: number) =>
  `KES ${(cents / 100).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function WalletHistory() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page, limit: 12 };
      if (typeFilter) params.type = typeFilter;
      if (statusFilter) params.status = statusFilter;
      
      const res = await api.get('/wallet/history', { params });
      if (res.data.success) {
        setTransactions(res.data.transactions || []);
        const pagesCount = res.data.pagination?.totalPages || res.data.totalPages || res.data.pages || 1;
        setTotalPages(pagesCount);
      }
    } catch (e) {
      logger.error('Failed to load transaction history:', e);
    } finally {
      setLoading(false);
    }
  }, [page, typeFilter, statusFilter]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const filteredTransactions = transactions.filter((t) =>
    t.reference.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-dvh bg-[#fafafd] text-slate-800 font-sans pb-16 relative">
      <style>{`
        .glass-card { background: rgba(255, 255, 255, 0.85); border: 1px solid rgba(255, 31, 109, 0.15); backdrop-filter: blur(20px); }
      `}</style>

      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-4 py-3 sticky top-0 z-50 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <ArrowLeft size={20} className="text-slate-800" strokeWidth={2.5} />
          </button>
          <div>
            <h1 className="text-lg font-black text-slate-900 tracking-tighter italic uppercase leading-none">Transaction History</h1>
            <p className="text-[8px] font-black text-[#FF1F6D] uppercase tracking-widest italic mt-0.5">Wallet ledger sync</p>
          </div>
        </div>
        <button onClick={fetchHistory} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-600">
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <main className="max-w-[800px] mx-auto p-4 md:p-6 space-y-4">
        {/* Search & Filters */}
        <div className="glass-card p-4 rounded-3xl space-y-3 shadow-sm">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2">
            <Search size={16} className="text-slate-400" />
            <input
              type="text"
              placeholder="Search reference or transaction type..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent border-none text-sm text-slate-800 focus:outline-none placeholder-slate-400 font-semibold"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            <div className="flex items-center gap-1.5 shrink-0">
              <Filter size={12} className="text-slate-400" />
              <span className="text-[9px] font-black uppercase text-slate-500">Filter:</span>
            </div>
            
            <select
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
              className="bg-slate-50 border border-slate-200 rounded-xl px-2 py-1 text-[10px] font-bold text-slate-600 focus:outline-none"
            >
              <option value="">All Types</option>
              <option value="Deposit">Deposit</option>
              <option value="Withdrawal">Withdrawal</option>
              <option value="Revenue">Revenue</option>
              <option value="Tip">Tip</option>
              <option value="BoostPurchase">Boost</option>
              <option value="Refund">Refund</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="bg-slate-50 border border-slate-200 rounded-xl px-2 py-1 text-[10px] font-bold text-slate-600 focus:outline-none"
            >
              <option value="">All Statuses</option>
              <option value="Completed">Completed</option>
              <option value="Pending">Pending</option>
              <option value="Failed">Failed</option>
            </select>
          </div>
        </div>

        {/* Transaction list */}
        <div className="glass-card rounded-3xl p-6 shadow-sm min-h-[400px] flex flex-col justify-between">
          {loading ? (
            <div className="flex items-center justify-center flex-1 py-20">
              <Spinner size="large" color="text-[#FF1F6D]" />
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="text-center py-20 flex-1 flex flex-col items-center justify-center space-y-3">
              <Calendar size={40} className="text-slate-300" />
              <p className="text-sm font-black text-slate-400 uppercase italic">No transactions found</p>
              <p className="text-xs text-slate-400 font-medium">Try resetting your search query or filters.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 flex-1">
              {filteredTransactions.map((txn) => {
                const isCredit = ['Deposit', 'Revenue', 'AdRevenue', 'Tip', 'CreatorPayment', 'Refund'].includes(txn.type);
                return (
                  <motion.div
                    key={txn.transaction_id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-between py-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center">
                        {TXN_ICONS[txn.type] || <Activity size={18} className="text-slate-500" />}
                      </div>
                      <div>
                        <p className="text-xs font-black text-slate-900 uppercase italic">{txn.type}</p>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                          {txn.reference} • {new Date(txn.created_at).toLocaleDateString('en-KE', { dateStyle: 'medium' })}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-end gap-1.5">
                      <span className={`text-sm font-black italic ${isCredit ? 'text-emerald-600' : 'text-red-500'}`}>
                        {isCredit ? '+' : '−'}{formatKES(txn.amount)}
                      </span>
                      <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full border ${
                        txn.status === 'Completed' ? 'bg-emerald-50 border-emerald-200 text-emerald-600' :
                        txn.status === 'Pending' ? 'bg-amber-50 border-amber-200 text-amber-600' :
                        'bg-red-50 border-red-200 text-red-600'
                      }`}>
                        {txn.status}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && !loading && (
            <div className="flex items-center justify-between pt-6 border-t border-slate-100 mt-6">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-4 py-2 border border-slate-200 rounded-xl text-[10px] font-black uppercase text-slate-600 flex items-center gap-1 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <ChevronLeft size={14} /> Prev
              </button>
              <span className="text-[10px] font-black text-slate-500 uppercase">
                Page {page} of {totalPages}
              </span>
              <button
                disabled={page === totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-4 py-2 border border-slate-200 rounded-xl text-[10px] font-black uppercase text-slate-600 flex items-center gap-1 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent"
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>

        {/* Security / System compliance info */}
        <div className="flex items-center justify-center gap-2 py-4 text-center">
          <ShieldCheck size={16} className="text-[#FF1F6D]" />
          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
            Audit Ledger Powered by Sparkle Payment System
          </span>
        </div>
      </main>
    </div>
  );
}
