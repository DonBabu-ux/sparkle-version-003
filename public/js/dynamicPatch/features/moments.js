// moments.js

export function initMoments() {
    // Initialization if needed
}

export function uploadMoment() {
    const modal = document.createElement('div');
    modal.className = 'modal premium-modal';
    modal.style.display = 'flex';
    modal.style.zIndex = '10001';

    modal.innerHTML = `
        <div class="modal-content premium-modal-content" style="max-width: 450px; animation: slideUp 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);">
            <div class="modal-header premium-modal-header">
                <div class="modal-title premium-modal-title">
                    <i class="fas fa-video text-primary"></i> Share a Moment
                </div>
                <button class="close-modal premium-close-btn">&times;</button>
            </div>
            <div class="modal-body premium-modal-body">
                <div class="media-upload-section" style="margin-bottom: 20px;">
                    <div class="media-upload-container" id="momentUploadArea" style="aspect-ratio: 9/16; max-height: 300px; overflow: hidden; position: relative; border: 2px dashed rgba(255, 61, 109, 0.3); border-radius: 15px; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(255, 61, 109, 0.02); transition: all 0.3s ease;">
                        <div class="upload-placeholder" id="momentPlaceholder">
                            <div class="upload-icon-circle" style="width: 60px; height: 60px; background: rgba(255, 61, 109, 0.1); color: var(--primary, #FF3D6D); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 15px; font-size: 24px;">
                                <i class="fas fa-clapperboard"></i>
                            </div>
                            <div class="upload-text" style="text-align: center;">
                                <span class="main-text" style="display: block; font-weight: 600; color: #333;">Select Short Video</span>
                                <span class="sub-text" style="display: block; font-size: 12px; color: #777;">Up to 30 seconds</span>
                            </div>
                        </div>
                        <video id="momentPreview" style="display: none; width: 100%; height: 100%; object-fit: cover; border-radius: 12px;" controls muted></video>
                        <input type="file" id="momentVideo" accept="video/*" style="display: none;">
                    </div>
                </div>

                <div class="post-input-section" style="margin-bottom: 20px;">
                    <textarea class="post-textarea" id="momentCaption" rows="2" 
                        placeholder="Write a catchy caption..." 
                        style="width: 100%; border: 1px solid #eee; border-radius: 12px; padding: 12px; font-family: inherit; resize: none; outline: none; transition: border-color 0.3s;"></textarea>
                </div>

                <div id="uploadProgressContainer" style="display: none; margin-bottom: 15px;">
                    <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 5px;">
                        <span id="uploadStatusText" style="color: #666;">Ready to upload</span>
                        <span id="uploadPercentage" style="font-weight: 600; color: var(--primary);">0%</span>
                    </div>
                    <div style="height: 6px; background: #f0f0f0; border-radius: 3px; overflow: hidden;">
                        <div id="uploadProgressBar" style="width: 0%; height: 100%; background: linear-gradient(90deg, var(--primary, #FF3D6D), var(--secondary, #833AB4)); transition: width 0.3s ease;"></div>
                    </div>
                </div>
                
                <button class="btn-premium-submit" id="uploadMomentBtn" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 10px; background: var(--primary); color: white; border: none; padding: 12px; border-radius: 8px; cursor: pointer;">
                    <span>Share Moment</span>
                    <i class="fas fa-paper-plane"></i>
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    const closeBtn = modal.querySelector('.close-modal');
    const submitBtn = modal.querySelector('#uploadMomentBtn');
    const fileInput = modal.querySelector('#momentVideo');
    const uploadArea = modal.querySelector('#momentUploadArea');
    const preview = modal.querySelector('#momentPreview');
    const placeholder = modal.querySelector('#momentPlaceholder');
    const captionInput = modal.querySelector('#momentCaption');
    const progressBar = modal.querySelector('#uploadProgressBar');
    const percentageText = modal.querySelector('#uploadPercentage');
    const statusText = modal.querySelector('#uploadStatusText');
    const progressContainer = modal.querySelector('#uploadProgressContainer');

    uploadArea.onclick = () => fileInput.click();

    fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const url = URL.createObjectURL(file);
            preview.src = url;
            preview.style.display = 'block';
            placeholder.style.display = 'none';
        }
    };

    const closeModal = () => {
        modal.classList.add('fade-out');
        setTimeout(() => { if (modal.parentNode) document.body.removeChild(modal); }, 300);
    };

    closeBtn.onclick = closeModal;
    modal.onclick = (e) => { if (e.target === modal) closeModal(); };

    submitBtn.onclick = async () => {
        const file = fileInput.files[0];
        if (!file) {
            if (window.showNotification) window.showNotification('Please select a video', 'error');
            return;
        }

        try {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span>Processing...</span> <i class="fas fa-spinner fa-spin"></i>';
            progressContainer.style.display = 'block';

            await window.DashboardAPI.createMoment({
                media: file,
                caption: captionInput.value
            });

            if (window.showNotification) window.showNotification('Moment shared!', 'success');
            closeModal();
            if (window.loadMoments) window.loadMoments();
        } catch (error) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span>Try Again</span> <i class="fas fa-redo"></i>';
            if (window.showNotification) window.showNotification('Failed to share moment', 'error');
        }
    };
}
