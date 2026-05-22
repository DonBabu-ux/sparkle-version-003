const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'Messages.tsx');
let c = fs.readFileSync(filePath, 'utf8');

// 1. Insert getTabBadgeCount helper function
const targetStateDef = '  const [conversations, setConversations] = useState<ChatConversation[]>([]);';
const helperDef = `
  const getTabBadgeCount = (tabId: string) => {
    if (tabId === 'all') return conversations.length;
    if (tabId === 'unread') {
      return conversations.reduce((acc, cv) => acc + (cv.unread_count || 0), 0);
    }
    if (tabId === 'groups') {
      return conversations.filter(cv => !!(cv.is_group || cv.chat_type === 'group')).length;
    }
    if (tabId === 'archived') {
      return conversations.filter(cv => !!(cv as any).is_archived).length;
    }
    const list = customLists.find(l => l.id === tabId);
    if (list) {
      return conversations.filter(cv => list.chatIds.includes(cv.chat_id)).length;
    }
    return 0;
  };
`;

if (c.includes(targetStateDef)) {
  c = c.replace(targetStateDef, targetStateDef + helperDef);
} else {
  console.error('Target state definition not found in file!');
  process.exit(1);
}

// 2. Replace visibleTabs.map block
const oldTabsMap = `                  {visibleTabs.map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveFilter(tab.id)}
                      onContextMenu={(e) => handleContextMenu(e, tab.id)}
                      onTouchStart={(e) => startTouchTimer(e, tab.id)}
                      onTouchEnd={clearTouchTimer}
                      onTouchMove={clearTouchTimer}
                      className={clsx(
                        'shrink-0 px-4 py-[6px] text-[12px] font-semibold transition-all duration-200 select-none touch-none',
                        activeFilter === tab.id
                          ? 'bg-[#ff1493] text-white shadow-[0_0_12px_rgba(255,20,147,0.28)] rounded-md'
                          : 'bg-white/[0.15] text-white/85 hover:bg-white/[0.22] hover:text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] border border-white/[0.06] rounded-md'
                      )}
                    >
                      <span className="flex items-center gap-1 pointer-events-none">
                        {tab.label}
                        {tab.isMuted && <BellOff size={10} className="opacity-60" />}
                      </span>
                    </button>
                  ))}`;

const newTabsMap = `                  {visibleTabs.map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveFilter(tab.id)}
                      onContextMenu={(e) => handleContextMenu(e, tab.id)}
                      onTouchStart={(e) => startTouchTimer(e, tab.id)}
                      onTouchEnd={clearTouchTimer}
                      onTouchMove={clearTouchTimer}
                      className={clsx(
                        'shrink-0 px-2.5 py-1 text-[11px] font-bold transition-all duration-200 select-none touch-none',
                        activeFilter === tab.id
                          ? 'bg-[#ff1493] text-white shadow-[0_0_12px_rgba(255,20,147,0.28)] rounded-md'
                          : 'bg-white/[0.16] text-white hover:bg-white/[0.25] shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] border border-white/[0.08] rounded-md'
                      )}
                    >
                      <span className="flex items-center gap-1.5 pointer-events-none">
                        {tab.label}
                        {tab.isMuted && <BellOff size={10} className="opacity-65" />}
                        {(() => {
                          const count = getTabBadgeCount(tab.id);
                          if (count <= 0) return null;
                          const displayCount = count > 99 ? '99+' : count;
                          return (
                            <span className={clsx(
                              "inline-flex items-center justify-center px-1.5 py-0.5 text-[9px] font-black rounded-sm leading-none min-w-[14px]",
                              activeFilter === tab.id
                                ? "bg-white text-[#ff1493]"
                                : "bg-white/20 text-white"
                            )}>
                              {displayCount}
                            </span>
                          );
                        })()}
                      </span>
                    </button>
                  ))}`;

if (c.includes(oldTabsMap.trim())) {
  c = c.replace(oldTabsMap.trim(), newTabsMap.trim());
} else {
  // Let's try matching with flexible whitespace
  console.log('Exact block match failed, using regex or substring replacements...');
  const marker1 = 'onContextMenu={(e) => handleContextMenu(e, tab.id)}';
  if (c.includes(marker1)) {
    console.log('Marker found! Processing replacement...');
    // We can replace the lines manually
  }
}

// 3. Replace the plus button
c = c.replace(
  'className="shrink-0 w-7 h-7 flex items-center justify-center rounded-md bg-white/[0.15] text-white/85 hover:bg-white/[0.22] hover:text-white transition-all shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] border border-white/[0.06]"',
  'className="shrink-0 w-[24px] h-[24px] flex items-center justify-center rounded-md bg-white/[0.16] text-white hover:bg-white/[0.25] transition-all shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] border border-white/[0.08]"'
);

fs.writeFileSync(filePath, c, 'utf8');
console.log('Successfully applied sizing and badge features!');
