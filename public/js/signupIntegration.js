// signupIntegration.js - Connect Signup Page to Sparkle Backend
// Import this script in signup.html BEFORE the existing signup script

class SignupBackend {
    constructor() {
        this.apiUrl = '/api';
    }

    async signup(userData) {
        try {
            const response = await fetch(`${this.apiUrl}/auth/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: userData.fullName,
                    username: userData.username,
                    email: userData.email,
                    password: userData.password,
                    campus: userData.campus || 'University',
                    major: userData.major || 'Sparkler',
                    year: userData.year || 'Freshman'
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Signup failed');
            }

            return { success: true, message: data.message, userId: data.userId };
        } catch (error) {
            console.error('Signup error:', error);
            return { success: false, error: error.message };
        }
    }

    async login(username, password) {
        try {
            const response = await fetch(`${this.apiUrl}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Login failed');
            }

            // Store token and user data
            localStorage.setItem('sparkleToken', data.token);
            localStorage.setItem('currentUser', JSON.stringify(data.user));

            return { success: true, user: data.user };
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, error: error.message };
        }
    }
}

// Create global instance
window.signupBackend = new SignupBackend();

// Override the createAccount function
document.addEventListener('DOMContentLoaded', function () {
    console.log('🔌 Signup Backend Integration Loaded');

    // Store reference to original createAccount if it exists
    const originalCreateAccount = window.createAccount;

    // Override with backend-connected version
    window.createAccount = async function () {
        const createBtn = document.getElementById('create-account');
        const messageEl = document.getElementById('panel4-message');

        if (!createBtn) {
            console.error('Create account button not found');
            return;
        }

        const originalText = createBtn.innerHTML;

        // Gather user data from the form
        const userData = {
            fullName: document.getElementById('full-name')?.value?.trim() || '',
            username: document.getElementById('username')?.value?.trim() || '',
            email: document.getElementById('email')?.value?.trim() || '',
            password: document.getElementById('password')?.value || '',
            bio: document.getElementById('bio')?.value?.trim() || '',
            campus: document.getElementById('campus')?.value || 'University',
            major: document.getElementById('major')?.value || 'Sparkler',
            year: document.getElementById('year')?.value || 'Freshman',
            gender: document.getElementById('gender')?.value || '',
            birthdate: document.getElementById('birthdate')?.value || '',
            phone: document.getElementById('phone')?.value?.trim() || ''
        };

        // Validate required fields
        if (!userData.fullName || !userData.username || !userData.email || !userData.password) {
            if (messageEl) {
                messageEl.textContent = 'Please fill in all required fields';
                messageEl.className = 'message error show';
            }
            return;
        }

        // Show loading state
        createBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating Account...';
        createBtn.disabled = true;

        try {
            // Call backend signup
            const signupResult = await window.signupBackend.signup(userData);

            if (!signupResult.success) {
                throw new Error(signupResult.error);
            }

            if (messageEl) {
                messageEl.textContent = '✨ Account created successfully! Logging you in...';
                messageEl.className = 'message success show';
            }

            // Auto-login after successful signup
            const loginResult = await window.signupBackend.login(userData.username, userData.password);

            if (loginResult.success) {
                // Store additional user data in localStorage
                localStorage.setItem('sparkleUser', JSON.stringify({
                    ...loginResult.user,
                    fullName: userData.fullName,
                    bio: userData.bio,
                    campus: userData.campus,
                    major: userData.major,
                    year: userData.year
                }));

                if (messageEl) {
                    messageEl.textContent = '🎉 Welcome to Sparkle! Redirecting to dashboard...';
                    messageEl.className = 'message success show';
                }

                // Redirect to dashboard after short delay
                setTimeout(() => {
                    window.location.href = '/dashboard';
                }, 2000);
            } else {
                // Account created but login failed - redirect to login page
                if (messageEl) {
                    messageEl.textContent = 'Account created! Please login manually.';
                    messageEl.className = 'message success show';
                }

                setTimeout(() => {
                    window.location.href = '/login';
                }, 2000);
            }

        } catch (error) {
            console.error('Account creation error:', error);

            let errorMessage = 'Account creation failed. Please try again.';

            // Handle specific error messages
            if (error.message.includes('duplicate') || error.message.includes('already exists')) {
                errorMessage = 'Username or email already exists. Please choose another.';
            } else if (error.message.includes('password')) {
                errorMessage = 'Password is too weak. Use at least 6 characters.';
            } else if (error.message) {
                errorMessage = error.message;
            }

            if (messageEl) {
                messageEl.textContent = errorMessage;
                messageEl.className = 'message error show';
            }

            // Reset button
            createBtn.innerHTML = originalText;
            createBtn.disabled = false;
        }
    };

    console.log('✅ Signup function overridden with backend integration');
});
