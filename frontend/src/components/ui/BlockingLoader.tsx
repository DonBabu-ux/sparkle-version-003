import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * Facebook-style blocking loader.
 *
 * Design goals (from the product brief):
 *  - It sits in the middle of the screen and BLOCKS every other user action
 *    except "back" — a frozen spinner is honest about the app being unable
 *    to proceed, and lets the user leave without guessing.
 *  - It is speed-adaptive: MIN_MS is the floor, so a fast network never
 *    produces a flicker-splash, while a slow network keeps it up for as
 *    long as the real work needs. It never lies about being faster.
 */

const MIN_MS = 300;

interface LoaderState { show: boolean; label: string }

export const useBlockingLoader = () => {
    const [state, setState] = useState<LoaderState>({ show: false, label: 'Loading' });
    const shownAt = useRef<number>(0);
    const pendingHidden = useRef<boolean>(false);
    const timer = useRef<number | null>(null);

    const start = useCallback((label = 'Loading') => {
        pendingHidden.current = false;
        if (timer.current) { window.clearTimeout(timer.current); timer.current = null; }
        shownAt.current = Date.now();
        setState({ show: true, label });
    }, []);

    const done = useCallback(() => {
        const elapsed = Date.now() - shownAt.current;
        const remaining = MIN_MS - elapsed;
        pendingHidden.current = true;
        const hide = () => {
            if (!pendingHidden.current) return; // a new start() superseded this hide
            timer.current = null;
            setState(s => (s.show ? { ...s, show: false } : s));
        };
        if (remaining > 0) {
            timer.current = window.setTimeout(hide, remaining);
        } else {
            hide();
        }
    }, []);

    useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

    return { ...state, start, done };
};

interface BlockingLoaderProps {
    show: boolean;
    label?: string;
    sublabel?: string;
    /** Translucent so the frozen app stays visible underneath — Facebook's
     *  reconnect pattern. The blur is what tells the user it's inert. */
    variant?: 'solid' | 'translucent';
}

export const BlockingLoader: React.FC<BlockingLoaderProps> = ({
    show,
    label = 'Loading',
    sublabel,
    variant = 'solid',
}) => {
    const navigate = useNavigate();
    if (!show) return null;

    const shell = variant === 'translucent'
        ? 'bg-[#f8e7ed]/70 dark:bg-zinc-900/70 backdrop-blur-md'
        : 'bg-[#f8e7ed] dark:bg-zinc-900';

    return (
        <div
            className={`fixed inset-0 z-(--z-max) flex flex-col items-center justify-center ${shell}`}
            role="dialog"
            aria-modal="true"
            aria-busy="true"
            aria-label={label}
        >
            <button
                type="button"
                onClick={() => navigate(-1)}
                aria-label="Go back"
                className="absolute top-4 left-4 w-10 h-10 rounded-full flex items-center justify-center bg-[#fdf8fa] dark:bg-zinc-800 border border-[#e6d8e1] dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:text-[#18181b] dark:hover:text-zinc-100 transition-colors"
            >
                <ArrowLeft size={20} />
            </button>

            <div
                className="w-10 h-10 rounded-full border-2 border-[#e6d8e1] dark:border-zinc-700 border-t-[#ff1493] animate-spin drop-shadow-sm"
                aria-hidden
            />
            <p className="mt-5 text-sm font-bold text-[#18181b] dark:text-zinc-100 drop-shadow-sm">{label}</p>
            {sublabel && (
                <p className="mt-1 text-xs text-slate-600 dark:text-zinc-400 drop-shadow-sm">{sublabel}</p>
            )}
        </div>
    );
};
