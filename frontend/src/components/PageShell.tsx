import 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Navbar, { MOBILE_HEADERLESS_PREFIXES } from './Navbar';

/**
 * Layout route (S1 / §3 P2-1): owns chrome (sidebar + mobile header) and the
 * shell offsets ONCE — `pl-(--rail-w)` on md+, `pt-(--header-h)` on mobile
 * pages where the glass header shows. Pages render only their content.
 */
export function PageShell() {
    const { pathname } = useLocation();
    const hasMobileHeader = !MOBILE_HEADERLESS_PREFIXES.some(prefix => pathname.startsWith(prefix));

    return (
        <>
            <Navbar />
            <div className={hasMobileHeader ? 'page-shell page-shell--under-header' : 'page-shell'}>
                <Outlet />
            </div>
        </>
    );
}

export default PageShell;
