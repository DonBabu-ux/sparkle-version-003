const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/pages/Moments.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const marker = '</AnimatePresence>';
const endMarker = ')}'; // The closing of the old ternary

const insertion = `
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-scroll snap-y snap-mandatory no-scrollbar bg-black"
        onScroll={handleScroll}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {loading ? (
             <div className="h-screen flex flex-col items-center justify-center bg-black">
                <div className="relative mb-24 scale-150">
                  <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full animate-pulse" />
                  <TikTokLoader />
                </div>
                <div className="flex flex-col items-center gap-4">
                  <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.5em] italic animate-pulse">Establishing Secure Stream</p>
                  <div className="w-24 h-[1px] bg-white/10 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-primary" 
                      initial={{ x: "-100%" }} 
                      animate={{ x: "100%" }} 
                      transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }} 
                    />
                  </div>
                </div>
             </div>
        ) : moments.length === 0 && !loading ? (
            <div className="h-full flex items-center justify-center p-6 lg:ml-72">
                <ModernOfflineState 
                    type={isFallback ? "error" : "empty"}
                    title={isFallback ? "Network Hiccup" : "Fresh Feed Incoming"}
                    message={isFallback 
                        ? "We're having trouble reaching the main campus stream. Try refreshing your connection!"
                        : "You've caught up with everything on campus! Check back in a bit for new sparks."
                    }
                    onRetry={() => fetchMoments(0)}
                />
            </div>
        ) : (
            moments.map((m, idx) => (
              <div key={m.moment_id} className="h-full w-full snap-start snap-always flex items-center justify-center lg:pl-72 relative overflow-hidden">
                <ReelItem 
                   active={idx === activeIndex}
                   isNearActive={Math.abs(idx - activeIndex) <= 1}
                   moment={m} 
                   onLike={handleLike} 
                   onSave={handleSave}
                   onOpenComments={openComments}
                   onShare={setMomentToShare}
                   onOpenSearch={() => setIsSearchOpen(true)}
                   onFollow={handleFollow}
                   downloadProgress={downloadProgress?.id === m.moment_id ? downloadProgress.progress : null}
                   currentUser={user}
                />
              </div>
            ))
        )}

        {fetchingMore && (
          <div className="h-full w-full snap-start flex items-center justify-center px-0 md:px-10 pt-0 md:pt-20 pb-12 md:pb-20 lg:ml-72 transition-all overflow-hidden relative">
            <div className="flex flex-col items-center gap-6">
              <TikTokLoader />
              <p className="text-[10px] font-black text-black/20 uppercase tracking-[0.3em] animate-pulse">Syncing Stream</p>
            </div>
          </div>
        )}
      </div>
`;

// Find the section between AnimatePresence and the first closing brace that ends the broken ternary
const lines = content.split('\n');
const startIdx = lines.findIndex(l => l.includes(marker));
const endIdx = lines.findIndex((l, i) => i > startIdx && l.includes(')}'));

if (startIdx !== -1 && endIdx !== -1) {
    const newLines = [
        ...lines.slice(0, startIdx + 1),
        insertion,
        ...lines.slice(endIdx + 1)
    ];
    fs.writeFileSync(filePath, newLines.join('\n'));
    console.log('✅ File repaired successfully');
} else {
    console.log('❌ Could not find markers', { startIdx, endIdx });
}
