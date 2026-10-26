/**
 * Classify each residue file by its outer shell: light shell = white-family
 * tokens inside are suspect; dark shell = white tokens are correct.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

const FILES = [
  'components/modals/GroupSettingsModal.tsx', 'pages/StoryViewer.tsx', 'pages/AdminDashboard.tsx',
  'pages/MessagesSettings.tsx', 'pages/ProfessionalDashboard.tsx', 'components/modals/AutoWithdrawalModal.tsx',
  'pages/MarketplaceChat.tsx', 'pages/LostFound.tsx', 'pages/PollDetail.tsx', 'pages/Ecosystem.tsx',
  'components/modals/MomentShareModal.tsx', 'components/Navbar.tsx', 'pages/CreateGroup.tsx',
  'pages/CreateStory.tsx', 'components/modals/MediaPreviewModal.tsx', 'components/stories/StickerPicker.tsx'
];

for (const rel of FILES) {
  const c = fs.readFileSync(path.join(ROOT, 'frontend/src', rel), 'utf8');
  // outermost shell candidates
  const shell = c.match(/className=(?:"([^"]*(min-h-dvh|inset-0|max-w-\[?[0-9]|h-full)[^"]*)"|\{[^}]*\})/);
  const darkVariants = (c.match(/dark:/g) || []).length;
  const whiteText = (c.match(/text-white(\/\d+)?\b/g) || []).length;
  const s = shell ? shell[0].replace(/\s+/g, ' ').slice(0, 110) : '(no shell match)';
  console.log(`${rel}`);
  console.log(`   dark: variants=${darkVariants}  text-white tokens=${whiteText}`);
  console.log(`   shell: ${s}`);
}
