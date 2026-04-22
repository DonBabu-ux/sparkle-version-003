require('dotenv').config();
const cloudinary = require('cloudinary').v2;

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

async function listAndDisplayVideos() {
    try {
        // Alternative method using resources function
        const result = await cloudinary.api.resources({
            type: 'upload',
            resource_type: 'video',
            max_results: 100
        });

        if (result.resources.length === 0) {
            console.log('No videos found in your Cloudinary account');
            return;
        }

        console.log(`Found ${result.resources.length} videos:\n`);

        result.resources.forEach((video, index) => {
            // Generate the correct video URL
            const videoUrl = cloudinary.url(video.public_id, {
                resource_type: 'video',
                secure: true
            });

            console.log(`${index + 1}. Public ID: ${video.public_id}`);
            console.log(`   URL: ${videoUrl}`);
            console.log(`   Format: ${video.format}`);
            console.log(`   Created: ${video.created_at}`);
            console.log('---');
        });

        // Return just the URLs as an array
        const videoUrls = result.resources.map(v =>
            cloudinary.url(v.public_id, { resource_type: 'video', secure: true })
        );

        console.log('\n✅ All video URLs retrieved successfully!');
        return videoUrls;

    } catch (error) {
        console.error('Error fetching videos:', error);
        if (error.error_code === 401) {
            console.log('Authentication failed. Check your API credentials.');
        }
    }
}

listAndDisplayVideos();