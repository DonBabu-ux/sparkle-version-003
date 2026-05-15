const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/pages/Moments.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const marker = '</AnimatePresence>';
const afterMarker = '{fetchingMore && (';

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
`;

const lines = content.split('\n');
const markerIdx = lines.findIndex(l => l.includes(marker));
const afterMarkerIdx = lines.findIndex((l, i) => i > markerIdx && l.includes(afterMarker));

if (markerIdx !== -1 && afterMarkerIdx !== -1) {
    const newLines = [
        ...lines.slice(0, markerIdx + 1),
        insertion,
        ...lines.slice(afterMarkerIdx)
    ];
    fs.writeFileSync(filePath, newLines.join('\n'));
    console.log('✅ File repaired successfully');
} else {
    console.log('❌ Could not find markers', { markerIdx, afterMarkerIdx });
}
