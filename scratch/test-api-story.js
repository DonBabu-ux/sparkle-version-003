const fs = require('fs');
const FormData = require('form-data');
const axios = require('axios');

async function testUpload() {
    try {
        console.log("Testing POST /api/stories ...");
        
        const mysql = require('mysql2/promise');
        const pool = mysql.createPool({
            host: process.env.DB_HOST || 'mysql-lilbee.alwaysdata.net',
            user: process.env.DB_USER || 'lilbee',
            password: process.env.DB_PASSWORD || '@lilbeeLogics',
            database: process.env.DB_NAME || 'lilbee_sparkle',
        });
        
        const userId = 'f8637979-873e-4d33-b92a-32ef53a87174';
        const jwt = require('jsonwebtoken');
        const token = jwt.sign({ userId }, process.env.JWT_SECRET || 'd4d621d078d6f726d4db3052cca83abaff421740e97ed8bc431e25f9529424f2');
        
        const form = new FormData();
        form.append('type', 'text');
        form.append('text_content', 'Hello from test ✅');
        form.append('text_config', JSON.stringify({ color: '#fff' }));
        form.append('stickers', JSON.stringify([{ type: 'text', config: { text: 'Test 😊' } }]));
        form.append('parent_story_id', '');
        
        const response = await axios.post('http://localhost:3000/api/stories', form, {
            headers: {
                ...form.getHeaders(),
                'Authorization': `Bearer ${token}`
            }
        });
        
        console.log("Status:", response.status);
        console.log("Response:", response.data);
    } catch (error) {
        if (error.response) {
            console.error("API Error Status:", error.response.status);
            console.error("API Error Data:", error.response.data);
        } else {
            console.error("Axios failed:", error.message);
        }
    }
}

testUpload();
