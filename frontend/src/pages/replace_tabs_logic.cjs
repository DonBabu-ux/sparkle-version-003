const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'Messages.tsx');
let c = fs.readFileSync(filePath, 'utf8');

const mapStartStr = '{visibleTabs.map(tab => (';
const mapStartIndex = c.indexOf(mapStartStr);

if (mapStartIndex === -1) {
  console.error('Could not find visibleTabs.map definition!');
  process.exit(1);
}

// Find the closing parent-bracket sequence "  }))"
const searchArea = c.slice(mapStartIndex);
const mapEndOffset = searchArea.indexOf('                  ))}');

if (mapEndOffset === -1) {
  console.error('Could not find closing brackets sequence!');
  process.exit(1);
}

const totalEndIndex = mapStartIndex + mapEndOffset + '                  ))}'.length;

const newTabsMapCode = `{visibleTabs.map(tab => (
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

c = c.slice(0, mapStartIndex) + newTabsMapCode + c.slice(totalEndIndex);

fs.writeFileSync(filePath, c, 'utf8');
console.log('Successfully replaced visibleTabs loop!');
