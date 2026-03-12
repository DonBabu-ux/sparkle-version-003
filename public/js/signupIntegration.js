// signupIntegration.js - Unified Supabase Auth Integration
document.addEventListener('DOMContentLoaded', function () {
    console.log('🔌 Unified Auth Integration Loaded');

    // 1. Initialize Supabase
    let supabase = null;
    const config = window.SUPABASE_CONFIG;

    console.log('🚀 Initializing Supabase Integration...');

    if (window.supabase && config && config.url && config.key) {
        try {
            supabase = window.supabase.createClient(config.url, config.key);
            console.log('✅ Supabase Client Initialized');
        } catch (err) {
            console.error('❌ Failed to create Supabase client:', err);
        }
    } else {
        console.warn('⚠️ Supabase config incomplete or library missing:', {
            library: !!window.supabase,
            url: !!config?.url,
            key: !!config?.key
        });
    }

    // App State for Signup
    const state = {
        userData: {},
        otpType: 'email', // 'email' or 'phone'
        identifier: ''
    };

    // --- Google Auth ---
    const googleBtn = document.getElementById('google-login');
    if (googleBtn) {
        googleBtn.addEventListener('click', async () => {
            if (!supabase) {
                console.error('Signup flow blocked: Supabase not initialized.');
                return alert('Supabase not configured locally. Check your .env file and ensure the server restarted.');
            }
            try {
                const { error } = await supabase.auth.signInWithOAuth({
                    provider: 'google',
                    options: { redirectTo: window.location.origin + '/auth/google/callback' }
                });
                if (error) throw error;
            } catch (err) {
                alert('Google Sign-in failed: ' + err.message);
            }
        });
    }

    // --- Phone/Email OTP Flow ---

    // Step 4 "Create Account" really means "Send OTP"
    const createAccountBtn = document.getElementById('create-account');
    if (createAccountBtn) {
        createAccountBtn.onclick = async function () {
            if (!document.getElementById('terms').checked) {
                return alert('Please agree to terms.');
            }

            const btn = document.getElementById('create-account');
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending code...';
            btn.disabled = true;

            const u = window.appState.userData;
            state.userData = u;

            // Prefer phone for OTP if provided, otherwise email
            state.otpType = u.phone ? 'phone' : 'email';
            state.identifier = u.phone || u.email;

            try {
                if (!supabase) throw new Error('Supabase client not initialized. Check your project configuration.');

                const { error } = await supabase.auth.signInWithOtp({
                    [state.otpType]: state.identifier,
                    options: {
                        shouldCreateUser: true,
                        captchaToken: null
                    }
                });

                if (error) throw error;

                // Move to Panel 5
                window.goToStep(5);
                document.getElementById('panel5-message').textContent = `Code sent to ${state.identifier}`;
                document.getElementById('panel5-message').className = 'auth-message success show';

            } catch (err) {
                console.error('OTP Send Error:', err);
                alert('Failed to send code: ' + err.message);
                btn.innerHTML = '<i class="fas fa-user-plus"></i> Create Account';
                btn.disabled = false;
            }
        };
    }

    // Step 5 Verify OTP
    const verifyBtn = document.getElementById('verify-otp-btn');
    if (verifyBtn) {
        verifyBtn.addEventListener('click', async () => {
            const code = document.getElementById('otp-code').value.trim();
            if (!code || code.length < 6) return alert('Enter a valid 6-digit code');

            verifyBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying...';
            verifyBtn.disabled = true;

            try {
                const { data: { session }, error } = await supabase.auth.verifyOtp({
                    [state.otpType]: state.identifier,
                    token: code,
                    type: state.otpType === 'phone' ? 'sms' : 'signup'
                });

                if (error) throw error;

                // OTP Verified! Now sync with MySQL
                const syncResponse = await fetch('/api/auth/otp/verify/sync', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        type: state.otpType,
                        value: state.identifier,
                        metadata: state.userData
                    })
                });

                const syncResult = await syncResponse.json();
                if (syncResult.status === 'success') {
                    window.location.href = '/dashboard';
                } else {
                    throw new Error(syncResult.message || 'Sync failed');
                }

            } catch (err) {
                alert('Verification failed: ' + err.message);
                verifyBtn.innerHTML = 'Verify & Complete';
                verifyBtn.disabled = false;
            }
        });
    }

    // Back from OTP
    const backToSummary = document.getElementById('back-to-summary');
    if (backToSummary) {
        backToSummary.addEventListener('click', () => window.goToStep(4));
    }

    // Resend OTP
    const resendBtn = document.getElementById('resend-otp');
    if (resendBtn) {
        resendBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                const { error } = await supabase.auth.signInWithOtp({
                    [state.otpType]: state.identifier
                });
                if (error) throw error;
                alert('Code resent!');
            } catch (err) {
                alert('Resend failed: ' + err.message);
            }
        });
    }

    // Final Sync for Google (if coming back from callback)
    const checkSocialCallback = async () => {
        if (!supabase) return;
        const { data: { session }, error } = await supabase.auth.getSession();
        if (session && !localStorage.getItem('sparkleToken')) {
            const profile = {
                email: session.user.email,
                full_name: session.user.user_metadata.full_name,
                avatar_url: session.user.user_metadata.avatar_url
            };

            const response = await fetch('/api/auth/google/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ profile })
            });

            const result = await response.json();
            if (result.status === 'success') {
                window.location.href = '/dashboard';
            }
        }
    };

    checkSocialCallback();
});
