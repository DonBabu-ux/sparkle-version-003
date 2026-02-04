// dashboardAPI.js - Dynamic Data Loading for Sparkle Dashboard
// This script replaces mock data with real API calls

const DashboardAPI = {
    // Base URL for the API
    baseUrl: '/api',
    token: localStorage.getItem('sparkleToken'),

    // Route tracking for debugging
    routeLog: [],

    logRoute(method, endpoint, status, duration, error = null) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            method,
            endpoint,
            fullUrl: `${this.baseUrl}${endpoint}`,
            status,
            duration: `${duration}ms`,
            error,
            hasToken: !!localStorage.getItem('sparkleToken')
        };
        this.routeLog.push(logEntry);

        // Keep only last 50 entries
        if (this.routeLog.length > 50) {
            this.routeLog.shift();
        }
    },

    getRouteLog() {
        console.table(this.routeLog);
        return this.routeLog;
    },

    getFailedRoutes() {
        const failed = this.routeLog.filter(r => r.status >= 400 || r.error);
        console.log(`\n🔥 FAILED ROUTES (${failed.length}):`);
        console.table(failed);
        return failed;
    },

    clearRouteLog() {
        this.routeLog = [];
        console.log('✅ Route log cleared');
    },

    async request(endpoint, options = {}) {
        const startTime = performance.now();
        const token = localStorage.getItem('sparkleToken');
        const method = options.method || 'GET';

        const headers = {
            ...options.headers
        };

        if (!(options.body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
        }

        if (token) {
            console.log(`🔑 Token found: ${token.substring(0, 10)}...`);
            headers['Authorization'] = `Bearer ${token}`;
        } else {
            console.warn('⚠️ No authentication token found');
        }

        const fullUrl = `${this.baseUrl}${endpoint}`;
        console.log(`\n📡 API REQUEST [${method}] ${fullUrl}`);
        console.log(`   Headers:`, headers);
        if (options.body) {
            console.log(`   Body:`, options.body);
        }

        try {
            const response = await fetch(fullUrl, {
                ...options,
                headers
            });

            const endTime = performance.now();
            const duration = (endTime - startTime).toFixed(2);

            // Log response status
            const statusEmoji = response.ok ? '✅' : '❌';
            console.log(`${statusEmoji} API RESPONSE [${response.status} ${response.statusText}] ${fullUrl}`);
            console.log(`   Duration: ${duration}ms`);

            // Try to parse JSON
            let data;
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
                console.log(`   Response Data:`, data);
            } else {
                const text = await response.text();
                console.log(`   Response Text:`, text);
                data = { error: 'Non-JSON response', text };
            }

            if (!response.ok) {
                // Auto-logout on 401
                if (response.status === 401) {
                    console.warn('Unauthorized! Clearing session and redirecting...');
                    localStorage.clear();
                    document.cookie = 'sparkleToken=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
                    window.location.href = '/login.html';
                    return; // Stop further processing and redirect
                }

                this.logRoute(method, endpoint, response.status, duration, data.error || 'Unknown error');

                console.error(`\n❌ REQUEST FAILED:`);
                console.error(`   URL: ${fullUrl}`);
                console.error(`   Status: ${response.status} ${response.statusText}`);
                console.error(`   Error: ${data.error || 'Unknown error'}`);
                console.error(`   Full Response:`, data);
                throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`);
            }

            this.logRoute(method, endpoint, response.status, duration);
            console.log(`✅ Request successful: ${endpoint}\n`);
            return data;
        } catch (error) {
            const endTime = performance.now();
            const duration = (endTime - startTime).toFixed(2);

            // Log the error
            this.logRoute(method, endpoint, 0, duration, error.message);

            console.error(`\n🔥 API ERROR:`);
            console.error(`   URL: ${fullUrl}`);
            console.error(`   Method: ${method}`);
            console.error(`   Duration: ${duration}ms`);
            console.error(`   Error Message: ${error.message}`);
            console.error(`   Error Stack:`, error.stack);
            console.error(`   Has Token: ${!!token}`);
            throw error;
        }
    },

    async updateProfile(profileData) {
        try {
            const result = await this.request('/users/profile', {
                method: 'PUT',
                body: JSON.stringify(profileData)
            });
            return result;
        } catch (error) {
            console.error('Failed to update profile:', error);
            throw error;
        }
    },

    async uploadAvatar(avatarData) {
        try {
            let options;
            if (avatarData instanceof File || (typeof Blob !== 'undefined' && avatarData instanceof Blob)) {
                const formData = new FormData();
                formData.append('avatar', avatarData);
                options = {
                    method: 'POST',
                    body: formData
                };
            } else {
                options = {
                    method: 'POST',
                    body: JSON.stringify({
                        avatar_url: avatarData
                    })
                };
            }

            const result = await this.request('/users/avatar', options);
            return result;
        } catch (error) {
            console.error('Failed to upload avatar:', error);
            throw error;
        }
    },

    async changePassword(currentPassword, newPassword) {
        try {
            const result = await this.request('/users/password', {
                method: 'PUT',
                body: JSON.stringify({ currentPassword, newPassword })
            });
            return result;
        } catch (error) {
            console.error('Failed to change password:', error);
            throw error;
        }
    },

    async updateSettings(settingsData) {
        try {
            const result = await this.request('/users/settings', {
                method: 'PUT',
                body: JSON.stringify(settingsData)
            });
            return result;
        } catch (error) {
            console.error('Failed to update settings:', error);
            throw error;
        }
    },

    async blockUser(userId) {
        try {
            return await this.request(`/users/${userId}/block`, { method: 'POST' });
        } catch (error) {
            console.error(`Failed to block user ${userId}:`, error);
            throw error;
        }
    },

    async unblockUser(userId) {
        try {
            return await this.request(`/users/${userId}/block`, { method: 'DELETE' });
        } catch (error) {
            console.error(`Failed to unblock user ${userId}:`, error);
            throw error;
        }
    },

    async muteUser(userId) {
        try {
            return await this.request(`/users/${userId}/mute`, { method: 'POST' });
        } catch (error) {
            console.error(`Failed to mute user ${userId}:`, error);
            throw error;
        }
    },

    async unmuteUser(userId) {
        try {
            return await this.request(`/users/${userId}/mute`, { method: 'DELETE' });
        } catch (error) {
            console.error(`Failed to unmute user ${userId}:`, error);
            throw error;
        }
    },

    async reportUser(userId, reason) {
        try {
            return await this.request(`/users/${userId}/report`, {
                method: 'POST',
                body: JSON.stringify({ reason })
            });
        } catch (error) {
            console.error(`Failed to report user ${userId}:`, error);
            throw error;
        }
    },

    async loadNotifications() {
        try {
            const notifications = await this.request('/notifications');
            return notifications;
        } catch (error) {
            console.error('Failed to load notifications:', error);
            return [];
        }
    },

    // ============ COMMENTS ============
    async loadComments(postId) {
        try {
            const comments = await this.request(`/posts/${postId}/comments`);
            return comments.map(comment => ({
                id: comment.comment_id,
                user: comment.username,
                avatar: comment.avatar_url || '/uploads/avatars/default.png',
                text: comment.content,
                timestamp: this.formatTimestamp(comment.created_at)
            }));
        } catch (error) {
            console.error('Failed to load comments:', error);
            return [];
        }
    },

    async postComment(postId, text) {
        try {
            const result = await this.request(`/posts/${postId}/comments`, {
                method: 'POST',
                body: JSON.stringify({ content: text })
            });
            return result;
        } catch (error) {
            console.error('Failed to post comment:', error);
            throw error;
        }
    },

    async deleteComment(commentId) {
        try {
            const result = await this.request(`/comments/${commentId}`, {
                method: 'DELETE'
            });
            return result;
        } catch (error) {
            console.error('Failed to delete comment:', error);
            throw error;
        }
    },

    // ============ FEED & POSTS ============
    async loadFeed() {
        try {
            console.log('📡 DashboardAPI: Loading feed posts...');
            const posts = await this.request('/posts/feed');

            if (!posts || !Array.isArray(posts)) {
                console.warn('⚠️ DashboardAPI: Feed API did not return an array:', posts);
                return [];
            }

            return posts.map(post => {
                try {
                    // Helper to ensure correct media URL
                    const ensureUrl = (url) => {
                        if (!url) return null;
                        if (url.startsWith('http') || url.startsWith('/')) return url;
                        return `/uploads/${url}`;
                    };

                    const avatarUrl = ensureUrl(post.avatar_url || post.avatar) || '/uploads/avatars/default.png';
                    const mediaUrl = ensureUrl(post.media_url || post.media);

                    // Provide both new and legacy property names for maximum compatibility
                    return {
                        id: post.post_id || post.id,
                        post_id: post.post_id || post.id, // Legacy support
                        userId: post.user_id || post.userId,
                        user_id: post.user_id || post.userId, // Legacy support
                        username: post.username || 'unknown',
                        name: post.user_name || post.name || post.username || 'Sparkler',
                        user_name: post.user_name || post.name || post.username || 'Sparkler', // Legacy support
                        avatar: avatarUrl,
                        avatar_url: avatarUrl, // Legacy support
                        campus: post.campus || 'Campus',
                        media: mediaUrl,
                        media_url: mediaUrl, // Legacy support
                        caption: post.content || post.caption || '',
                        content: post.content || post.caption || '', // Legacy support
                        timestamp_raw: post.created_at || post.timestamp, // Original date
                        timestamp: this.formatTimestamp(post.timestamp || post.created_at),
                        sparks: parseInt(post.sparks || post.spark_count || 0),
                        comments: parseInt(post.comments || post.comment_count || 0),
                        isLiked: !!(post.is_liked || post.isLiked),
                        is_liked: !!(post.is_liked || post.isLiked), // Legacy support
                        isSaved: !!(post.is_saved || post.isSaved),
                        is_saved: !!(post.is_saved || post.isSaved), // Legacy support
                        isAnonymous: post.post_type === 'anonymous' || post.isAnonymous || false,
                        type: post.post_type || 'public',
                        tags: post.tags || []
                    };
                } catch (mapError) {
                    console.error('❌ DashboardAPI: Error mapping post:', post, mapError);
                    return null;
                }
            }).filter(p => p !== null);
        } catch (error) {
            console.error('❌ DashboardAPI: Failed to load feed:', error);
            // Return empty array instead of throwing to prevent UI crash
            return [];
        }
    },

    async createPost(postData) {
        try {
            let options;
            const hasFile = postData.media instanceof File;

            if (hasFile) {
                const formData = new FormData();
                formData.append('content', postData.caption || postData.content);
                formData.append('media', postData.media);
                formData.append('post_type', postData.postType || postData.post_type || (postData.isAnonymous ? 'anonymous' : 'public'));
                formData.append('campus', postData.campus || localStorage.getItem('sparkleUserCampus') || 'Sparkle Central');
                options = { method: 'POST', body: formData };
            } else {
                options = {
                    method: 'POST',
                    body: JSON.stringify({
                        content: postData.caption || postData.content,
                        media_url: postData.media || postData.media_url || null,
                        post_type: postData.postType || postData.post_type || (postData.isAnonymous ? 'anonymous' : 'public'),
                        campus: postData.campus || localStorage.getItem('sparkleUserCampus') || 'Sparkle Central'
                    })
                };
            }
            return await this.request('/posts', options);
        } catch (error) {
            console.error('Failed to create post:', error);
            throw error;
        }
    },

    async sparkPost(postId) {
        try {
            const result = await this.request(`/posts/${postId}/spark`, {
                method: 'POST'
            });
            return result;
        } catch (error) {
            console.error('Failed to spark post:', error);
            throw error;
        }
    },

    async savePost(postId) {
        try {
            const result = await this.request(`/posts/${postId}/save`, {
                method: 'POST'
            });
            return result;
        } catch (error) {
            console.error('Failed to save post:', error);
            throw error;
        }
    },

    async sharePost(postId) {
        try {
            const result = await this.request(`/posts/${postId}/share`, {
                method: 'POST'
            });
            return result;
        } catch (error) {
            console.error('Failed to share post:', error);
            throw error;
        }
    },

    async loadComments(postId) {
        try {
            const comments = await this.request(`/posts/${postId}/comments`);
            return comments;
        } catch (error) {
            console.error('Failed to load comments:', error);
            return [];
        }
    },

    async addComment(postId, content) {
        try {
            const result = await this.request(`/posts/${postId}/comments`, {
                method: 'POST',
                body: JSON.stringify({ content })
            });
            return result;
        } catch (error) {
            console.error('Failed to add comment:', error);
            throw error;
        }
    },

    async deletePost(postId) {
        try {
            const result = await this.request(`/posts/${postId}`, {
                method: 'DELETE'
            });
            return result;
        } catch (error) {
            console.error('Failed to delete post:', error);
            throw error;
        }
    },

    ensureUrl(url) {
        if (!url) return null;
        if (url.startsWith('http') || url.startsWith('/')) return url;
        // If it already starts with uploads/, just make it absolute
        if (url.startsWith('uploads/')) return '/' + url;
        // Normalizing backslashes for Windows if any
        let normalizedUrl = url.replace(/\\/g, '/');
        if (normalizedUrl.startsWith('uploads/')) return '/' + normalizedUrl;
        return `/uploads/${normalizedUrl}`;
    },

    // ============ STORIES (AFTERGLOW) ============
    async loadStories() {
        try {
            const stories = await this.request('/stories/active');
            return stories.map(story => ({
                id: story.story_id,
                story_id: story.story_id,
                userId: story.user_id,
                user_id: story.user_id,
                username: story.username,
                name: story.username,
                avatar: this.ensureUrl(story.avatar_url) || '/uploads/avatars/default.png',
                avatar_url: this.ensureUrl(story.avatar_url) || '/uploads/avatars/default.png',
                campus: story.campus || 'Campus',
                media: this.ensureUrl(story.media_url),
                media_url: this.ensureUrl(story.media_url),
                caption: story.caption || '',
                secondsLeft: story.seconds_left,
                timestamp: this.formatTimestamp(story.created_at || story.sent_at),
                created_at: story.created_at || story.sent_at,
                isViewed: false
            }));
        } catch (error) {
            console.error('Failed to load stories:', error);
            return [];
        }
    },

    async createStory(storyData) {
        try {
            let options;
            const hasFile = storyData.media instanceof File || storyData.media_url instanceof File;

            if (hasFile) {
                const formData = new FormData();
                formData.append('caption', storyData.caption || '');
                formData.append('media', storyData.media || storyData.media_url);
                options = { method: 'POST', body: formData };
            } else {
                options = {
                    method: 'POST',
                    body: JSON.stringify({
                        media_url: storyData.media || storyData.media_url,
                        caption: storyData.caption || ''
                    })
                };
            }
            return await this.request('/stories', options);
        } catch (error) {
            console.error('Failed to create story:', error);
            throw error;
        }
    },

    // ============ MOMENTS ============
    async loadMoments() {
        try {
            const moments = await this.request('/moments/stream');
            return moments.map(moment => ({
                id: moment.moment_id,
                userId: moment.user_id,
                username: moment.username,
                name: moment.user_name || moment.username,
                avatar: this.ensureUrl(moment.avatar_url) || '/uploads/avatars/default.png',
                video: this.ensureUrl(moment.video_url),
                caption: moment.caption || '',
                campus: moment.campus || 'Campus',
                likes: moment.likes || 0,
                comments: moment.comments || 0
            }));
        } catch (error) {
            console.error('Failed to load moments:', error);
            return [];
        }
    },

    async loadUserMoments(userId) {
        try {
            const moments = await this.request(`/users/${userId}/moments`);
            return moments.map(moment => ({
                id: moment.moment_id,
                userId: moment.user_id,
                username: moment.username || 'User', // May not be joined, but list is for specific user
                name: moment.username || 'User',
                avatar: this.ensureUrl(moment.avatar_url) || '/uploads/avatars/default.png',
                video: this.ensureUrl(moment.video_url),
                caption: moment.caption || '',
                campus: moment.campus || 'Campus',
                likes: 0,
                comments: 0
            }));
        } catch (error) {
            console.error('Failed to load user moments:', error);
            return [];
        }
    },

    async createMoment(momentData) {
        try {
            let options;
            const hasFile = momentData.video instanceof File || momentData.video_url instanceof File;

            if (hasFile) {
                const formData = new FormData();
                formData.append('caption', momentData.caption || '');
                formData.append('media', momentData.video || momentData.video_url); // backend uses 'media' field
                options = { method: 'POST', body: formData };
            } else {
                // Support legacy string arguments if needed
                if (typeof momentData === 'string') {
                    const [caption, videoUrl, thumbnailUrl] = arguments;
                    options = {
                        method: 'POST',
                        body: JSON.stringify({ caption, video_url: videoUrl, thumbnail_url: thumbnailUrl })
                    };
                } else {
                    options = {
                        method: 'POST',
                        body: JSON.stringify({
                            caption: momentData.caption,
                            video_url: momentData.video || momentData.video_url,
                            thumbnail_url: momentData.thumbnail || momentData.thumbnail_url || null
                        })
                    };
                }
            }
            return await this.request('/moments', options);
        } catch (error) {
            console.error('Failed to create moment:', error);
            throw error;
        }
    },

    // Media Upload
    async uploadMedia(file) {
        const formData = new FormData();
        formData.append('media', file);
        const token = localStorage.getItem('sparkleToken');

        const response = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });
        if (!response.ok) throw new Error('Upload failed');
        return response.json();
    },

    // ============ LOST & FOUND ============
    async reportLostFoundItem(itemData) {
        return this.request('/lost-found/items', {
            method: 'POST',
            body: JSON.stringify(itemData)
        });
    },

    async loadLostFoundItems(type, campus) {
        const params = new URLSearchParams();
        if (type && type !== 'all') params.append('type', type);
        if (campus) params.append('campus', campus);
        const items = await this.request(`/lost-found/items?${params.toString()}`);
        return items.map(item => ({
            ...item,
            id: item.item_id,
            title: item.title || item.item_name,
            type: item.type || item.status
        }));
    },

    async claimLostFoundItem(itemId) {
        return this.request(`/lost-found/${itemId}/claim`, {
            method: 'PUT'
        });
    },

    // ============ SKILL MARKETPLACE ============
    async createSkillOffer(offerData) {
        return this.request('/skills/offers', {
            method: 'POST',
            body: JSON.stringify({
                skill_type: offerData.skill_type,
                title: offerData.title,
                description: offerData.description,
                subjects: offerData.subjects || [],
                price_type: offerData.price_type,
                price: offerData.price || 0,
                availability: offerData.availability || {},
                campus: offerData.campus || 'Campus'
            })
        });
    },

    async loadSkillOffers(type, campus) {
        const params = new URLSearchParams();
        if (type && type !== 'all') params.append('type', type);
        if (campus) params.append('campus', campus);
        const offers = await this.request(`/skills/offers?${params.toString()}`);
        return offers.map(offer => ({
            ...offer,
            id: offer.offer_id,
            type: offer.skill_type
        }));
    },

    async requestSkill(offerId, message) {
        return this.request(`/skills/${offerId}/request`, {
            method: 'POST',
            body: JSON.stringify({ message })
        });
    },

    // ============ POLLS ============
    async createPoll(pollData) {
        return this.request('/polls', {
            method: 'POST',
            body: JSON.stringify({
                question: pollData.question,
                options: pollData.options,
                campus: pollData.campus,
                category: pollData.category || 'general',
                is_anonymous: pollData.is_anonymous || false,
                expires_at: pollData.expires_at || null
            })
        });
    },

    async loadPolls(campus) {
        const params = campus ? `?campus=${campus}` : '';
        return this.request(`/polls${params}`);
    },

    async votePoll(pollId, optionId) {
        return this.request(`/polls/${pollId}/vote`, {
            method: 'POST',
            body: JSON.stringify({ option_id: optionId })
        });
    },

    async getPollResults(pollId) {
        return this.request(`/polls/${pollId}/results`);
    },

    // ============ CAMPUS EVENTS ============
    async createEvent(eventData) {
        return this.request('/events', {
            method: 'POST',
            body: JSON.stringify({
                title: eventData.title,
                description: eventData.description,
                event_type: eventData.event_type || 'meetup',
                location: eventData.location,
                campus: eventData.campus || 'Campus',
                start_time: eventData.start_time,
                end_time: eventData.end_time || null,
                image_url: eventData.image_url || null,
                max_attendees: eventData.max_attendees || 0,
                is_public: eventData.is_public !== false
            })
        });
    },

    async loadEvents(campus) {
        const params = campus ? `?campus=${campus}` : '';
        return this.request(`/events${params}`);
    },

    async rsvpEvent(eventId, status) {
        return this.request(`/events/${eventId}/rsvp`, {
            method: 'POST',
            body: JSON.stringify({ status })
        });
    },

    async getEventAttendees(eventId) {
        return this.request(`/events/${eventId}/attendees`);
    },

    // ============ LIVE STREAMING ============
    async startStream(streamData) {
        return this.request('/streams/start', {
            method: 'POST',
            body: JSON.stringify({
                title: streamData.title,
                description: streamData.description,
                stream_url: streamData.stream_url,
                thumbnail_url: streamData.thumbnail_url || null,
                campus: streamData.campus || 'Campus',
                category: streamData.category || 'other'
            })
        });
    },

    async loadActiveStreams(campus) {
        const params = campus ? `?campus=${campus}` : '';
        const streams = await this.request(`/streams/active${params}`);
        return streams.map(stream => ({
            ...stream,
            thumbnail_url: this.ensureUrl(stream.thumbnail_url),
            avatar_url: this.ensureUrl(stream.avatar_url) || '/uploads/avatars/default.png'
        }));
    },

    async joinStream(streamId) {
        return this.request(`/streams/${streamId}/join`, {
            method: 'POST'
        });
    },

    async endStream(streamId) {
        return this.request(`/streams/${streamId}/end`, {
            method: 'POST'
        });
    },

    // ============ GROUPS ============
    async loadGroups(campus) {
        try {
            const params = campus ? `?campus=${campus}` : '';
            const groups = await this.request(`/groups/campus${params}`);
            return groups.map(group => ({
                ...group,
                id: group.group_id || group.id,
                icon_url: this.ensureUrl(group.icon_url)
            }));
        } catch (error) {
            console.error('Failed to load groups:', error);
            return [];
        }
    },

    async createGroup(groupData) {
        try {
            const result = await this.request('/groups', {
                method: 'POST',
                body: JSON.stringify({
                    name: groupData.name,
                    description: groupData.description,
                    category: groupData.category || 'general',
                    icon_url: groupData.icon_url || null,
                    campus: groupData.campus || localStorage.getItem('sparkleUserCampus') || JSON.parse(localStorage.getItem('sparkleUser') || '{}').campus || 'Sparkle Central'
                })
            });
            return result;
        } catch (error) {
            console.error('Failed to create group:', error);
            throw error;
        }
    },

    async joinGroup(groupId) {
        try {
            const result = await this.request(`/groups/${groupId}/join`, {
                method: 'POST'
            });
            return result;
        } catch (error) {
            console.error('Failed to join group:', error);
            throw error;
        }
    },

    // ============ CLUBS ============
    async createClub(clubData) {
        try {
            const options = { method: 'POST' };
            if (clubData instanceof FormData) {
                options.body = clubData;
            } else {
                options.body = JSON.stringify(clubData);
                options.headers = { 'Content-Type': 'application/json' };
            }
            return await this.request('/clubs', options);
        } catch (error) {
            console.error('Failed to create club:', error);
            throw error;
        }
    },

    async updateClub(clubId, clubData) {
        try {
            const options = {
                method: 'PUT'
            };

            if (clubData instanceof FormData) {
                options.body = clubData;
                // Don't set Content-Type, browser will set it with boundary
            } else {
                options.body = JSON.stringify(clubData);
                options.headers = { 'Content-Type': 'application/json' };
            }

            const result = await this.request(`/clubs/${clubId}`, options);
            return result;
        } catch (error) {
            console.error('Failed to update club:', error);
            throw error;
        }
    },

    async joinClub(clubId) {
        try {
            return await this.request(`/clubs/${clubId}/join`, { method: 'POST' });
        } catch (error) {
            console.error('Failed to join club:', error);
            throw error;
        }
    },

    async leaveClub(clubId) {
        try {
            return await this.request(`/clubs/${clubId}/leave`, { method: 'POST' });
        } catch (error) {
            console.error('Failed to leave club:', error);
            throw error;
        }
    },

    // ============ CONFESSIONS ============
    async loadConfessions(campus) {
        try {
            const params = campus ? `?campus=${campus}` : '';
            const confessions = await this.request(`/confessions/best${params}`);
            return confessions.map(conf => ({
                ...conf,
                id: conf.confession_id,
                text: conf.content,
                reactions: conf.rating_count || 0,
                timestamp: this.formatTimestamp(conf.created_at)
            }));
        } catch (error) {
            console.error('Failed to load confessions:', error);
            // Fallback for demo
            return [
                { content: 'Confessions API failed, showing sample.', text: 'Confessions API failed, showing sample.', campus: 'System', rating_count: 0, reactions: 0 }
            ];
        }
    },

    async postConfession(content, campus) {
        return this.request('/confessions', {
            method: 'POST',
            body: JSON.stringify({
                content: content,
                campus: campus || 'General'
            })
        });
    },

    // ============ USERS ============
    async loadUserProfile(userId) {
        try {
            const user = await this.request(`/users/${userId}`);
            const avatarUrl = this.ensureUrl(user.avatar_url) || '/uploads/avatars/default.png';
            return {
                ...user,
                id: user.user_id,
                avatar: avatarUrl,
                avatar_url: avatarUrl // Both for compatibility
            };
        } catch (error) {
            console.error(`Failed to load user profile (${userId}):`, error);
            throw error;
        }
    },

    async loadUserPosts(userId) {
        try {
            const posts = await this.request(`/users/${userId}/posts`);
            return posts.map(post => {
                const avatarUrl = this.ensureUrl(post.avatar_url) || '/uploads/avatars/default.png';
                const mediaUrl = this.ensureUrl(post.media_url);
                return {
                    id: post.post_id,
                    postId: post.post_id,
                    userId: post.user_id,
                    username: post.username,
                    user_name: post.user_name || post.username,
                    avatar: avatarUrl,
                    avatar_url: avatarUrl,
                    campus: post.campus,
                    content: post.content,
                    media: mediaUrl,
                    media_url: mediaUrl,
                    tags: post.tags,
                    sparks: post.sparks || 0,
                    comments: post.comment_count || 0,
                    timestamp: post.created_at,
                    is_liked: !!post.is_liked,
                    is_saved: !!post.is_saved
                };
            });
        } catch (error) {
            console.error(`Failed to load user posts (${userId}):`, error);
            return [];
        }
    },

    async loadFollowers(userId) {
        try {
            const followers = await this.request(`/users/${userId}/followers`);
            return followers.map(u => {
                const avatarUrl = this.ensureUrl(u.avatar_url) || '/uploads/avatars/default.png';
                return {
                    id: u.user_id,
                    user_id: u.user_id,
                    name: u.name,
                    username: u.username,
                    avatar: avatarUrl,
                    avatar_url: avatarUrl,
                    campus: u.campus
                };
            });
        } catch (error) {
            console.error(`Failed to load followers for ${userId}:`, error);
            return [];
        }
    },

    async loadFollowing(userId) {
        try {
            const following = await this.request(`/users/${userId}/following`);
            return following.map(u => {
                const avatarUrl = this.ensureUrl(u.avatar_url) || '/uploads/avatars/default.png';
                return {
                    id: u.user_id,
                    user_id: u.user_id,
                    name: u.name,
                    username: u.username,
                    avatar: avatarUrl,
                    avatar_url: avatarUrl,
                    campus: u.campus
                };
            });
        } catch (error) {
            console.error(`Failed to load following for ${userId}:`, error);
            return [];
        }
    },

    async searchUsers(query, filters = {}) {
        try {
            const params = new URLSearchParams();
            if (query) params.append('q', query);
            if (filters.campus && filters.campus !== 'all') params.append('campus', filters.campus);
            if (filters.major && filters.major !== 'all') params.append('major', filters.major);
            if (filters.year && filters.year !== 'all') params.append('year', filters.year);

            const url = `/users/search?${params.toString()}`;
            const users = await this.request(url);
            return users.map(user => {
                const avatarUrl = this.ensureUrl(user.avatar_url) || '/uploads/avatars/default.png';
                return {
                    id: user.user_id,
                    user_id: user.user_id,
                    name: user.name,
                    username: user.username,
                    avatar: avatarUrl,
                    avatar_url: avatarUrl,
                    campus: user.campus,
                    bio: user.bio || '',
                    year: user.year_of_study || 'Student',
                    isOnline: !!user.is_online,
                    major: user.major || 'Undeclared',
                    mutualConnections: 0,
                    isConnected: !!user.is_followed
                };
            });
        } catch (error) {
            console.error('Failed to search users:', error);
            return [];
        }
    },

    async followUser(userId) {
        try {
            const result = await this.request(`/users/follow/${userId}`, {
                method: 'POST'
            });
            return result;
        } catch (error) {
            console.error('Failed to follow user:', error);
            throw error;
        }
    },

    async unfollowUser(userId) {
        try {
            const result = await this.request(`/users/follow/${userId}`, {
                method: 'DELETE'
            });
            return result;
        } catch (error) {
            console.error('Failed to unfollow user:', error);
            throw error;
        }
    },

    // ============ MARKETPLACE ============
    async loadMarketplace(category = null, campus = null) {
        try {
            const params = new URLSearchParams();
            if (category && category !== 'all') params.append('category', category);
            if (campus && campus !== 'all') params.append('campus', campus);

            const queryString = params.toString() ? `?${params.toString()}` : '';
            const endpoint = `/market/listings${queryString}`;
            const listings = await this.request(endpoint);
            return listings.map(listing => ({
                id: listing.listing_id,
                title: listing.title,
                description: listing.description,
                price: listing.price,
                category: listing.category,
                campus: listing.campus,
                seller: listing.seller_username || 'Student',
                sellerId: listing.seller_id,
                images: listing.image_urls || ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80'],
                timestamp: this.formatTimestamp(listing.created_at || listing.timestamp),
                isSold: listing.is_sold
            }));
        } catch (error) {
            console.error('Failed to load marketplace:', error);
            return [];
        }
    },

    async createListing(listingData) {
        try {
            const result = await this.request('/market/listings', {
                method: 'POST',
                body: JSON.stringify({
                    title: listingData.title,
                    description: listingData.description,
                    price: listingData.price,
                    category: listingData.category,
                    campus: listingData.campus || 'Campus',
                    image_urls: listingData.images || []
                })
            });
            return result;
        } catch (error) {
            console.error('Failed to create listing:', error);
            throw error;
        }
    },

    async markListingAsSold(listingId) {
        try {
            const result = await this.request(`/market/${listingId}/sold`, {
                method: 'PUT'
            });
            return result;
        } catch (error) {
            console.error(`Failed to mark listing ${listingId} as sold:`, error);
            throw error;
        }
    },

    // ============ MESSAGING ============
    async loadChats() {
        try {
            const chats = await this.request('/messages/chats');
            return chats;
        } catch (error) {
            console.error('Failed to load chats:', error);
            return [];
        }
    },

    async sendMessage(messageData) {
        try {
            const result = await this.request('/messages', {
                method: 'POST',
                body: JSON.stringify(messageData)
            });
            return result;
        } catch (error) {
            console.error('Failed to send message:', error);
            throw error;
        }
    },

    async loadChatHistory(sessionId) {
        try {
            const messages = await this.request(`/messages/${sessionId}`);
            return messages.map(msg => {
                const avatarUrl = this.ensureUrl(msg.sender_avatar) || '/uploads/avatars/default.png';
                return {
                    id: msg.message_id,
                    senderId: msg.sender_id,
                    senderName: msg.sender_name,
                    senderUsername: msg.sender_username,
                    senderAvatar: avatarUrl,
                    avatar_url: avatarUrl, // Compatibility
                    text: msg.content,
                    timestamp: this.formatTimestamp(msg.created_at)
                };
            });
        } catch (error) {
            console.error(`Failed to load chat history (${sessionId}):`, error);
            return [];
        }
    },

    // ============ UTILITIES ============
    formatTimestamp(timestamp) {
        if (!timestamp) return 'Just now';

        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;

        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (seconds < 60) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;

        return date.toLocaleDateString();
    }
};

// Make it globally available
window.DashboardAPI = DashboardAPI;
