const fs = require('fs');
const path = require('path');

const publicSoundsDir = path.join(__dirname, '../public/sounds');
const themesDir = path.join(publicSoundsDir, 'themes');

const fileMapping = {
  'send.mp3': 'send message .mp3',
  'receive.mp3': 'inchat message receive.mp3',
  'notification.mp3': 'outchat notification.mp3',
  'like.mp3': 'sparkle like notification.mp3',
  'comment.mp3': 'comment pop.mp3',
  'follow.mp3': 'new follower .mp3',
  'story.mp3': 'sparkle Facebook notification.mp3',
  'ringtone.mp3': 'iphone.mp3',
};

const themes = ['classic', 'soft', 'minimal', 'sparkle_original'];

themes.forEach((theme) => {
  const themePath = path.join(themesDir, theme);
  if (!fs.existsSync(themePath)) {
    fs.mkdirSync(themePath, { recursive: true });
  }

  Object.entries(fileMapping).forEach(([targetName, srcName]) => {
    const srcPath = path.join(publicSoundsDir, srcName);
    const destPath = path.join(themePath, targetName);

    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, destPath);
      console.log(`Copied ${srcName} -> ${theme}/${targetName}`);
    } else {
      console.warn(`Source not found: ${srcPath}`);
    }
  });
});

console.log('Sound themes copy complete!');
