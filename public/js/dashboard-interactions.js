// dashboard-interactions.js

// Like toggle with animation
window.toggleLikePremium = function(postId, button) {
  const isLiked = button.classList.contains('active') || button.classList.contains('liked');
  
  // Call original logic if it exists (assuming window.toggleSpark handles API)
  if (window.toggleSpark) {
    window.toggleSpark(postId, button);
  }
  
  // Apply premium visual updates immediately
  if (!isLiked) {
    button.classList.add('active', 'liked');
    button.style.animation = 'none';
    button.offsetHeight; // trigger reflow
    button.style.animation = 'likePop 0.3s ease';
    const icon = button.querySelector('i');
    if (icon) {
      icon.classList.remove('far');
      icon.classList.add('fas');
    }
  } else {
    button.classList.remove('active', 'liked');
    const icon = button.querySelector('i');
    if (icon) {
      icon.classList.remove('fas');
      icon.classList.add('far');
    }
  }
};

// Full Screen Image Inspector (if we want the override)
window.openPremiumImageInspector = function(imageUrl) {
  const inspector = document.createElement('div');
  inspector.className = 'image-inspector';
  inspector.style.position = 'fixed';
  inspector.style.top = '0';
  inspector.style.left = '0';
  inspector.style.width = '100vw';
  inspector.style.height = '100vh';
  inspector.style.background = 'rgba(0,0,0,0.95)';
  inspector.style.zIndex = '2000';
  inspector.style.display = 'flex';
  inspector.style.alignItems = 'center';
  inspector.style.justifyContent = 'center';
  inspector.style.cursor = 'pointer';
  inspector.style.animation = 'fadeIn 0.2s ease';
  
  inspector.onclick = () => inspector.remove();
  
  const img = document.createElement('img');
  img.src = imageUrl;
  img.style.maxWidth = '90vw';
  img.style.maxHeight = '90vh';
  img.style.objectFit = 'contain';
  
  const closeBtn = document.createElement('button');
  closeBtn.className = 'inspector-close';
  closeBtn.innerHTML = '✕';
  closeBtn.style.position = 'absolute';
  closeBtn.style.top = '20px';
  closeBtn.style.right = '20px';
  closeBtn.style.background = 'white';
  closeBtn.style.border = 'none';
  closeBtn.style.width = '40px';
  closeBtn.style.height = '40px';
  closeBtn.style.borderRadius = '50%';
  closeBtn.style.fontSize = '24px';
  closeBtn.style.cursor = 'pointer';
  
  closeBtn.onclick = (e) => {
    e.stopPropagation();
    inspector.remove();
  };
  
  inspector.appendChild(img);
  inspector.appendChild(closeBtn);
  document.body.appendChild(inspector);
};
