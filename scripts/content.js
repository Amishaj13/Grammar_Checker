class GrammarChecker {
    static count = 0;
    constructor() {

        console.log('GrammarChecker constructor called');
        this.widget = null;
        this.activeElement = null;
        this.checkTimeout = null;
        this.observer = null;
        this.resizeTimeout = null;
        this.lastCheck = Date.now();
        this.minCheckInterval = 250; // Minimum time between checks in ms
        this.currentElement = null;
        this.debounceTimeout = null;
        this.pendingCheck = null;
        this.finalCount = 0;
        this.DEBOUNCE_DELAY = 500; // Reduced debounce time
        this.errorCount = 0;
        this.lastCheckedText = '';
        this.activeHighlights = new Map(); // Track active highlights
        this.errorTypes = {
            SPELLING: {
                color: '#dc3545',
                class: 'spelling-error',
                // background: 'rgba(235, 77, 75, 0.12)',
                // borderBottom: '2px solid #EB4D4B'
                
            },
            GRAMMAR: {
                color: '#0d6efd',
                class: 'grammar-error',
                // background: 'rgba(21, 195, 154, 0.12)',
                // borderBottom: '2px solid #130ce0'
            },
            STYLE: {
                color: '#17a2b8',
                class: 'style-error',
                // background: 'rgba(55, 125, 255, 0.12)',
                // borderBottom: '2px solid #e1a115'
            }
        };
        this.initializeWidget();
        this.initializeTextTracking();
        this.initializeFloatingButton();
        console.log('GrammarChecker initialized');
    }

    initializeWidget() {
        console.log('Initializing widget');
        if (!this.widget) {
            this.widget = document.createElement('div');
            this.widget.className = 'grammar-check-widget';
            this.widget.innerHTML = this.createWidgetHTML();
            document.body.appendChild(this.widget);
            console.log('Widget created and added to DOM');

            // Add event listeners AFTER creating the elements
            this.widget.addEventListener('click', this.handleWidgetClick.bind(this));
            
            const closeButton = this.widget.querySelector('.close-button');
            if (closeButton) {
                closeButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.widget.classList.add('hidden');
                    this.hideWidget();
                    this.hideSuggestionsPanel();
                });
            } else {
                console.error('Close button not found in widget');
            }
        } else {
            console.log('Widget already initialized');
        }
    }

    createWidgetHTML() {
        return `
            <div class="grammar-widget">
                <div class="widget-header">
                    <div class="widget-logo">G</div>
                    <div class="widget-title">
                        Errors: <span class="error-count">0</span>
                    </div>
                    <div class="widget-controls">
                        <div class="close-button">✕</div>
                    </div>
                </div>
                
                <div class="suggestions-container">
                    <div class="suggestions-header">
                        <h3>Review suggestions <span class="suggestion-count">0</span></h3>
                        <button class="show-more">Show more</button>
                    </div>
                    
                    <div class="suggestions-list">
                        <!-- Suggestions will be dynamically added here -->
                    </div>


                    <div class="tone-checker">
                        <button class="tone-btn">
                            👍 Check my tone
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    initializeTextTracking() {
        console.log('Initializing text tracking...');
        
        // Listen for input events (typing)
        document.addEventListener('input', (event) => {
            console.log('Input event detected');
            const target = event.target;
            
            if (this.isEditableElement(target)) {
                console.log('Editable element detected, checking text immediately');

                // Get the current text from the target element
                const text = this.getTextFromElement(target);
                this.currentElement = target;

                // Check if there's existing text
                if (text && text.trim().length > 0) {
                    console.log('Checking text on input:', text);
                    this.checkText(text); // Check the text immediately
                } else {
                    this.updateCounts(0);
                    this.widget.classList.add('hidden');
                }
            }
        });

        // Listen for focus events
        document.addEventListener('focus', (event) => {
            const target = event.target;
            console.log('Focus event on:', target.tagName);
            
            if (this.isEditableElement(target)) {
                this.currentElement = target;
                // Only check if there's existing text when focusing
                const text = this.getTextFromElement(target);
                if (text && text.trim().length > 0) {
                    console.log('Checking existing text on focus');
                    this.checkText(text);
                }
            }
        }, true);

        console.log('Text tracking initialized');
    }
        
    handleWidgetClick() {
        this.toggleSuggestionsPanel();
    }

    async checkText(text) {
        if (!text?.trim()) {
            this.updateCounts(0);
            this.updateSuggestions([]);
            return;
        }

        try {
            // Find the new text portion
            const newTextPortion = this.getNewTextPortion(text);
            
            if (!newTextPortion) {
                return; // No new text to check
            }

            const response = await chrome.runtime.sendMessage({
                type: 'CHECK_TEXT',
                text: newTextPortion,
                fullText: text
            });

            if (response?.error) {
                console.error('Error in grammar check response:', response.error);
                return;
            }

            // Ensure each suggestion has an id
            const suggestionsWithId = response.suggestions.map((suggestion, index) => ({
                ...suggestion,
                id: suggestion.id || index // Assign a unique id if not present
            }));

            // Update last checked text after successful check
            this.lastCheckedText = text;
            
            // Update UI with new count
            this.updateCounts(response.count || 0);
            this.updateSuggestions(response.suggestions || []);
            
            // Call highlightTextErrors with the received suggestions
           
        } catch (error) {
            console.error('Error during grammar check:', error);
        }
    }

    getNewTextPortion(currentText) {
        if (!this.lastCheckedText) {
            return currentText;
        }

        // Find the different portion between current and last checked text
        let i = 0;
        const minLength = Math.min(currentText.length, this.lastCheckedText.length);
        
        // Find where the texts start to differ
        while (i < minLength && currentText[i] === this.lastCheckedText[i]) {
            i++;
        }

        // Get the new portion of text
        const newPortion = currentText.slice(i);
        
        // Only return if new portion is substantial enough
        return newPortion.length >= 3 ? newPortion : '';
    }

    updateCounts(count) {
        // Ensure elements exist before updating
        if (!this.widget || !this.floatingButton) {
            console.warn('Widget or floating button not initialized');
            return;
        }

        try {
            const errorCount = this.widget.querySelector('.error-count');
            const suggestionCount = this.widget.querySelector('.suggestion-count');
            const floatingButtonCount = this.floatingButton.querySelector('.error-count-circle');

            if (errorCount && suggestionCount && floatingButtonCount) {
                const countValue = count === '...' ? '...' : count.toString();
                errorCount.textContent = countValue;
                suggestionCount.textContent = countValue;
                floatingButtonCount.textContent = countValue;
                this.finalCount = count;
            }
        } catch (error) {
            console.error('Error updating counts:', error);
        }
    }

   

    applyCorrection(suggestion, correction) {
        const text = this.getTextFromElement(this.currentElement);
        // const before = text.substring(0, suggestion.offset);
        // const after = text.substring(suggestion.offset + suggestion.length);
        // const newText = before + correction + after;
        const newText = correction ;
        
        if (this.currentElement.isContentEditable) {
            this.currentElement.textContent = newText;
        } else {
            this.currentElement.value = newText;
        }
        
        // Trigger recheck
        this.checkText(newText);
    }

    getErrorClass(type) {
        return this.errorTypes[type]?.class || 'unknown-error';
    }

    getErrorTypeText(type) {
        const types = {
            SPELLING: 'Spelling mistake',
            GRAMMAR: 'Grammar mistake'
        };
        return types[type] || 'Writing suggestion';
    }

    
    addSuggestionListener(element) {
        const suggestions = JSON.parse(element.getAttribute('data-suggestions'));
        
        element.addEventListener('mouseover', () => {
            const tooltip = document.createElement('div');
            tooltip.className = 'suggestion-tooltip';
            tooltip.innerHTML = suggestions.map(suggestion => 
                `<div class="suggestion-item">${suggestion}</div>`
            ).join('');
            
            element.appendChild(tooltip);
        });

        element.addEventListener('mouseout', () => {
            const tooltip = element.querySelector('.suggestion-tooltip');
            if (tooltip) tooltip.remove();
        });
    }

    isTextInput(element) {
        return element.isContentEditable || 
               element.tagName === 'TEXTAREA' || 
               (element.tagName === 'INPUT' && element.type === 'text');
    }

    showWidget() {
        if (this.widget) {
            this.widget.style.display = 'block'; // Show the widget
            console.log('Widget shown');
        }
    }

    hideWidget() {
        if (this.widget) {
            this.widget.style.display = 'none'; // Hide the widget
            console.log('Widget hidden');
        }
    }

    toggleSuggestionsPanel() {
        const panel = this.widget.querySelector('.suggestions-container');
        panel.classList.remove('hidden');
    }

    hideSuggestionsPanel() {
        const panel = this.widget.querySelector('.suggestions-container');
        panel.classList.add('hidden');
    }

    updateSuggestions(suggestions) {
        const container = this.widget.querySelector('.suggestions-list');
        container.innerHTML = '';

        suggestions.forEach((suggestion, index) => {
            const element = document.createElement('div');
            element.className = 'suggestion-item';
            element.innerHTML = `
                <div class="suggestion-type">${suggestion.type}</div>
                <div class="suggestion-message">${suggestion.message}</div>
                <div class="suggestion-replacements">
                    ${suggestion.replacements.map(r => 
                        `<button class="replacement-btn">${r}</button>`
                    ).join('')}
                </div>
            `;

            element.querySelectorAll('.replacement-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    this.applySuggestion(suggestion, btn.textContent);
                });
            });

            container.appendChild(element);
        });
    }

    applySuggestion(suggestion, replacement) {
        const text = this.getTextFromElement(this.currentElement);
        const newText = text.substring(0, suggestion.offset) + 
                       replacement + 
                       text.substring(suggestion.offset + suggestion.length);
        
        if (this.currentElement.isContentEditable) {
            this.currentElement.textContent = newText;
        } else {
            this.currentElement.value = newText;
        }

        this.updateCounts(--this.finalCount);
        this.checkText(newText);
    }

    isEditableElement(element) {
        const isEditable = (
            element.isContentEditable ||
            element.tagName === 'TEXTAREA' ||
            (element.tagName === 'INPUT' && 
             ['text', 'search', 'url', 'email', 'tel'].includes(element.type))
        );
        
        if (isEditable) {
            console.log('Editable element found:', element.tagName);
        }
        
        return isEditable;
    }

    getTextFromElement(element) {
        let text = '';
        
        try {
            if (element.isContentEditable) {
                text = element.innerText;
            } else {
                text = element.value;
            }
            
            console.log('Got text from element:', {
                elementType: element.tagName,
                textLength: text.length,
                preview: text.substring(0, 30) + '...'
            });
            
        } catch (error) {
            console.error('Error getting text from element:', error);
        }
        
        return text;
    }
      
    initializeFloatingButton() {
        this.floatingButton = document.createElement('div');
        this.floatingButton.className = 'grammar-check-button';
        this.floatingButton.innerHTML = `
            <div class="error-count-circle">0</div>
        `;
        document.body.appendChild(this.floatingButton);
        
        // Add click handler for floating button
        this.floatingButton.addEventListener('click', () => {
            if (this.widget) {
                this.widget.classList.remove('hidden');
                this.widget.style.display = 'block';  // Ensure visibility
                // this.updateWidgetPosition();
                const suggestionsContainer = this.widget.querySelector('.suggestions-container');
                if (suggestionsContainer) {
                    suggestionsContainer.classList.remove('hidden');
                }
            }
        });
    }

}

// Initialize the grammar checker
new GrammarChecker();

// Initialize the checker when the page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('Page loaded, initializing GrammarChecker');
    window.grammarChecker = new GrammarChecker();
});

document.body.querySelector('.grammar-check-button').addEventListener('click', () => {
    console.log("BUTTON CLICKED!!")
    // window.grammarChecker = new GrammarChecker();
    if (GrammarChecker.widget) {
        GrammarChecker.widget.classList.remove('hidden');
        GrammarChecker.widget.style.display = 'block';  // Ensure visibility
        // this.updateWidgetPosition();
        const suggestionsContainer = GrammarChecker.widget.querySelector('.suggestions-container');
        if (suggestionsContainer) {
            suggestionsContainer.classList.remove('hidden');
        }
    }else{
        console.log("widget not intialized")
    }
 });