// Marketplace Enhancements - Phase 3 UI/UX Features
// Advanced Filters, View Toggle, Multi-Step Wizard, Enhanced Listings

const MarketplaceEnhancements = {
    // State management
    state: {
        viewMode: localStorage.getItem('marketplaceView') || 'grid',
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
        }
    },

    // Initialize all features
    init() {
        this.initViewToggle();
        this.initFilters();
        this.initWizard();
        this.initEnhancedListings();
        this.loadSafeMeetupLocations();
    },

    // ========== VIEW TOGGLE ==========
    initViewToggle() {
        const viewToggle = document.querySelector('.view-toggle');
        if (!viewToggle) return;

        const gridBtn = viewToggle.querySelector('[data-view="grid"]');
        const listBtn = viewToggle.querySelector('[data-view="list"]');
        const listingsContainer = document.querySelector('.listings-grid');

        // Set initial view
        this.setView(this.state.viewMode);

        gridBtn?.addEventListener('click', () => this.setView('grid'));
        listBtn?.addEventListener('click', () => this.setView('list'));
    },

    setView(mode) {
        this.state.viewMode = mode;
        localStorage.setItem('marketplaceView', mode);

        const listingsContainer = document.querySelector('.listings-grid');
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

    // ========== ADVANCED FILTERS ==========
    initFilters() {
        const filterSidebar = document.querySelector('.filter-sidebar');
        if (!filterSidebar) return;

        // Price range sliders
        const minPriceSlider = document.getElementById('minPrice');
        const maxPriceSlider = document.getElementById('maxPrice');
        const minPriceDisplay = document.getElementById('minPriceDisplay');
        const maxPriceDisplay = document.getElementById('maxPriceDisplay');

        minPriceSlider?.addEventListener('input', (e) => {
            this.state.filters.minPrice = parseInt(e.target.value);
            if (minPriceDisplay) minPriceDisplay.textContent = `$${e.target.value}`;
            this.applyFilters();
        });

        maxPriceSlider?.addEventListener('input', (e) => {
            this.state.filters.maxPrice = parseInt(e.target.value);
            if (maxPriceDisplay) maxPriceDisplay.textContent = `$${e.target.value}`;
            this.applyFilters();
        });

        // Category checkboxes
        document.querySelectorAll('.category-filter').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const category = e.target.value;
                if (e.target.checked) {
                    this.state.filters.categories.push(category);
                } else {
                    this.state.filters.categories = this.state.filters.categories.filter(c => c !== category);
                }
                this.applyFilters();
            });
        });

        // Condition buttons
        document.querySelectorAll('.condition-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const condition = e.target.dataset.condition;
                btn.classList.toggle('active');

                if (btn.classList.contains('active')) {
                    this.state.filters.conditions.push(condition);
                } else {
                    this.state.filters.conditions = this.state.filters.conditions.filter(c => c !== condition);
                }
                this.applyFilters();
            });
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
    },

    applyFilters() {

        const queryParams = new URLSearchParams();
        if (this.state.filters.minPrice > 0) queryParams.append('minPrice', this.state.filters.minPrice);
        if (this.state.filters.maxPrice < 10000) queryParams.append('maxPrice', this.state.filters.maxPrice);
        if (this.state.filters.categories.length > 0) queryParams.append('category', this.state.filters.categories.join(','));
        if (this.state.filters.conditions.length > 0) queryParams.append('condition', this.state.filters.conditions.join(','));
        if (this.state.filters.sortBy) queryParams.append('sort', this.state.filters.sortBy);

        // Reload listings with filters
        this.loadListings(queryParams.toString());
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

    async loadListings(queryString = '') {
        try {
            const response = await DashboardAPI.request(`/listings?${queryString}`);
            if (response.success) {
                this.renderListings(response.listings);
            }
        } catch (error) {
            console.error('Failed to load listings:', error);
        }
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
            <div class="listing-card" data-listing-id="${listing.listing_id}">
                <div class="listing-card-inner">
                    <div class="listing-image">
                        <img src="${listing.media_url || '/uploads/placeholder.jpg'}" alt="${listing.title}">
                        ${listing.status === 'sold' ? '<span class="sold-badge">SOLD</span>' : ''}
                        <div class="listing-quick-actions">
                            <button class="quick-action-btn favorite-btn" data-id="${listing.listing_id}">
                                <i class="fas fa-heart"></i>
                            </button>
                            <button class="quick-action-btn share-btn" data-id="${listing.listing_id}">
                                <i class="fas fa-share-alt"></i>
                            </button>
                        </div>
                    </div>
                    <div class="listing-content">
                        <div class="listing-header">
                            <h3 class="listing-title">${listing.title}</h3>
                            <span class="listing-price">$${listing.price}</span>
                        </div>
                        <p class="listing-description">${listing.description?.substring(0, 100)}...</p>
                        <div class="listing-meta">
                            <span class="listing-category"><i class="fas fa-tag"></i> ${listing.category}</span>
                            <span class="listing-condition">${listing.condition}</span>
                            <span class="listing-location"><i class="fas fa-map-marker-alt"></i> ${listing.location || 'Campus'}</span>
                        </div>
                        <div class="listing-footer">
                            <div class="seller-info">
                                <img src="${listing.seller_avatar || '/uploads/avatars/default.png'}" alt="${listing.seller_name}">
                                <span>${listing.seller_name}</span>
                            </div>
                            <button class="btn-message-seller" data-id="${listing.listing_id}">
                                <i class="fas fa-comment"></i> Message
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    // ========== MULTI-STEP WIZARD ==========
    initWizard() {
        const wizardModal = document.getElementById('createListingWizard');
        const openWizardBtn = document.querySelector('.open-create-wizard');
        const closeWizardBtn = document.querySelector('.close-wizard');

        openWizardBtn?.addEventListener('click', () => this.openWizard());
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

            const response = await DashboardAPI.request('/listings', {
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

    async toggleFavorite(listingId) {
        try {
            const response = await DashboardAPI.request('/favorites/toggle', {
                method: 'POST',
                body: JSON.stringify({ listing_id: listingId })
            });

            if (response.success) {
                const btn = document.querySelector(`.favorite-btn[data-id="${listingId}"]`);
                btn?.classList.toggle('active');
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

    messageSeller(listingId) {
        // Open chat modal with seller
        window.location.href = `/marketplace/${listingId}#message`;
    },

    async reportListing(listingId) {
        const reason = prompt('Why are you reporting this listing?\n\n1. Spam\n2. Inappropriate\n3. Scam\n4. Misleading\n5. Other');
        if (!reason) return;

        try {
            const response = await DashboardAPI.request(`/listings/${listingId}/report`, {
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
            const response = await DashboardAPI.request(`/listings/${listingId}/boost`, {
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
            const response = await DashboardAPI.request(`/listings/${listingId}/mark-sold`, {
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

    // ========== SAFE MEETUP LOCATIONS ==========
    async loadSafeMeetupLocations() {
        try {
            const response = await DashboardAPI.request('/safe-locations');
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
    }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => MarketplaceEnhancements.init());
} else {
    MarketplaceEnhancements.init();
}
