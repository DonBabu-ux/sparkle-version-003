// dataManager.js - Complete Data Management System
class DataManager {
    constructor() {
        this.storageKey = 'sparkleCampus';
        this.data = this.loadFromStorage();
        this.listeners = new Set();
        this.currentUser = null;
    }

    // Load data from localStorage
    loadFromStorage() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (e) {
            console.warn('Could not load saved data:', e);
        }

        // Default data structure
        return {
            users: [],
            posts: [],
            comments: [],
            messages: [],
            groups: [],
            confessions: [],
            notifications: [],
            events: []
        };
    }

    // Save data to localStorage
    saveToStorage() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.data));
        } catch (e) {
            console.warn('Could not save data:', e);
        }
        this.notifyListeners();
    }

    // Subscribe to data changes
    subscribe(callback) {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    // Notify all listeners
    notifyListeners() {
        this.listeners.forEach(callback => callback(this.data));
    }

    // ============ USER MANAGEMENT ============
    addUser(userData) {
        const newUser = {
            id: 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            ...userData,
            joined: new Date().toISOString(),
            isOnline: true,
            isNew: true,
            followers: [],
            following: [],
            posts: [],
            groups: [],
            notifications: []
        };

        this.data.users.push(newUser);
        this.saveToStorage();
        return newUser;
    }

    getUsers() {
        return [...this.data.users];
    }

    getNewUsers() {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return this.data.users.filter(user =>
            new Date(user.joined) > weekAgo || user.isNew
        );
    }

    getUserById(id) {
        return this.data.users.find(user => user.id === id);
    }

    setCurrentUser(user) {
        this.currentUser = user;
        if (user) {
            localStorage.setItem('currentUser', JSON.stringify(user));
        } else {
            localStorage.removeItem('currentUser');
        }
    }

    getCurrentUser() {
        if (!this.currentUser) {
            try {
                const saved = localStorage.getItem('currentUser');
                this.currentUser = saved ? JSON.parse(saved) : null;
            } catch (e) {
                this.currentUser = null;
            }
        }
        return this.currentUser;
    }

    // ============ POST MANAGEMENT ============
    createPost(postData) {
        const currentUser = this.getCurrentUser();
        if (!currentUser) return null;

        const newPost = {
            id: 'post_' + Date.now(),
            userId: currentUser.id,
            userName: currentUser.name,
            userAvatar: currentUser.avatar,
            ...postData,
            timestamp: new Date().toISOString(),
            likes: [],
            comments: [],
            shares: 0,
            tags: [],
            campus: currentUser.campus || 'General'
        };

        this.data.posts.unshift(newPost); // Add to beginning
        this.saveToStorage();
        return newPost;
    }

    getPosts() {
        return [...this.data.posts];
    }

    getPostsByUser(userId) {
        return this.data.posts.filter(post => post.userId === userId);
    }

    likePost(postId) {
        const post = this.data.posts.find(p => p.id === postId);
        const currentUser = this.getCurrentUser();

        if (post && currentUser) {
            const index = post.likes.indexOf(currentUser.id);
            if (index === -1) {
                post.likes.push(currentUser.id);
            } else {
                post.likes.splice(index, 1);
            }
            this.saveToStorage();
            return post.likes;
        }
        return null;
    }

    // ============ COMMENT MANAGEMENT ============
    addComment(postId, commentText) {
        const post = this.data.posts.find(p => p.id === postId);
        const currentUser = this.getCurrentUser();

        if (!post || !currentUser) return null;

        const newComment = {
            id: 'comment_' + Date.now(),
            postId,
            userId: currentUser.id,
            userName: currentUser.name,
            userAvatar: currentUser.avatar,
            text: commentText,
            timestamp: new Date().toISOString(),
            likes: []
        };

        post.comments.push(newComment);
        this.saveToStorage();
        return newComment;
    }

    // ============ MESSAGE MANAGEMENT ============
    startChat(userId1, userId2) {
        const chatId = [userId1, userId2].sort().join('_');
        let chat = this.data.messages.find(m => m.id === chatId);

        if (!chat) {
            chat = {
                id: chatId,
                participants: [userId1, userId2],
                messages: [],
                lastActivity: new Date().toISOString()
            };
            this.data.messages.push(chat);
            this.saveToStorage();
        }
        return chat;
    }

    sendMessage(chatId, text) {
        const chat = this.data.messages.find(m => m.id === chatId);
        const currentUser = this.getCurrentUser();

        if (!chat || !currentUser) return null;

        const message = {
            id: 'msg_' + Date.now(),
            senderId: currentUser.id,
            senderName: currentUser.name,
            text,
            timestamp: new Date().toISOString(),
            read: false
        };

        chat.messages.push(message);
        chat.lastActivity = new Date().toISOString();
        this.saveToStorage();
        return message;
    }

    getChatsForUser(userId) {
        return this.data.messages.filter(chat =>
            chat.participants.includes(userId)
        ).sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));
    }

    // ============ GROUP MANAGEMENT ============
    createGroup(groupData) {
        const currentUser = this.getCurrentUser();
        if (!currentUser) return null;

        const newGroup = {
            id: 'group_' + Date.now(),
            creatorId: currentUser.id,
            members: [currentUser.id],
            ...groupData,
            createdAt: new Date().toISOString(),
            messages: [],
            events: []
        };

        this.data.groups.push(newGroup);
        this.saveToStorage();
        return newGroup;
    }

    // ============ SEARCH ============
    searchUsers(query) {
        const searchTerm = query.toLowerCase();
        return this.data.users.filter(user =>
            user.name.toLowerCase().includes(searchTerm) ||
            user.username.toLowerCase().includes(searchTerm) ||
            user.campus.toLowerCase().includes(searchTerm) ||
            user.major?.toLowerCase().includes(searchTerm)
        );
    }

    searchPosts(query) {
        const searchTerm = query.toLowerCase();
        return this.data.posts.filter(post =>
            post.content.toLowerCase().includes(searchTerm) ||
            post.tags.some(tag => tag.toLowerCase().includes(searchTerm))
        );
    }

    // ============ UTILITIES ============
    markUserAsSeen(userId) {
        const user = this.getUserById(userId);
        if (user) {
            user.isNew = false;
            this.saveToStorage();
        }
    }

    clearAllData() {
        this.data = {
            users: [],
            posts: [],
            comments: [],
            messages: [],
            groups: [],
            confessions: [],
            notifications: [],
            events: []
        };
        this.saveToStorage();
    }

    // Generate mock data for testing
    generateMockData(count = 20) {
        const campuses = ['Stanford', 'MIT', 'Harvard', 'UC Berkeley', 'Yale', 'Princeton'];
        const majors = ['Computer Science', 'Business', 'Medicine', 'Engineering', 'Arts', 'Law'];
        const years = ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate'];

        // Add mock users
        for (let i = 0; i < count; i++) {
            this.addUser({
                name: `Student ${i + 1}`,
                username: `user${i + 1}`,
                email: `student${i + 1}@campus.edu`,
                avatar: `/uploads/avatars/default.png`,
                campus: campuses[i % campuses.length],
                major: majors[i % majors.length],
                year: years[i % years.length],
                bio: `Hey! I'm a ${years[i % years.length]} studying ${majors[i % majors.length]} at ${campuses[i % campuses.length]}.`,
                isOnline: Math.random() > 0.5
            });
        }

        // Add mock posts
        const users = this.getUsers();
        for (let i = 0; i < count; i++) {
            const user = users[i % users.length];
            this.createPost({
                content: `Hey campus! Just finished my ${['exam', 'project', 'paper', 'presentation'][i % 4]}. ${['Anyone want to study?', 'Looking for study buddies!', 'Coffee anyone?', 'What are your thoughts?'][i % 4]}`,
                media: i % 3 === 0 ? `https://picsum.photos/600/400?random=${i}` : null,
                tags: ['campuslife', 'study', 'college', 'university']
            });
        }

        console.log(`Generated ${count} mock users and posts`);
        return this.data;
    }
}

// Create and export singleton instance
const dataManager = new DataManager();
window.dataManager = dataManager;
// export default dataManager; - Removed to prevent SyntaxError in non-module environment
