// signupIntegration.js - Unified Supabase Auth Integration with Fallback
document.addEventListener('DOMContentLoaded', function () {
    console.log('🔌 Unified Auth Integration Loaded');

    // 1. Initialize Supabase
    let supabase = null;
    const config = window.SUPABASE_CONFIG;
    let useSupabase = false;

    console.log('🚀 Initializing Supabase Integration...');

    if (window.supabase && config && config.url && config.key) {
        try {
            supabase = window.supabase.createClient(config.url, config.key);
            useSupabase = true;
            console.log('✅ Supabase Client Initialized');
        } catch (err) {
            console.error('❌ Failed to create Supabase client:', err);
            useSupabase = false;
        }
    } else {
        console.warn('⚠️ Supabase config incomplete or library missing, using fallback API');
        useSupabase = false;
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
            if (!useSupabase) {
                console.error('Google login requires Supabase');
                return alert('Google login not available in local development without Supabase.');
            }
            try {
                const { error } = await supabase.auth.signInWithOAuth({
                    provider: 'google',
                    options: { redirectTo: window.location.origin + '/auth/google/callback' }
                });
                if (error) throw error;
            } catch (err) {
                if (window.showMessage) window.showMessage('panel1', 'Google Sign-in failed: ' + err.message, 'error');
                else alert('Google Sign-in failed: ' + err.message);
            }
        });
    }

    // --- Phone/Email OTP Flow ---

    // Step 4 "Create Account" really means "Send OTP" or "Create Account"
    const createAccountBtn = document.getElementById('create-account');
    if (createAccountBtn) {
        createAccountBtn.onclick = async function () {
            if (!document.getElementById('terms').checked) {
                if (window.showMessage) window.showMessage('panel4', 'Please agree to terms.', 'error');
                else alert('Please agree to terms.');
                return;
            }

            const btn = document.getElementById('create-account');
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating account...';
            btn.disabled = true;

            const u = window.appState.userData;
            state.userData = u;

            try {
                if (useSupabase) {
                    // Use Supabase OTP flow
                    state.otpType = u.phone ? 'phone' : 'email';
                    state.identifier = u.phone || u.email;

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

                } else {
                    // Fallback: Use direct API signup (no OTP for local dev)
                    console.log('Using fallback API signup...');

                    const signupData = {
                        name: u.name,
                        username: u.username,
                        email: u.email,
                        password: u.password,
                        campus: u.campus,
                        major: u.major,
                        year: u.year,
                        phone_number: u.phone
                    };

                    const response = await fetch('/api/auth/signup', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(signupData)
                    });

                    const result = await response.json();

                    if (result.status === 'success') {
                        // Success - redirect to dashboard
                        window.location.href = '/dashboard';
                    } else {
                        throw new Error(result.message || 'Signup failed');
                    }
                }

            } catch (err) {
                console.error('Signup Error:', err);
                const msg = err.message || 'Check your details and try again.';
                if (window.showMessage) window.showMessage('panel4', 'Signup failed: ' + msg, 'error');
                else alert('Signup failed: ' + msg);
                
                btn.innerHTML = '<i class="fas fa-user-plus"></i> Create Account';
                btn.disabled = false;
            }
        };
    }

    // Step 5 Verify OTP (only if using Supabase)
    const verifyBtn = document.getElementById('verify-otp-btn');
    if (verifyBtn) {
        verifyBtn.addEventListener('click', async () => {
            if (!useSupabase) {
                return alert('OTP verification not available in fallback mode.');
            }

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
