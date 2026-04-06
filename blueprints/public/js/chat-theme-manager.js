/**
 * Sparkle Chat Theme Manager
 * Handles dynamic theming, persistence, and viewport behavior.
 */

class ThemeManager {
    constructor() {
        this.currentThemeId = 'classic_doodle';
        this.themes = window.chatThemes || [];
        this.init();
    }

    init() {
        // Load theme: 1. Server-rendered, 2. LocalStorage, 3. Default
        const serverTheme = window.currentUser?.chat_theme;
        const savedTheme = localStorage.getItem('spark_chat_theme');
        
        if (serverTheme && serverTheme !== 'default') {
            this.applyTheme(serverTheme, false);
        } else if (savedTheme) {
            this.applyTheme(savedTheme, false);
        }

        // Viewport Height Fix for Mobile
        this.updateViewportHeight();
        window.addEventListener('resize', () => this.updateViewportHeight());

        // Keyboard Behavior
        if ('visualViewport' in window) {
            window.visualViewport.addEventListener('resize', () => this.handleVisualViewportChange());
        }
    }

    updateViewportHeight() {
        let vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
    }

    handleVisualViewportChange() {
        const vv = window.visualViewport;
        const offset = window.innerHeight - vv.height;
        
        // Push the main layout up by the keyboard height
        const messagingLayout = document.querySelector('.messaging-layout');
        if (messagingLayout) {
            messagingLayout.style.height = `${vv.height}px`;
            // Scroll to bottom when keyboard appears
            if (offset > 0) {
                setTimeout(() => {
                    const container = document.getElementById('messagesContainer');
                    if (container) container.scrollTop = container.scrollHeight;
                }, 100);
            }
        }
    }

    openThemePanel() {
        let panel = document.getElementById('themePanel');
        if (!panel) {
            this.createThemePanel();
            panel = document.getElementById('themePanel');
        }
        panel.style.display = 'flex';
        this.renderThemes();
    }

    closeThemePanel() {
        const panel = document.getElementById('themePanel');
        if (panel) panel.style.display = 'none';
    }

    createThemePanel() {
        const panelHtml = `
            <div id="themePanel" class="theme-panel-overlay" onclick="sparkThemes.closeThemePanel()">
                <div class="theme-panel" onclick="event.stopPropagation()">
                    <header class="theme-panel-header">
                        <i class="bi bi-arrow-left" onclick="sparkThemes.closeThemePanel()" style="cursor:pointer; font-size:20px;"></i>
                        <h3>Chat Themes</h3>
                    </header>
                    <div class="theme-panel-content" id="themePanelContent">
                        <!-- Themes injected here -->
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', panelHtml);
    }

    renderThemes() {
        const content = document.getElementById('themePanelContent');
        if (!content) return;

        const categories = {
            'default': 'Default',
            'soft': 'Soft Themes',
            'hard': 'Hard Themes',
            'bright': 'Bright Themes',
            'solid': 'Solid Themes',
            'nature': 'Nature & Weather',
            'heritage_nature': 'Nature Heritage'
        };

        let html = '';
        for (const [catId, catName] of Object.entries(categories)) {
            const catThemes = this.themes.filter(t => t.category === catId);
            if (catThemes.length === 0) continue;

            html += `
                <div class="theme-category-section">
                    <h4 class="theme-category-title">${catName}</h4>
                    <div class="theme-grid">
                        ${catThemes.map(theme => `
                            <div class="theme-card ${theme.id === this.currentThemeId ? 'active' : ''}" 
                                 onclick="sparkThemes.applyTheme('${theme.id}')"
                                 style="background-color: ${theme.bgColor.includes('gradient') ? 'transparent' : theme.bgColor}; background-image: ${theme.imageBg ? `url('${theme.imageBg}')` : (theme.bgColor.includes('gradient') ? theme.bgColor : 'none')};">
                                <div class="theme-card-preview">
                                    <div class="preview-bubble received" style="background: ${theme.bubbleReceived};"></div>
                                    <div class="preview-bubble sent" style="background: ${theme.bubbleSent};"></div>
                                </div>
                                <span class="theme-name">${theme.name}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
        content.innerHTML = html;
    }

    applyTheme(themeId, save = true) {
        const theme = this.themes.find(t => t.id === themeId);
        if (!theme) return;

        const root = document.documentElement;
        const container = document.getElementById('messagesContainer');
        
        if (container) container.classList.add('switching');

        // Apply CSS Variables
        root.style.setProperty('--chat-bg-color', theme.bgColor);
        root.style.setProperty('--chat-bubble-sent', theme.bubbleSent);
        root.style.setProperty('--chat-bubble-received', theme.bubbleReceived);
        root.style.setProperty('--chat-text-primary', theme.textColor);
        root.style.setProperty('--chat-text-secondary', theme.secondaryText || '#8696a0');
        root.style.setProperty('--chat-input-bg', theme.inputBg || '#2a3942');
        
        if (theme.imageBg) {
            root.style.setProperty('--chat-pattern-url', `url(${theme.imageBg})`);
            root.style.setProperty('--chat-pattern-opacity', theme.patternOpacity || '1');
            root.style.setProperty('--chat-pattern-size', 'cover');
            root.style.setProperty('--chat-pattern-repeat', 'no-repeat');
        } else {
            root.style.setProperty('--chat-pattern-url', theme.pattern ? `url(${theme.pattern})` : 'none');
            root.style.setProperty('--chat-pattern-opacity', theme.patternOpacity || (theme.pattern ? 0.08 : 0));
            root.style.setProperty('--chat-pattern-size', '400px');
            root.style.setProperty('--chat-pattern-repeat', 'repeat');
        }

        // Dark/Light Header Logic
        const isLight = this.isColorLight(theme.bgColor);
        root.style.setProperty('--chat-header-bg', isLight ? '#f0f2f5' : '#202c33');
        root.style.setProperty('--chat-header-text', isLight ? '#111b21' : '#e9edef');

        this.currentThemeId = themeId;

        if (save) {
            localStorage.setItem('spark_chat_theme', themeId);
            this.saveThemeToServer(themeId);
        }

        setTimeout(() => {
            if (container) container.classList.remove('switching');
            this.renderThemes();
        }, 300);
    }

    isColorLight(color) {
        if (!color || color.includes('gradient')) return false;
        const hex = color.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        return brightness > 155;
    }

    async saveThemeToServer(themeId) {
        try {
            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;
            await fetch('/api/users/settings', {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken
                },
                body: JSON.stringify({ chat_theme: themeId })
            });
        } catch (err) {
            console.error('Failed to save theme to server:', err);
        }
    }
}

// Initializer
window.sparkThemes = new ThemeManager();

// Global handle for settings toggle
function openChatCustomization() {
    sparkThemes.openThemePanel();
}
