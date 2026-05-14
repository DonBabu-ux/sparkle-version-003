const fs = require('fs');
const f = 'c:/Users/user/Desktop/BABU DON/SPARKLE/SPARKLE 2/sparkle-version-003/frontend/src/pages/Messages.tsx';
let c = fs.readFileSync(f, 'utf8');

// Fix 1: Add showWordEmojiPicker state after showEmojiModal
c = c.replace(
  /const \[showEmojiModal, setShowEmojiModal\] = useState\(false\);(\r?\n)/,
  "const [showEmojiModal, setShowEmojiModal] = useState(false);\n  const [showWordEmojiPicker, setShowWordEmojiPicker] = useState(false);$1"
);

// Fix 2: Fix corrupted emoji default in newWordEffect
// Match anything that looks like the corrupted emoji line
c = c.replace(
  /const \[newWordEffect, setNewWordEffect\] = useState\(\{ word: '', emoji: '[^']*' \}\);/,
  "const [newWordEffect, setNewWordEffect] = useState({ word: '', emoji: '\uD83D\uDD25' });"
);

// Fix 3: Theme cards - rectangular with slight bend (rounded-lg instead of rounded-2xl, aspect-video instead of aspect-[2/3])
c = c.replace(
  /className="w-full aspect-\[2\/3\] rounded-2xl relative overflow-hidden group-hover:ring-2 ring-primary ring-offset-2 ring-offset-\[#0a0a0a\] transition-all"/g,
  'className="w-full aspect-[3/4] rounded-xl relative overflow-hidden group-hover:ring-2 ring-primary ring-offset-2 ring-offset-[#0a0a0a] transition-all"'
);

// Fix 4: AI Themes / Upload Photo buttons - smaller, less rounded
c = c.replace(
  /className="bg-white\/10 rounded-2xl p-5 flex flex-col items-center justify-center hover:bg-white\/15 transition-colors border border-white\/10"/g,
  'className="bg-white/10 rounded-xl px-4 py-3 flex items-center gap-3 hover:bg-white/15 transition-colors border border-white/10"'
);

// Fix icon sizes in those buttons from size={26} to size={18}
c = c.replace(/<Wand2 size=\{26\} className="text-primary mb-2" \/>/g, '<Wand2 size={18} className="text-primary shrink-0" />');
c = c.replace(/<ImageIcon size=\{26\} className="text-white\/60 mb-2" \/>/g, '<ImageIcon size={18} className="text-white/60 shrink-0" />');

fs.writeFileSync(f, c, 'utf8');
console.log('All fixes applied. Length:', c.length);

// Verify
const lines = c.split('\n');
const emojiLine = lines.find(l => l.includes('newWordEffect') && l.includes('useState'));
console.log('Emoji state line:', emojiLine && emojiLine.trim());
const showEmoji = lines.find(l => l.includes('showWordEmojiPicker'));
console.log('showWordEmojiPicker found:', !!showEmoji);
