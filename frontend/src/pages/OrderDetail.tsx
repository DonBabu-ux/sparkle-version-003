import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, CheckCircle2, Clock, MapPin, Package, ShieldAlert, XCircle } from 'lucide-react';
import api from '../api/api';
import { useUserStore } from '../store/userStore';
import { showError, showSuccess } from '../utils/toast';
import { logger } from '../utils/logger';
import Spinner from '../components/ui/Spinner';
import ErrorRetry from '../components/ui/ErrorRetry';

interface OrderDetailData {
  order_id: string;
  listing_id: string;
  listing_title: string;
  listing_description?: string;
  price_at_time?: number;
  agreed_price?: number;
  currency?: string;
  status: string;
  buyer_id: string;
  seller_id: string;
  buyer_username?: string;
  seller_username?: string;
  campus?: string;
  location_description?: string;
  scheduled_time?: string;
  created_at: string;
  meetup_confirmed_by_buyer?: boolean | number;
  meetup_confirmed_by_seller?: boolean | number;
  cancellation_reason?: string;
}

const statusLabels: Record<string, string> = {
  pending: 'Waiting for seller',
  accepted: 'Accepted',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
  completed: 'Completed',
  disputed: 'Disputed'
};

export default function OrderDetail() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { user } = useUserStore();
  const [order, setOrder] = useState<OrderDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [working, setWorking] = useState(false);

  const loadOrder = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    setError(false);
    try {
      const response = await api.get(`/marketplace/orders/${orderId}`);
      setOrder(response.data.order || null);
    } catch (err) {
      logger.error('Failed to load order:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => { loadOrder(); }, [loadOrder]);

  const userId = user?.user_id;
  const isBuyer = Boolean(order && userId && order.buyer_id === userId);
  const isSeller = Boolean(order && userId && order.seller_id === userId);

  const changeStatus = async (status: string, reason?: string) => {
    if (!order) return;
    setWorking(true);
    try {
      await api.patch(`/marketplace/orders/${order.order_id}/status`, { status, reason });
      showSuccess(`Order ${statusLabels[status]?.toLowerCase() || status}`);
      await loadOrder();
    } catch (err: any) {
      showError(err.response?.data?.message || 'Could not update this order');
    } finally {
      setWorking(false);
    }
  };

  const confirmMeetup = async () => {
    if (!order) return;
    setWorking(true);
    try {
      const response = await api.post(`/marketplace/orders/${order.order_id}/confirm-meetup`);
      if (response.data.bothConfirmed) {
        showSuccess('Both sides confirmed the meetup. You can now complete the order.');
      } else {
        showSuccess('Meetup confirmed. Waiting for the other person.');
      }
      await loadOrder();
    } catch (err: any) {
      showError(err.response?.data?.message || 'Could not confirm the meetup');
    } finally {
      setWorking(false);
    }
  };

  const openDispute = async () => {
    if (!order) return;
    const description = window.prompt('Briefly describe what went wrong with this order.');
    if (!description) return;
    setWorking(true);
    try {
      await api.post(`/marketplace/orders/${order.order_id}/dispute`, {
        reason: 'other',
        description
      });
      showSuccess('Dispute opened. Our team will review it.');
      await loadOrder();
    } catch (err: any) {
      showError(err.response?.data?.message || 'Could not open a dispute');
    } finally {
      setWorking(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[#fdf2f4] dark:bg-[#1b1b24]">
        <Spinner size="large" color="text-primary" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center bg-white dark:bg-[#1b1b24] px-6">
        <p className="font-bold text-marketplace-muted mb-4">We could not load this order.</p>
        <ErrorRetry onRetry={loadOrder} />
      </div>
    );
  }

  const amount = order.agreed_price ?? order.price_at_time ?? 0;
  const myMeetupConfirmed = isBuyer
    ? Boolean(order.meetup_confirmed_by_buyer)
    : Boolean(order.meetup_confirmed_by_seller);
  const bothMeetupConfirmed = Boolean(order.meetup_confirmed_by_buyer) && Boolean(order.meetup_confirmed_by_seller);

  return (
    <div className="min-h-dvh bg-white dark:bg-[#1b1b24] text-marketplace-text font-sans pb-24">
      <header className="sticky top-0 z-[1100] bg-white/90 backdrop-blur-md border-b border-marketplace-border px-4 py-3 flex items-center gap-4">
        <button onClick={() => navigate('/marketplace/orders')} className="w-10 h-10 flex items-center justify-center hover:bg-marketplace-bg rounded-full">
          <ChevronLeft size={24} strokeWidth={2.5} />
        </button>
        <h1 className="text-[19px] font-black tracking-tight">Order details</h1>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-6 space-y-4">
        <div className="bg-marketplace-bg rounded-[28px] p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-marketplace-muted">
              #{order.order_id.slice(-6).toUpperCase()}
            </span>
            <span className="text-[11px] font-black uppercase px-3 py-1 rounded-full bg-white dark:bg-[#1b1b24] border border-marketplace-border">
              {statusLabels[order.status] || order.status}
            </span>
          </div>
          <div className="flex items-start gap-3">
            <Package size={28} className="mt-1 shrink-0" />
            <div>
              <h2 className="text-xl font-black leading-tight">{order.listing_title}</h2>
              <p className="text-sm font-bold text-marketplace-muted mt-1">
                {order.currency || 'KES'} {Number(amount).toLocaleString()}
              </p>
            </div>
          </div>
          {order.listing_description && (
            <p className="text-sm text-marketplace-muted mt-4 line-clamp-3">{order.listing_description}</p>
          )}
        </div>

        <div className="border border-marketplace-border rounded-[28px] p-6 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold">
            <Clock size={16} /> Order placed {new Date(order.created_at).toLocaleString()}
          </div>
          <div className="flex items-center gap-2 text-sm font-bold">
            <MapPin size={16} /> {order.location_description || 'Meetup location not set'}
            {order.campus ? `, ${order.campus}` : ''}
          </div>
          {order.scheduled_time && (
            <div className="flex items-center gap-2 text-sm font-bold">
              <Clock size={16} /> Meetup: {new Date(order.scheduled_time).toLocaleString()}
            </div>
          )}
          <p className="text-sm text-marketplace-muted">
            {isBuyer ? `Seller: ${order.seller_username || 'Unknown'}` : `Buyer: ${order.buyer_username || 'Unknown'}`}
          </p>
          {order.cancellation_reason && (
            <p className="text-sm text-rose-600 font-bold">Reason: {order.cancellation_reason}</p>
          )}
        </div>

        <div className="bg-blue-50 border border-blue-100 rounded-[28px] p-5 text-sm text-blue-900">
          Sparkle does not process payment or hold money for marketplace orders. Pay the other person in person after you have inspected the item.
        </div>

        {order.status === 'pending' && isSeller && (
          <div className="grid grid-cols-2 gap-3">
            <button disabled={working} onClick={() => changeStatus('accepted')} className="h-14 rounded-2xl bg-emerald-500 text-white font-black disabled:opacity-50">
              Accept order
            </button>
            <button disabled={working} onClick={() => changeStatus('rejected')} className="h-14 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 font-black disabled:opacity-50">
              Reject
            </button>
          </div>
        )}

        {order.status === 'pending' && isBuyer && (
          <button
            disabled={working}
            onClick={() => changeStatus('cancelled', 'Buyer cancelled the request')}
            className="w-full h-14 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 font-black disabled:opacity-50"
          >
            Cancel request
          </button>
        )}

        {order.status === 'accepted' && (
          <>
            <button
              disabled={working || myMeetupConfirmed}
              onClick={confirmMeetup}
              className="w-full h-14 rounded-2xl bg-marketplace-text text-white font-black disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <CheckCircle2 size={20} />
              {myMeetupConfirmed ? 'You confirmed the meetup' : 'I met the other person'}
            </button>
            <button
              disabled={working || !bothMeetupConfirmed}
              onClick={() => changeStatus('completed')}
              className="w-full h-14 rounded-2xl bg-emerald-500 text-white font-black disabled:opacity-50"
            >
              {bothMeetupConfirmed ? 'Complete order' : 'Both people must confirm the meetup first'}
            </button>
            <div className="grid grid-cols-2 gap-3">
              <button
                disabled={working}
                onClick={() => changeStatus('cancelled', 'Order cancelled before completion')}
                className="h-14 rounded-2xl bg-marketplace-bg font-black disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <XCircle size={18} /> Cancel
              </button>
              <button
                disabled={working}
                onClick={openDispute}
                className="h-14 rounded-2xl bg-amber-50 text-amber-700 border border-amber-100 font-black disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <ShieldAlert size={18} /> Report problem
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}



