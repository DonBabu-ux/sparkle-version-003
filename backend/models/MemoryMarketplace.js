// Simple in-memory data store for marketplace when database is unavailable
class MemoryMarketplace {
    constructor() {
        this.listings = [
            {
                listing_id: 'listing_1',
                seller_id: 'user_1',
                title: 'iPhone 12 Pro Max',
                description: 'Barely used iPhone 12 Pro Max in excellent condition. Comes with original box and accessories.',
                price: 45000,
                category: 'electronics',
                condition: 'like_new',
                campus: 'main_campus',
                location: 'Library Building, Room 101',
                is_sold: false,
                status: 'active',
                view_count: 25,
                created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
                seller_username: 'john_doe',
                seller_avatar: '/uploads/avatars/default.png',
                seller_rating: 4.8,
                seller_review_count: 12,
                is_favorited: false,
                image_urls: ['/images/mock-listing-1.jpg']
            },
            {
                listing_id: 'listing_2',
                seller_id: 'user_2',
                title: 'Calculus Textbook',
                description: 'Complete calculus textbook with highlighted notes. Perfect for math students.',
                price: 2500,
                category: 'books',
                condition: 'good',
                campus: 'main_campus',
                location: 'Engineering Block, Room 205',
                is_sold: false,
                status: 'active',
                view_count: 15,
                created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
                seller_username: 'sarah_math',
                seller_avatar: '/uploads/avatars/default.png',
                seller_rating: 4.9,
                seller_review_count: 8,
                is_favorited: false,
                image_urls: ['/images/mock-listing-2.jpg']
            },
            {
                listing_id: 'listing_3',
                seller_id: 'user_3',
                title: 'Math Tutoring Services',
                description: 'Professional math tutoring for all levels. Flexible scheduling available.',
                price: 1500,
                category: 'services',
                condition: 'new',
                campus: 'main_campus',
                location: 'Student Center',
                is_sold: false,
                status: 'active',
                view_count: 30,
                created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
                seller_username: 'math_expert',
                seller_avatar: '/uploads/avatars/default.png',
                seller_rating: 5.0,
                seller_review_count: 15,
                is_favorited: false,
                image_urls: ['/images/mock-listing-3.jpg']
            },
            {
                listing_id: 'listing_4',
                seller_id: 'user_4',
                title: 'Nike Air Max Sneakers',
                description: 'Comfortable Nike Air Max sneakers, size 10. Perfect for campus life.',
                price: 8500,
                category: 'clothing',
                condition: 'good',
                campus: 'west_campus',
                location: 'West Campus Gym',
                is_sold: false,
                status: 'active',
                view_count: 20,
                created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
                seller_username: 'sports_fan',
                seller_avatar: '/uploads/avatars/default.png',
                seller_rating: 4.5,
                seller_review_count: 6,
                is_favorited: false,
                image_urls: ['/images/mock-listing-4.jpg']
            },
            {
                listing_id: 'listing_5',
                seller_id: 'user_5',
                title: 'Study Desk',
                description: 'Solid wood study desk with drawers. Great for dorm rooms.',
                price: 12000,
                category: 'furniture',
                condition: 'good',
                campus: 'east_campus',
                location: 'East Campus Dorms',
                is_sold: false,
                status: 'active',
                view_count: 18,
                created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                seller_username: 'organizer',
                seller_avatar: '/uploads/avatars/default.png',
                seller_rating: 4.7,
                seller_review_count: 9,
                is_favorited: false,
                image_urls: ['/images/mock-listing-5.jpg']
            }
        ];

        this.favorites = new Set();
        this.viewCounts = new Map();
    }

    async getListings(filters = {}) {
        try {
            let filteredListings = [...this.listings];

            // Apply filters
            if (filters.category && filters.category !== 'all') {
                filteredListings = filteredListings.filter(l => l.category === filters.category);
            }

            if (filters.campus && filters.campus !== 'all') {
                filteredListings = filteredListings.filter(l => l.campus === filters.campus);
            }

            if (filters.minPrice) {
                filteredListings = filteredListings.filter(l => l.price >= parseFloat(filters.minPrice));
            }

            if (filters.maxPrice) {
                filteredListings = filteredListings.filter(l => l.price <= parseFloat(filters.maxPrice));
            }

            if (filters.condition && filters.condition !== 'all') {
                filteredListings = filteredListings.filter(l => l.condition === filters.condition);
            }

            if (filters.search) {
                const searchTerm = filters.search.toLowerCase();
                filteredListings = filteredListings.filter(l =>
                    l.title.toLowerCase().includes(searchTerm) ||
                    l.description.toLowerCase().includes(searchTerm)
                );
            }

            // Apply sorting
            const sortBy = filters.sort || 'newest';
            switch (sortBy) {
                case 'price_low':
                    filteredListings.sort((a, b) => a.price - b.price);
                    break;
                case 'price_high':
                    filteredListings.sort((a, b) => b.price - a.price);
                    break;
                case 'popular':
                    filteredListings.sort((a, b) => b.view_count - a.view_count);
                    break;
                case 'newest':
                default:
                    filteredListings.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                    break;
            }

            // Add favorited status
            if (filters.currentUserId) {
                filteredListings.forEach(listing => {
                    listing.is_favorited = this.favorites.has(`${filters.currentUserId}_${listing.listing_id}`);
                });
            }

            // Pagination
            const limit = Math.min(parseInt(filters.limit) || 20, 100);
            const offset = Math.max(parseInt(filters.offset) || 0, 0);
            const paginatedListings = filteredListings.slice(offset, offset + limit);

            return {
                listings: paginatedListings,
                total: filteredListings.length,
                limit,
                offset,
                hasMore: offset + limit < filteredListings.length
            };
        } catch (error) {
            console.error('Memory marketplace error:', error);
            return {
                listings: [],
                total: 0,
                limit: 20,
                offset: 0,
                hasMore: false
            };
        }
    }

    async getRecommendations(userId, campus = 'main_campus', limit = 6) {
        // Return a subset of listings as recommendations
        const availableListings = this.listings.filter(l => !l.is_sold);
        const recommendations = availableListings
            .sort((a, b) => b.view_count - a.view_count)
            .slice(0, limit);

        return recommendations;
    }

    async getCounts(userId) {
        return {
            favoritesCount: this.favorites.size,
            wishlistCount: 0,
            notificationCount: 0
        };
    }

    async toggleFavorite(userId, listingId) {
        const key = `${userId}_${listingId}`;
        const wasFavorited = this.favorites.has(key);

        if (wasFavorited) {
            this.favorites.delete(key);
            return { favorited: false };
        } else {
            this.favorites.add(key);
            return { favorited: true };
        }
    }
}

module.exports = new MemoryMarketplace();