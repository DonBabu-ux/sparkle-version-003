// Marketplace Enhancements - Phase 3 UI/UX Features
// Advanced Filters, View Toggle, Multi-Step Wizard, Enhanced Listings

const MarketplaceEnhancements = {
    // State management
    state: {
        viewMode: localStorage.getItem('marketplaceView') || 'grid',
        tab: 'all',
        filters: {
            minPrice: 0,
            maxPrice: 10000,
            categories: [],
            conditions: [],
            searchQuery: '',
            sortBy: 'newest'
        },
        wizardStep: 1,
        wizardData: {
            photos: [],
            title: '',
            category: '',
            condition: '',
            price: '',
            isNegotiable: false,
            description: '',
            location: '',
            meetupLocation: ''
        },
        currentChatId: null,
    },

    // DOM elements
    elements: {
        listingsContainer: document.getElementById('listingsGrid'),
        viewToggle: document.querySelector('.mp-view-toggle'),
        sortSelect: document.getElementById('sortFilter'),
        searchBlur: document.getElementById('searchInput'),
        recommendedList: document.getElementById('recommendedList'),
        chatModal: document.getElementById('chatModal'),
        chatMessages: document.getElementById('chatMessages'),
        chatInput: document.getElementById('chatInput')
    },

    // Initialize all features
    init() {
        this.initWizard();
        this.applyFilters();
        this.setupKeyboardEvents();
        
        // Expose to window for inline calls
        window.MarketplaceEnhancements = this;
        window.openQuickView = (id) => this.openQuickView(id);
        window.closeQuickView = () => this.closeQuickView();
        window.openCreateModal = () => {
            this.state.wizardStep = 1;
            this.updateWizardStep();
            if (typeof openModal === 'function') openModal('createListingWizard');
        };
        window.closeChat = () => this.closeChat();
        window.sendMessage = () => this.sendMessage();
        window.toggleFavorite = (id, e) => this.toggleFavorite(id, e?.currentTarget || e);
        window.messageSeller = (sid, lid, e) => {
            if (e) e.stopPropagation();
            this.messageSeller(lid, sid);
        };
        window.loadMore = () => this.loadMore();

        this.initViewToggle();
        this.initFilters();
        this.initEnhancedListings();
        this.loadSafeMeetupLocations();
    },

    // ========== VIEW TOGGLE ==========
    initViewToggle() {
        const viewToggle = document.querySelector('.view-toggle');
        if (!viewToggle) return;

        const gridBtn = viewToggle.querySelector('[data-view="grid"]');
        const listBtn = viewToggle.querySelector('[data-view="list"]');
        const listingsContainer = document.querySelector('.mp-listings-grid');

        // Set initial view
        this.setView(this.state.viewMode);

        gridBtn?.addEventListener('click', () => this.setView('grid'));
        listBtn?.addEventListener('click', () => this.setView('list'));
    },

    setView(mode) {
        this.state.viewMode = mode;
        localStorage.setItem('marketplaceView', mode);

        const listingsContainer = document.querySelector('.mp-listings-grid');
        const gridBtn = document.querySelector('[data-view="grid"]');
        const listBtn = document.querySelector('[data-view="list"]');

        if (mode === 'grid') {
            listingsContainer?.classList.remove('list-view');
            listingsContainer?.classList.add('grid-view');
            gridBtn?.classList.add('active');
            listBtn?.classList.remove('active');
        } else {
            listingsContainer?.classList.remove('grid-view');
            listingsContainer?.classList.add('list-view');
            listBtn?.classList.add('active');
            gridBtn?.classList.remove('active');
        }
    },

    async openQuickView(listingId) {
        if (!listingId) return;
        try {
            const data = await DashboardAPI.request(`/marketplace/listings/${listingId}`);
            if (data.success) {
                this.renderQuickView(data.listing);
                if (typeof openModal === 'function') openModal('quickViewModal');
            }
        } catch (error) {
            console.error('Quick view error:', error);
        }
    },

    renderQuickView(listing) {
        const content = document.getElementById('quickViewContent');
        if (!content) return;

        content.innerHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px;">
                <div class="quick-view-media">
                    <img src="${listing.image_url || '/images/default-listing.jpg'}" 
                         style="width: 100%; height: 400px; object-fit: cover; border-radius: 20px;">
                </div>
                <div class="quick-view-info">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <h2 style="margin: 0 0 10px 0;">${escapeHtml(listing.title)}</h2>
                        <div class="mp-card-badge" style="position: static; font-size: 20px;">$${parseFloat(listing.price).toFixed(2)}</div>
                    </div>
                    <p style="color: var(--fb-text-secondary); margin-bottom: 20px;">${escapeHtml(listing.description || 'No description provided')}</p>
                    
                    <div style="display: flex; gap: 15px; margin-bottom: 25px;">
                        <span class="mp-chip">${listing.condition.replace('_', ' ')}</span>
                        <span class="mp-chip">${listing.category}</span>
                    </div>

                    <div style="background: #fdf2f8; padding: 20px; border-radius: 20px; margin-bottom: 25px;">
                        <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 10px;">
                            <div class="mp-seller-avatar" style="width: 45px; height: 45px;">
                                <img src="${listing.seller_avatar || '/images/default-avatar.png'}">
                            </div>
                            <div>
                                <div style="font-weight: 800;">${listing.seller_username}</div>
                                <div style="font-size: 11px; color: #ffbc00;">★★★★★</div>
                            </div>
                        </div>
                        <div style="font-size: 13px; color: var(--fb-text-secondary);">
                            <i class="fas fa-map-marker-alt"></i> ${listing.campus || 'Main Campus'}
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                        <button class="mp-btn mp-btn-primary" onclick="window.messageSeller('${listing.seller_id}', '${listing.listing_id}')">
                            <i class="fas fa-comment"></i> Chat with Seller
                        </button>
                        <button class="mp-btn mp-btn-secondary" onclick="window.toggleFavorite('${listing.listing_id}', this)">
                            <i class="fas fa-heart"></i> Favorite
                        </button>
                    </div>
                </div>
            </div>
        `;
    },

    closeQuickView() {
        if (typeof closeAllModals === 'function') closeAllModals();
    },

    async loadMore() {
        if (this.state.loading || !this.state.hasMore) return;
        this.state.page++;
        this.applyFilters(true);
    },

    updateLoadMoreButton() {
        const container = document.getElementById('loadMoreContainer');
        if (container) {
            container.style.display = this.state.hasMore ? 'block' : 'none';
        }
    },

    // ========== ADVANCED FILTERS ==========
    initFilters() {
        const filterSidebar = document.querySelector('.filter-sidebar');
        if (!filterSidebar) return;

        // Price range
        const minPriceInput = document.getElementById('minPrice');
        const maxPriceInput = document.getElementById('maxPrice');
        const minPriceDisplay = document.getElementById('minPriceDisplay');
        const maxPriceDisplay = document.getElementById('maxPriceDisplay');

        minPriceInput?.addEventListener('input', (e) => {
            this.state.filters.minPrice = e.target.value;
            if (minPriceDisplay) minPriceDisplay.textContent = `$${e.target.value}`;
            this.debouncedApplyFilters();
        });

        maxPriceInput?.addEventListener('input', (e) => {
            this.state.filters.maxPrice = e.target.value;
            if (maxPriceDisplay) maxPriceDisplay.textContent = `$${e.target.value}`;
            this.debouncedApplyFilters();
        });

        // Category items (Discovery list)
        document.querySelectorAll('.mp-category-item').forEach(item => {
            item.addEventListener('click', () => {
                document.querySelectorAll('.mp-category-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');

                const category = item.dataset.category;
                if (category === 'all') {
                    this.state.filters.categories = [];
                } else {
                    this.state.filters.categories = [category];
                }
                this.applyFilters();
            });
        });

        // Campus Filter
        const campusFilter = document.getElementById('campusFilter');
        campusFilter?.addEventListener('change', (e) => {
            this.state.filters.campus = e.target.value;
            this.applyFilters();
        });

        // Rating Filter
        const ratingFilter = document.getElementById('ratingFilter');
        ratingFilter?.addEventListener('change', (e) => {
            this.state.filters.min_rating = e.target.value;
            this.applyFilters();
        });

        // Condition buttons
        document.querySelectorAll('.condition-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                btn.classList.toggle('active');
                const condition = btn.dataset.condition;
                if (btn.classList.contains('active')) {
                    this.state.filters.conditions.push(condition);
                } else {
                    this.state.filters.conditions = this.state.filters.conditions.filter(c => c !== condition);
                }
                this.applyFilters();
            });
        });

        // Reset button
        const resetBtn = document.querySelector('.clear-filters');
        resetBtn?.addEventListener('click', () => {
            this.resetFilters();
        });

        // Sort dropdown
        const sortSelect = document.getElementById('sortBy');
        sortSelect?.addEventListener('change', (e) => {
            this.state.filters.sortBy = e.target.value;
            this.applyFilters();
        });

        // Clear filters button
        const clearBtn = document.querySelector('.clear-filters');
        clearBtn?.addEventListener('click', () => this.clearFilters());

        // Toggle filter sidebar on mobile
        const filterToggleBtn = document.querySelector('.filter-toggle-btn');
        filterToggleBtn?.addEventListener('click', () => {
            filterSidebar.classList.toggle('active');
        });

        // Tab buttons
        document.querySelectorAll('.mp-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.mp-tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.state.tab = btn.dataset.tab;
                this.applyFilters();
            });
        });
    },

    applyFilters(append = false) {
        if (!append) this.state.page = 1;

        const queryParams = new URLSearchParams();
        if (this.state.filters.minPrice > 0) queryParams.append('min_price', this.state.filters.minPrice);
        if (this.state.filters.maxPrice < 10000) queryParams.append('max_price', this.state.filters.maxPrice);
        if (this.state.filters.categories.length > 0) queryParams.append('category', this.state.filters.categories[0]); // Model currently takes 1
        if (this.state.filters.conditions.length > 0) queryParams.append('condition', this.state.filters.conditions[0]);
        if (this.state.filters.sortBy) queryParams.append('sort', this.state.filters.sortBy);
        if (this.state.filters.campus) queryParams.append('campus', this.state.filters.campus);
        if (this.state.filters.min_rating) queryParams.append('min_rating', this.state.filters.min_rating);
        
        if (this.state.tab === 'user') {
            queryParams.append('seller_id', window.marketplaceConfig.userId);
        }

        const searchInput = document.getElementById('searchInput');
        if (searchInput?.value) queryParams.append('search', searchInput.value);
        
        queryParams.append('page', this.state.page);

        this.loadListings(queryParams.toString(), append);
    },

    clearFilters() {
        this.state.filters = {
            minPrice: 0,
            maxPrice: 10000,
            categories: [],
            conditions: [],
            searchQuery: '',
            sortBy: 'newest'
        };

        // Reset UI
        document.getElementById('minPrice').value = 0;
        document.getElementById('maxPrice').value = 10000;
        document.getElementById('minPriceDisplay').textContent = '$0';
        document.getElementById('maxPriceDisplay').textContent = '$10000';
        document.querySelectorAll('.category-filter').forEach(cb => cb.checked = false);
        document.querySelectorAll('.condition-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById('sortBy').value = 'newest';

        this.applyFilters();
    },

    async loadListings(queryString = '', append = false) {
        try {
            const data = await DashboardAPI.request(`/marketplace/listings?${queryString}`);
            if (data.success) {
                this.renderListings(data.listings, append);
                this.state.hasMore = data.hasMore;
                this.updateLoadMoreButton();
            }
        } catch (error) {
            console.error('Failed to load listings:', error);
        } finally {
            this.state.loading = false;
        }
    },

    debouncedApplyFilters() {
        if (this._filterTimeout) clearTimeout(this._filterTimeout);
        this._filterTimeout = setTimeout(() => this.applyFilters(), 500);
    },

    renderListings(listings) {
        const container = document.querySelector('.listings-grid');
        if (!container) return;

        if (listings.length === 0) {
            container.innerHTML = '<div class="no-results"><p>No listings found matching your filters</p></div>';
            return;
        }

        container.innerHTML = listings.map(listing => this.createListingCard(listing)).join('');
    },

    createListingCard(listing) {
        return `
            <div class="mp-listing-card" data-listing-id="${listing.listing_id}" onclick="MarketplaceEnhancements.openQuickView('${listing.listing_id}')">
                <div class="mp-card-image">
                    <img src="${listing.image_url || '/images/default-listing.jpg'}" alt="${listing.title}" loading="lazy">
                    <div class="mp-card-badge">$${parseFloat(listing.price).toFixed(2)}</div>
                    ${listing.is_sold ? '<div class="mp-card-status status-sold">SOLD</div>' : ''}
                    <button class="mp-wishlist-btn ${listing.is_favorited ? 'active' : ''}"
                            onclick="event.stopPropagation(); MarketplaceEnhancements.toggleFavorite('${listing.listing_id}', this)">
                        <i class="fas fa-heart"></i>
                    </button>
                </div>
                <div class="mp-card-content">
                    <h3 class="mp-card-title">${escapeHtml(listing.title)}</h3>
                    <div class="mp-card-price">$${parseFloat(listing.price).toFixed(2)}</div>
                    <div class="mp-card-meta">
                        <span><i class="fas fa-map-marker-alt"></i> ${listing.campus || 'Main'}</span>
                        <span><i class="far fa-clock"></i> ${window.timeAgo ? window.timeAgo(listing.created_at) : 'now'}</span>
                    </div>
                </div>
            </div>
        `;
    },

    // ========== MULTI-STEP WIZARD ==========
    initWizard() {
        const wizardModal = document.getElementById('createListingWizard');
        const openWizardBtns = document.querySelectorAll('.open-create-wizard');
        const closeWizardBtn = document.querySelector('.close-wizard');

        openWizardBtns.forEach(btn => {
            btn.addEventListener('click', () => this.openWizard());
        });
        closeWizardBtn?.addEventListener('click', () => this.closeWizard());

        // Step navigation
        document.querySelectorAll('.wizard-next-btn').forEach(btn => {
            btn.addEventListener('click', () => this.nextWizardStep());
        });

        document.querySelectorAll('.wizard-prev-btn').forEach(btn => {
            btn.addEventListener('click', () => this.prevWizardStep());
        });

        // Photo upload
        const photoInput = document.getElementById('wizardPhotos');
        photoInput?.addEventListener('change', (e) => this.handlePhotoUpload(e));

        // Form submission
        const submitBtn = document.querySelector('.wizard-submit-btn');
        submitBtn?.addEventListener('click', () => this.submitListing());
    },

    openWizard() {
        const wizardModal = document.getElementById('createListingWizard');
        wizardModal?.classList.add('active');
        this.state.wizardStep = 1;
        this.updateWizardStep();
    },

    closeWizard() {
        const wizardModal = document.getElementById('createListingWizard');
        wizardModal?.classList.remove('active');
        this.resetWizard();
    },

    nextWizardStep() {
        if (this.validateCurrentStep()) {
            this.state.wizardStep++;
            this.updateWizardStep();
        }
    },

    prevWizardStep() {
        this.state.wizardStep--;
        this.updateWizardStep();
    },

    updateWizardStep() {
        // Hide all steps
        document.querySelectorAll('.wizard-step').forEach(step => {
            step.classList.remove('active');
        });

        // Show current step
        const currentStep = document.querySelector(`.wizard-step[data-step="${this.state.wizardStep}"]`);
        currentStep?.classList.add('active');

        // Update step indicators
        document.querySelectorAll('.step-indicator').forEach((indicator, index) => {
            if (index + 1 < this.state.wizardStep) {
                indicator.classList.add('completed');
                indicator.classList.remove('active');
            } else if (index + 1 === this.state.wizardStep) {
                indicator.classList.add('active');
                indicator.classList.remove('completed');
            } else {
                indicator.classList.remove('active', 'completed');
            }
        });

        // Update button visibility
        const prevBtn = document.querySelector('.wizard-prev-btn');
        const nextBtn = document.querySelector('.wizard-next-btn');
        const submitBtn = document.querySelector('.wizard-submit-btn');

        if (this.state.wizardStep === 1) {
            prevBtn?.style.setProperty('display', 'none');
        } else {
            prevBtn?.style.setProperty('display', 'inline-block');
        }

        if (this.state.wizardStep === 4) {
            nextBtn?.style.setProperty('display', 'none');
            submitBtn?.style.setProperty('display', 'inline-block');
            this.updatePreview();
        } else {
            nextBtn?.style.setProperty('display', 'inline-block');
            submitBtn?.style.setProperty('display', 'none');
        }
    },

    validateCurrentStep() {
        const step = this.state.wizardStep;

        if (step === 1) {
            const title = document.getElementById('wizardTitle')?.value;
            if (!title || title.trim() === '') {
                alert('Please enter a title for your listing');
                return false;
            }
            this.state.wizardData.title = title;
        } else if (step === 2) {
            const category = document.getElementById('wizardCategory')?.value;
            const condition = document.querySelector('.condition-btn.active')?.dataset.condition;
            const price = document.getElementById('wizardPrice')?.value;

            if (!category) {
                alert('Please select a category');
                return false;
            }
            if (!condition) {
                alert('Please select a condition');
                return false;
            }
            if (!price || price <= 0) {
                alert('Please enter a valid price');
                return false;
            }

            this.state.wizardData.category = category;
            this.state.wizardData.condition = condition;
            this.state.wizardData.price = price;
            this.state.wizardData.description = document.getElementById('wizardDescription')?.value || '';
            this.state.wizardData.isNegotiable = document.getElementById('wizardNegotiable')?.checked || false;
        } else if (step === 3) {
            const location = document.getElementById('wizardLocation')?.value;
            if (!location) {
                alert('Please select a location');
                return false;
            }
            this.state.wizardData.location = location;
            this.state.wizardData.meetupLocation = document.getElementById('wizardMeetupLocation')?.value || '';
        }

        return true;
    },

    handlePhotoUpload(e) {
        const files = Array.from(e.target.files);
        const previewContainer = document.getElementById('photoPreviewContainer');

        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = document.createElement('div');
                img.className = 'photo-preview-item';
                img.innerHTML = `
                    <img src="${event.target.result}" alt="Preview">
                    <button class="remove-photo-btn" onclick="MarketplaceEnhancements.removePhoto(this)">
                        <i class="fas fa-times"></i>
                    </button>
                `;
                previewContainer?.appendChild(img);
                this.state.wizardData.photos.push(file);
            };
            reader.readAsDataURL(file);
        });
    },

    removePhoto(btn) {
        const photoItem = btn.closest('.photo-preview-item');
        const index = Array.from(photoItem.parentElement.children).indexOf(photoItem);
        this.state.wizardData.photos.splice(index, 1);
        photoItem.remove();
    },

    updatePreview() {
        const preview = document.getElementById('listingPreview');
        if (!preview) return;

        preview.innerHTML = `
            <div class="preview-card">
                <div class="preview-images">
                    ${this.state.wizardData.photos.length > 0 ?
                `<img src="${URL.createObjectURL(this.state.wizardData.photos[0])}" alt="Preview">` :
                '<div class="no-image">No photos uploaded</div>'
            }
                </div>
                <div class="preview-content">
                    <h3>${this.state.wizardData.title}</h3>
                    <p class="preview-price">$${this.state.wizardData.price} ${this.state.wizardData.isNegotiable ? '(Negotiable)' : ''}</p>
                    <p class="preview-description">${this.state.wizardData.description}</p>
                    <div class="preview-meta">
                        <span><i class="fas fa-tag"></i> ${this.state.wizardData.category}</span>
                        <span><i class="fas fa-check-circle"></i> ${this.state.wizardData.condition}</span>
                        <span><i class="fas fa-map-marker-alt"></i> ${this.state.wizardData.location}</span>
                    </div>
                </div>
            </div>
        `;
    },

    async submitListing() {
        try {
            const formData = new FormData();
            formData.append('title', this.state.wizardData.title);
            formData.append('category', this.state.wizardData.category);
            formData.append('condition', this.state.wizardData.condition);
            formData.append('price', this.state.wizardData.price);
            formData.append('description', this.state.wizardData.description);
            formData.append('location', this.state.wizardData.location);
            formData.append('is_negotiable', this.state.wizardData.isNegotiable ? 1 : 0);
            formData.append('meet_up_location', this.state.wizardData.meetupLocation);

            this.state.wizardData.photos.forEach((photo, index) => {
                formData.append('media', photo);
            });

            const response = await DashboardAPI.request('/marketplace/listings', {
                method: 'POST',
                body: formData
            });

            if (response.success) {
                alert('Listing created successfully!');
                this.closeWizard();
                this.loadListings();
            } else {
                alert('Failed to create listing: ' + response.message);
            }
        } catch (error) {
            console.error('Submit listing error:', error);
            alert('Failed to create listing. Please try again.');
        }
    },

    resetWizard() {
        this.state.wizardStep = 1;
        this.state.wizardData = {
            photos: [],
            title: '',
            category: '',
            condition: '',
            price: '',
            isNegotiable: false,
            description: '',
            location: '',
            meetupLocation: ''
        };

        document.getElementById('wizardTitle').value = '';
        document.getElementById('wizardCategory').value = '';
        document.getElementById('wizardPrice').value = '';
        document.getElementById('wizardDescription').value = '';
        document.getElementById('wizardLocation').value = '';
        document.getElementById('wizardNegotiable').checked = false;
        document.getElementById('photoPreviewContainer').innerHTML = '';
    },

    // ========== ENHANCED LISTINGS ==========
    initEnhancedListings() {
        // Delegate event listeners for dynamic content
        document.addEventListener('click', (e) => {
            if (e.target.closest('.favorite-btn')) {
                const btn = e.target.closest('.favorite-btn');
                this.toggleFavorite(btn.dataset.id);
            }

            if (e.target.closest('.share-btn')) {
                const btn = e.target.closest('.share-btn');
                this.shareListing(btn.dataset.id);
            }

            if (e.target.closest('.btn-message-seller')) {
                const btn = e.target.closest('.btn-message-seller');
                this.messageSeller(btn.dataset.id);
            }

            if (e.target.closest('.report-listing-btn')) {
                const btn = e.target.closest('.report-listing-btn');
                this.reportListing(btn.dataset.id);
            }

            if (e.target.closest('.boost-listing-btn')) {
                const btn = e.target.closest('.boost-listing-btn');
                this.boostListing(btn.dataset.id);
            }

            if (e.target.closest('.mark-sold-btn')) {
                const btn = e.target.closest('.mark-sold-btn');
                this.markAsSold(btn.dataset.id);
            }
        });
    },

    async toggleFavorite(listingId, btn) {
        if (!listingId) return;
        
        try {
            const response = await DashboardAPI.request('/marketplace/favorites/toggle', {
                method: 'POST',
                body: JSON.stringify({ listingId })
            });

            if (response.success) {
                if (btn) btn.classList.toggle('active');
            }
        } catch (error) {
            console.error('Toggle favorite error:', error);
        }
    },

    shareListing(listingId) {
        const url = `${window.location.origin}/marketplace/${listingId}`;
        if (navigator.share) {
            navigator.share({
                title: 'Check out this listing',
                url: url
            });
        } else {
            navigator.clipboard.writeText(url);
            alert('Link copied to clipboard!');
        }
    },

    async handleOrderNow(sellerId, listingId, title) {
        const confirmOrder = confirm(`Do you want to send an 'Order Request' for "${title}"?`);
        if (!confirmOrder) return;
        
        const message = `✨ Hi! I'm ready to buy "${title}". Is it still available for meetup? 🛍️`;
        this.messageSeller(listingId, sellerId, message);
    },

    async messageSeller(listingId, sellerId, initialMessage = '') {
        try {
            const data = await DashboardAPI.request('/marketplace/contact-seller', {
                method: 'POST',
                body: JSON.stringify({ listingId, sellerId, message: initialMessage })
            });

            if (data.success) {
                this.state.currentChatId = data.chatId;
                const userNameEl = document.getElementById('chatUserName');
                if (userNameEl) userNameEl.textContent = data.sellerName || 'Seller';
                
                const avatarEl = document.getElementById('chatSellerAvatar');
                if (avatarEl && data.sellerAvatar) {
                    avatarEl.innerHTML = `<img src="${data.sellerAvatar}" style="width:100%; height:100%; border-radius: 50%; object-fit: cover;">`;
                }

                await this.loadMessages(data.chatId);
                openModal('chatModal');
            }
        } catch (error) {
            console.error('Failed to initiate contact:', error);
            alert('Failed to start chat. Please try again.');
        }
    },

    async reportListing(listingId) {
        const reason = prompt('Why are you reporting this listing?\n\n1. Spam\n2. Inappropriate\n3. Scam\n4. Misleading\n5. Other');
        if (!reason) return;

        try {
            const response = await DashboardAPI.request(`/marketplace/listings/${listingId}/report`, {
                method: 'POST',
                body: JSON.stringify({ reason, details: '' })
            });

            if (response.success) {
                alert('Report submitted successfully');
            }
        } catch (error) {
            console.error('Report listing error:', error);
        }
    },

    async boostListing(listingId) {
        if (!confirm('Boost this listing to the top of the feed?')) return;

        try {
            const response = await DashboardAPI.request(`/marketplace/listings/${listingId}/boost`, {
                method: 'POST'
            });

            if (response.success) {
                alert('Listing boosted successfully!');
                this.loadListings();
            }
        } catch (error) {
            console.error('Boost listing error:', error);
        }
    },

    async markAsSold(listingId) {
        if (!confirm('Mark this listing as sold?')) return;

        try {
            const response = await DashboardAPI.request(`/marketplace/listings/${listingId}/sold`, {
                method: 'POST'
            });

            if (response.success) {
                alert('Listing marked as sold!');
                this.loadListings();
            }
        } catch (error) {
            console.error('Mark as sold error:', error);
        }
    },

    async loadMessages(chatId) {
        if (!this.elements.chatMessages) return;
        
        try {
            const data = await DashboardAPI.request(`/marketplace/chats/${chatId}/messages`);
            if (data.success) {
                this.elements.chatMessages.innerHTML = data.messages.map(msg => `
                    <div class="message ${msg.sender_id === window.marketplaceConfig.userId ? 'sent' : 'received'}">
                        <div class="message-bubble">${escapeHtml(msg.content)}</div>
                        <div class="message-time">${window.timeAgo ? window.timeAgo(msg.created_at) : ''}</div>
                    </div>
                `).join('');
                this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
            }
        } catch (e) { console.error('Load messages error:', e); }
    },

    async sendMessage() {
        const input = this.elements.chatInput;
        if (!input || !input.value.trim() || !this.state.currentChatId) return;

        const content = input.value.trim();
        input.value = '';

        try {
            const data = await DashboardAPI.request(`/marketplace/chats/${this.state.currentChatId}/messages`, {
                method: 'POST',
                body: JSON.stringify({ content })
            });

            if (data.success) {
                await this.loadMessages(this.state.currentChatId);
            }
        } catch (e) {
            console.error('Send message error:', e);
            input.value = content;
        }
    },

    closeChat() {
        closeAllModals();
        this.state.currentChatId = null;
    },

    // ========== SAFE MEETUP LOCATIONS ==========
    async loadSafeMeetupLocations() {
        try {
            const response = await DashboardAPI.request('/marketplace/safe-locations');
            if (response.success) {
                this.renderSafeMeetupLocations(response.locations);
            }
        } catch (error) {
            console.error('Load safe meetup locations error:', error);
        }
    },

    renderSafeMeetupLocations(locations) {
        const select = document.getElementById('wizardMeetupLocation');
        if (!select) return;

        select.innerHTML = '<option value="">Select a safe meetup spot (optional)</option>' +
            locations.map(loc => `
                <option value="${loc.location_id}">
                    ${loc.name} ${loc.has_security ? '🔒' : ''} ${loc.is_24_7 ? '🕐' : ''}
                </option>
            `).join('');
    },

    // ========== KEYBOARD EVENTS ==========
    setupKeyboardEvents() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (typeof closeAllModals === 'function') closeAllModals();
                this.closeWizard();
            }
            // Ctrl+K / Cmd+K: focus search
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                const searchInput = document.getElementById('searchInput') || document.querySelector('.search-input');
                searchInput?.focus();
            }
        });
    },

    // Alias kept for older callers
    resetFilters() {
        this.clearFilters();
    }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => MarketplaceEnhancements.init());
} else {
    MarketplaceEnhancements.init();
}
