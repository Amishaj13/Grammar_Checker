class PopupController {
    constructor() {
        this.elements = {
            grammarToggle: document.getElementById('grammarToggle'),
            spellToggle: document.getElementById('spellToggle'),
            styleToggle: document.getElementById('styleToggle'),
            writingStyle: document.getElementById('writingStyle'),
            issuesCount: document.getElementById('issuesCount'),
            improvementsCount: document.getElementById('improvementsCount')
        };

        this.initialize();
    }

    async initialize() {
        // Load saved settings
        const settings = await this.loadSettings();
        this.applySettings(settings);

        // Load statistics
        const stats = await this.loadStatistics();
        this.updateStatistics(stats);

        // Add event listeners
        this.addEventListeners();

        // Check extension status
        this.checkStatus();
    }

    async loadSettings() {
        return new Promise((resolve) => {
            chrome.storage.sync.get({
                grammarEnabled: true,
                spellCheckEnabled: true,
                styleCheckEnabled: true,
                writingStyle: 'professional'
            }, resolve);
        });
    }

    applySettings(settings) {
        this.elements.grammarToggle.checked = settings.grammarEnabled;
        this.elements.spellToggle.checked = settings.spellCheckEnabled;
        this.elements.styleToggle.checked = settings.styleCheckEnabled;
        this.elements.writingStyle.value = settings.writingStyle;
    }

    async loadStatistics() {
        return new Promise((resolve) => {
            chrome.storage.local.get({
                dailyIssues: 0,
                improvements: 0
            }, resolve);
        });
    }

    updateStatistics(stats) {
        this.elements.issuesCount.textContent = stats.dailyIssues;
        this.elements.improvementsCount.textContent = stats.improvements;
    }

    addEventListeners() {
        // Toggle listeners
        this.elements.grammarToggle.addEventListener('change', (e) => {
            this.saveSettings({ grammarEnabled: e.target.checked });
            this.updateStatus();
        });

        this.elements.spellToggle.addEventListener('change', (e) => {
            this.saveSettings({ spellCheckEnabled: e.target.checked });
            this.updateStatus();
        });

        this.elements.styleToggle.addEventListener('change', (e) => {
            this.saveSettings({ styleCheckEnabled: e.target.checked });
            this.updateStatus();
        });

        // Writing style selector
        this.elements.writingStyle.addEventListener('change', (e) => {
            this.saveSettings({ writingStyle: e.target.value });
            this.updateStatus();
        });
    }

    async saveSettings(settings) {
        return new Promise((resolve) => {
            chrome.storage.sync.set(settings, resolve);
        });
    }

    async checkStatus() {
        try {
            const response = await fetch('http://localhost:8000/status');
            const data = await response.json();
            this.updateStatusDisplay(data.status === 'ok');
        } catch (error) {
            this.updateStatusDisplay(false);
        }
    }

    updateStatus() {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, {
                type: 'UPDATE_STATUS',
                settings: {
                    grammarEnabled: this.elements.grammarToggle.checked,
                    spellCheckEnabled: this.elements.spellToggle.checked,
                    styleCheckEnabled: this.elements.styleToggle.checked,
                    writingStyle: this.elements.writingStyle.value
                }
            });
        });
    }

    updateStatusDisplay(isActive) {
        const statusElement = document.querySelector('.status');
        if (isActive) {
            statusElement.textContent = 'Active and checking your writing';
            statusElement.style.backgroundColor = '#e8f0fe';
            statusElement.style.color = '#1a73e8';
        } else {
            statusElement.textContent = 'Service is currently unavailable';
            statusElement.style.backgroundColor = '#f8d7da';
            statusElement.style.color = '#721c24';
        }
    }
}

// Initialize popup
document.addEventListener('DOMContentLoaded', () => {
    new PopupController();
});