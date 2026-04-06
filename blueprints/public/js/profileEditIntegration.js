// profileEditIntegration.js - Connect Profile Editing to Backend

console.log('🔌 Profile Edit Integration Loaded');

document.addEventListener('DOMContentLoaded', function () {
    // Wait for the page to fully load
    setTimeout(() => {
        // Override the saveProfile function if it exists
        if (typeof window.saveProfile === 'function') {
            const originalSaveProfile = window.saveProfile;

            window.saveProfile = async function () {
                console.log('💾 Saving profile to backend...');

                const nameInput = document.getElementById('edit-name');
                const bioInput = document.getElementById('edit-bio');
                const campusInput = document.getElementById('edit-campus');
                const majorInput = document.getElementById('edit-major');

                if (!nameInput || !bioInput) {
                    console.error('Profile form elements not found');
                    return;
                }

                const profileData = {
                    name: nameInput.value.trim(),
                    bio: bioInput.value.trim(),
                    campus: campusInput?.value || '',
                    major: majorInput?.value || ''
                };

                try {
                    const token = localStorage.getItem('sparkleToken');

                    if (!token) {
                        showNotification('Please login first', 'error');
                        return;
                    }

                    const response = await fetch('/api/users/profile', {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify(profileData)
                    });

                    const data = await response.json();

                    if (!response.ok) {
                        throw new Error(data.error || 'Failed to update profile');
                    }

                    // Update localStorage
                    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
                    const updatedUser = {
                        ...currentUser,
                        name: profileData.name,
                        bio: profileData.bio,
                        campus: profileData.campus,
                        major: profileData.major
                    };
                    localStorage.setItem('currentUser', JSON.stringify(updatedUser));

                    // Update UI
                    if (typeof updateProfileDisplay === 'function') {
                        if (window.appState) {
                            window.appState.currentUser = updatedUser;
                        }
                        updateProfileDisplay();
                    }

                    // Close edit mode
                    if (window.appState) {
                        window.appState.isEditingProfile = false;
                    }

                    showNotification('✨ Profile updated successfully!', 'success');

                    console.log('✅ Profile saved to backend');
                } catch (error) {
                    console.error('Failed to save profile:', error);
                    showNotification('Failed to update profile: ' + error.message, 'error');
                }
            };

            console.log('✅ Profile save function overridden with backend integration');
        }
    }, 1000);
});
