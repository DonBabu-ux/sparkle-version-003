const fs = require('fs');

const file = 'c:/Users/user/Desktop/BABU DON/SPARKLE/SPARKLE 2/sparkle-version-003/frontend/src/pages/Messages.tsx';
let data = fs.readFileSync(file, 'utf8');

// Fix the undefined currentChatTheme crash
data = data.replace(
    /const currentChatTheme = selectedChat \? getThemeForChat\(selectedChat\.chat_id\) : PRESET_THEMES\[0\];/,
    "const currentChatTheme = (selectedChat ? getThemeForChat(selectedChat.chat_id) : PRESET_THEMES[0]) || PRESET_THEMES[0];"
);
data = data.replace(
    /const activeThemeId = currentChatTheme\.id;/,
    "const activeThemeId = currentChatTheme?.id || 'classic';"
);

// Also add optional chaining on the colors access around line 540
data = data.replace(
    /'--color-primary': currentChatTheme\.colors\.primary,/g,
    "'--color-primary': currentChatTheme?.colors?.primary || '#ff1493',"
);
data = data.replace(
    /'--color-primary-600': currentChatTheme\.colors\.primary600,/g,
    "'--color-primary-600': currentChatTheme?.colors?.primary600 || '#d0127a',"
);
data = data.replace(
    /'--color-primary-400': currentChatTheme\.colors\.primary400,/g,
    "'--color-primary-400': currentChatTheme?.colors?.primary400 || '#ff4dad',"
);

fs.writeFileSync(file, data, 'utf8');
console.log('Fixed currentChatTheme undefined error.');
