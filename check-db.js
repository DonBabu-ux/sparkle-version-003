require('dotenv').config();
const pool = require('./config/database');
const Marketplace = require('./models/Marketplace');

async function test() {
    try {
        console.log('--- Testing Marketplace.getListings ---');
        const filters = {
            category: 'all',
            campus: 'all',
            limit: 20,
            offset: 0
        };
        const result = await Marketplace.getListings(filters);
        console.log('Result total:', result.pagination.total);
        console.log('Result listings count:', result.listings.length);
        
        if (result.listings.length > 0) {
            const first = result.listings[0];
            console.log('First Listing:', {
                id: first.listing_id,
                title: first.title,
                seller: first.seller_username,
                media_count: first.media.length,
                image_urls: first.image_urls
            });
        } else {
            console.log('No listings returned by the model!');
        }

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

test();
