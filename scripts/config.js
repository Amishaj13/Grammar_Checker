const CONFIG = {
    API_URL: 'http://localhost:8000',
    ERROR_TYPES: {
        SPELLING: {
            color: '#dc3545',
            backgroundColor: 'rgba(220, 53, 69, 0.2)'
        },
        GRAMMAR: {
            color: '#28a745',
            backgroundColor: 'rgba(40, 167, 69, 0.2)'
        },
        STYLE: {
            color: '#17a2b8',
            backgroundColor: 'rgba(23, 162, 184, 0.2)'
        }
    },
    CHECK_DELAY: 1000, // Delay before checking text (ms)
    MAX_SUGGESTIONS: 5 // Maximum number of suggestions to show
};

export default CONFIG;
