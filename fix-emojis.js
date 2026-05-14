const fs = require('fs');
const f = 'c:/Users/user/Desktop/BABU DON/SPARKLE/SPARKLE 2/sparkle-version-003/frontend/src/pages/Messages.tsx';
let c = fs.readFileSync(f, 'utf8');

const cleanEmojis1 = `[
                              '👍','❤️','🔥','😂','😮','😢','🎉','💯','🙌','😍','✨','🙏','💀','😎','🥰','😀',
                              '😃','😄','😁','😆','😅','🤣','😉','😊','😇','🙂','🙃','😋','😘','😗','😙','😚',
                              '😛','😝','😜','🤪','🤨','🧐','🤓','🤩','🥳','😏','😒','😞','😔','😟','😕','🙁',
                              '☹️','😣','😖','😫','😩','🥺','😭','😤','😠','😡','🤬','🤯','😳','🥵','🥶','😱',
                              '😨','😰','😥','😓','🤗','🤔','🤭','🤫','🤥','😶','😐','😑','😬','🙄','😯','😦',
                              '😧','😲','🥱','😴','🤤','😪','😵','🤐','🥴','🤢','🤮','🤧','😷','🤒','🤕','🤑',
                              '🤠','😈','👿','👹','👺','🤡','💩','👻','💀','☠️','👽','👾','🤖','🎃','😺','😸',
                              '🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐻‍❄️','🐨','🐯','🦁','🐮','🐷','🐸','🐵',
                              '🦋','🌸','🌺','🌻','🌹','🌷','🍀','🌿','🍁','🍃','🌊','⛰️','🌙','⭐','🌟','💫',
                              '🍕','🍔','🍟','🌮','🍣','🍜','🍩','🍪','🎂','🍰','🧁','🍭','🍫','🍬','☕','🧋',
                              '⚽','🏀','🎮','🎸','🎹','🎤','🎧','🎨','✈️','🚀','🌍','🏆','🥇','🎯','🎪','🎭',
                              '💎','💍','👑','👒','🎩','👗','👔','👟','👠','💼','🎒','💰','💳','📱','💻','⌚'
                            ]`;

const cleanEmojis2 = `[
                                  '😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩',
                                  '😘','😗','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐',
                                  '😐','😑','😶','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕',
                                  '🤢','🤮','🤧','🥵','🥶','🥴','😵','🤯','🤠','🥳','🥸','😎','🤓','🧐','😕','😟',
                                  '🙁','☹️','😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱','😖',
                                  '😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','☠️','💩','🤡',
                                  '👍','👎','❤️','🔥','✨','💫','🎉','💯','🙌','👏','🤝','🤜','🤛','👊','✊','🤞',
                                  '🌸','🌺','🌻','🌹','🍀','🌊','🌙','⭐','🌟','💎','👑','🏆','🎯','🚀','⚡','🌈'
                                ]`;

// Find the start of the first array
const startSearch1 = '<div className="grid grid-cols-8 gap-2">\r\n                            {[';
const mapSearch1 = '].map((emoji, idx) => (\r\n                              <button key={idx} onClick={() => setQuickReaction(';

let idx1Start = c.indexOf('<div className="grid grid-cols-8 gap-2">');
let array1Start = c.indexOf('{[', idx1Start);
let array1End = c.indexOf('].map((emoji, idx) => (', array1Start) + 1;

if (idx1Start !== -1 && array1Start !== -1 && array1End !== -1) {
    c = c.substring(0, array1Start + 1) + cleanEmojis1 + c.substring(array1End);
    console.log('Fixed array 1');
}

// Find the start of the second array
let idx2Start = c.indexOf('<div className="grid grid-cols-8 gap-2">', array1End);
let array2Start = c.indexOf('{[', idx2Start);
let array2End = c.indexOf('].map((emoji, idx) => (', array2Start) + 1;

if (idx2Start !== -1 && array2Start !== -1 && array2End !== -1) {
    c = c.substring(0, array2Start + 1) + cleanEmojis2 + c.substring(array2End);
    console.log('Fixed array 2');
}

fs.writeFileSync(f, c, 'utf8');
