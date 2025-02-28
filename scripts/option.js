class OptionsController {
    constructor() {
        this.elements = {
            defaultStyle: document.getElementById('defaultStyle'),
            language: document.getElementById('language'),
            customWords: document.getElementById('customWords'),
            checkFrequency: document.getElementById('checkFrequency'),
            suggestionDisplay: document.getElementById('suggestionDisplay'),
            saveButton: document.getElementById('saveSettings'),
            statusMessage: document.getElementById('statusMessage')
        };

        this.initialize();
    }

    async initialize() {
        // Load current settings
        const settings = await this.loadSettings();
        this.applySettings(settings);

        // Add event listeners
        this.addEventListeners();
    }

    async loadSettings() {
        return new Promise((resolve) => {
            chrome.storage.sync.get({
                defaultStyle: 'professional',
                language: 'en-US',
                customWords: '',
                checkFrequency: 'immediate',
                suggestionDisplay: 'inline'
            }, resolve);
        });
    }

    applySettings(settings) {
        this.elements.defaultStyle.value = settings.defaultStyle;
        this.elements.language.value = settings.language;
        this.elements.customWords.value = settings.customWords;
        this.elements.checkFrequency.value = settings.checkFrequency;
        this.elements.suggestionDisplay.value = settings.suggestionDisplay;
    }

    addEventListeners() {
        this.elements.saveButton.addEventListener('click', () => this.saveSettings());
        
        // Add input validation for custom words
        this.elements.customWords.addEventListener('input', (e) => {
            this.validateCustomWords(e.target.value);
        });
    }

    async saveSettings() {
        const settings = {
            defaultStyle: this.elements.defaultStyle.value,
            language: this.elements.language.value,
            customWords: this.elements.customWords.value.trim(),
            checkFrequency: this.elements.checkFrequency.value,
            suggestionDisplay: this.elements.suggestionDisplay.value
        };

        try {
            await this.validateSettings(settings);
            await this.persistSettings(settings);
            this.showStatusMessage('Settings saved successfully!', 'success');
            this.updateExtension(settings);
        } catch (error) {
            this.showStatusMessage(error.message, 'error');
        }
    }

    async validateSettings(settings) {
        // Validate custom words
        if (!this.validateCustomWords(settings.customWords)) {
            throw new Error('Invalid custom words format');
        }

        // Validate other settings
        const validStyles = ['professional', 'casual', 'academic'];
        const validLanguages = ['en-US', 'en-GB', 'en-AU'];
        const validFrequencies = ['immediate', 'delayed', 'manual'];
        const validDisplays = ['inline', 'sidebar', 'popup'];

        if (!validStyles.includes(settings.defaultStyle)) {
            throw new Error('Invalid writing style');
        }
        if (!validLanguages.includes(settings.language)) {
            throw new Error('Invalid language selection');
        }
        if (!validFrequencies.includes(settings.checkFrequency)) {
            throw new Error('Invalid check frequency');
        }
        if (!validDisplays.includes(settings.suggestionDisplay)) {
            throw new Error('Invalid display mode');
        }
    }

    validateCustomWords(words) {
        if (!words) return true;
        
        const lines = words.split('\n');
        const wordPattern = /^[a-zA-Z-']+$/;
        
        return lines.every(word => {
            word = word.trim();
            return !word || wordPattern.test(word);
        });
    }

    async persistSettings(settings) {
        return new Promise((resolve) => {
            chrome.storage.sync.set(settings, resolve);
        });
    }

    updateExtension(settings) {
        // Notify all tabs about the settings update
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, {
                    type: 'SETTINGS_UPDATED',
                    settings: settings
                });
            });
        });
    }

    showStatusMessage(message, type) {
        this.elements.statusMessage.textContent = message;
        this.elements.statusMessage.className = `status-message ${type}`;
        this.elements.statusMessage.style.display = 'block';

        // Hide message after 3 seconds
        setTimeout(() => {
            this.elements.statusMessage.style.display = 'none';
        }, 3000);
    }
}

// Initialize options page
document.addEventListener('DOMContentLoaded', () => {
    new OptionsController();
});