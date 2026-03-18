// fab-button.js

export function initFabButton() {
    injectCreateButton();
}

function injectCreateButton() {
    if (document.getElementById('globalCreateBtn')) return;

    // Only show on marketplace pages
    const isMarketplace = window.location.pathname.startsWith('/marketplace');
    if (!isMarketplace) return;

    const fab = document.createElement('div');
    fab.id = 'globalCreateBtn';
    fab.style.cssText = `
        position: fixed;
        bottom: 80px;
        right: 20px;
        width: 60px;
        height: 60px;
        background: linear-gradient(45deg, var(--primary, #FF3D6D), var(--secondary, #833AB4));
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 24px;
        box-shadow: 0 4px 10px rgba(0,0,0,0.3);
        cursor: pointer;
        z-index: 9999;
        transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    `;
    fab.innerHTML = '<i class="fas fa-plus"></i>';
    fab.onmouseover = () => fab.style.transform = 'scale(1.1)';
    fab.onmouseout = () => fab.style.transform = 'scale(1)';
    fab.onclick = showCreateOptions;

    document.body.appendChild(fab);
}

export function showCreateOptions() {
    const isMobile = window.innerWidth <= 768;

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.cssText = `
        display: flex;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(5px);
        z-index: 10000;
        align-items: ${isMobile ? 'flex-end' : 'center'};
        justify-content: center;
    `;

    modal.innerHTML = `
        <div class="modal-content" style="
            width: 100%; 
            max-width: ${isMobile ? '100%' : '500px'}; 
            background: white;
            border-radius: ${isMobile ? '20px 20px 0 0' : '20px'}; 
            margin: 0; 
            animation: slideUp 0.3s ease;
            box-shadow: 0 -4px 20px rgba(0,0,0,0.15);
        ">
            <div style="text-align:center; padding: 15px; border-bottom:1px solid #eee; margin-bottom:15px;">
                ${isMobile ? '<div style="width: 40px; height: 4px; background: #ddd; border-radius: 2px; margin: 0 auto;"></div>' : ''}
                <div style="font-size: 16px; font-weight: 600; color: #333; margin-top: ${isMobile ? '8px' : '10px'};">Create Something Amazing</div>
            </div>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; padding: 0 20px 20px;">
                <div id="newPostOption" class="create-option-card" style="
                    background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
                    padding: 20px 10px; border-radius: 16px; text-align: center; cursor: pointer; border: 2px solid transparent; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                ">
                    <div style="width: 50px; height: 50px; background: #2196f3; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; font-size: 22px;">
                        <i class="fas fa-pen"></i>
                    </div>
                    <div style="font-weight: 700; font-size: 14px; color: #1976d2; margin-bottom: 4px;">Post</div>
                </div>
                <div id="newMomentOption" class="create-option-card" style="
                    background: linear-gradient(135deg, #fce4ec 0%, #f8bbd0 100%);
                    padding: 20px 10px; border-radius: 16px; text-align: center; cursor: pointer; border: 2px solid transparent; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                ">
                    <div style="width: 50px; height: 50px; background: #e91e63; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; font-size: 22px;">
                        <i class="fas fa-video"></i>
                    </div>
                    <div style="font-weight: 700; font-size: 14px; color: #c2185b; margin-bottom: 4px;">Moment</div>
                </div>
                <div id="newAfterglowOption" class="create-option-card" style="
                    background: linear-gradient(135deg, #f3e5f5 0%, #e1bee7 100%);
                    padding: 20px 10px; border-radius: 16px; text-align: center; cursor: pointer; border: 2px solid transparent; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                ">
                    <div style="width: 50px; height: 50px; background: linear-gradient(135deg, #9c27b0, #e91e63); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; font-size: 22px;">
                        <i class="fas fa-bolt"></i>
                    </div>
                    <div style="font-weight: 700; font-size: 14px; color: #7b1fa2; margin-bottom: 4px;">AfterGlow</div>
                </div>
            </div>
            <button class="btn btn-block" style="background: none; color: #666; padding: 15px; border: none; font-size: 15px; cursor: pointer; border-top: 1px solid #eee;" id="cancelCreate">Cancel</button>
        </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#newPostOption').onclick = () => {
        modal.remove();
        if (window.showCreatePostModal) window.showCreatePostModal();
    };

    modal.querySelector('#newMomentOption').onclick = () => {
        modal.remove();
        if (window.uploadMoment) window.uploadMoment();
    };

    modal.querySelector('#newAfterglowOption').onclick = () => {
        modal.remove();
        if (window.uploadAfterglowMedia) window.uploadAfterglowMedia();
    };

    modal.querySelector('#cancelCreate').onclick = () => modal.remove();
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
}
