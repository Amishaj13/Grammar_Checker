let isServiceAvailable = true;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Received message:', request);
    if (request.type === 'CHECK_TEXT') {
        checkText(request.fullText, request.count || 0)
            .then(sendResponse)
            .catch(error => sendResponse({ 
                error: error.message,
                count: request.count || 0
            }));
        return true; // Will respond asynchronously
    }
});

async function checkText(text, count) {
    try {
        const response = await fetch('http://localhost:8000/check', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                count: count,
                text: text,
                checkAll: true // Request all types of checks
            })
        });
       
        if (!response.ok) {
            throw new Error('Grammar service unavailable');
        }

        const data = await response.json();
        console.log(data);
        count+=data.error_count;
        // Ensure we have a valid response structure
        return {
        
            count:count,  // Use server count or fallback to original
            suggestions: data.suggestions || []
        };
    } catch (error) {
        console.error('Error checking text:', error);
        throw error;
    }
}

function processResults(data) {
    // Combine and process all types of suggestions
    const suggestions = [];
    
    // Process grammar errors
    if (data.grammar) {
        suggestions.push(...data.grammar.map(error => ({
            ...error,
            type: 'grammar'
        })));
    }

    // Process spelling errors
    if (data.spelling) {
        suggestions.push(...data.spelling.map(error => ({
            ...error,
            type: 'spelling'
        })));
    }

    // Process style suggestions
    if (data.style) {
        suggestions.push(...data.style.map(error => ({
            ...error,
            type: 'style'
        })));
    }

    return {
        count: data.count,
        suggestions,
        metrics: data.metrics || {}
    };
}