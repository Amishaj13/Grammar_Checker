from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os
import spacy
import language_tool_python
from textblob import TextBlob
from nltk.corpus import wordnet
from gensim.models import Word2Vec
import re
from typing import List, Dict
import logging
from datetime import datetime

app = Flask(__name__)
CORS(app, resources={
    r"/*": {
        "origins": ["chrome-extension://*", "http://localhost:*"],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type"]
    }
})
logging.basicConfig(level=logging.INFO)


class GrammarChecker:
    def __init__(self):
        # Initialize NLP tools
        try:
            self.nlp = spacy.load('en_core_web_sm', disable=['ner', 'parser'])  # Disable unnecessary components
        except OSError:
            logging.error("Spacy model 'en_core_web_sm' not found. Please install it using: python -m spacy download en_core_web_sm")
            self.nlp = None
        
        try:
            self.language_tool = language_tool_python.LanguageTool('en-US')
            # Disable unnecessary rules for faster processing
            self.language_tool.disable_spellchecking()  # If you don't need spell checking
            self.language_tool.disabled_rules = set([
                'COMMA_PARENTHESIS_WHITESPACE',
                'WHITESPACE_RULE',
                'EN_QUOTES',
                'PUNCTUATION_PARAGRAPH_END'
            ])
        except:
            try:
                self.language_tool = language_tool_python.LanguageToolPublicAPI('en-US')
            except Exception as e:
                logging.error(f"Failed to initialize LanguageTool: {e}")
                self.language_tool = None
                
        self.writing_styles = {
            'professional': {
                'forbidden_words': ['stuff', 'things', 'got', 'gonna'],
                'tone_preferences': ['formal', 'precise', 'objective']
            },
            'casual': {
                'forbidden_words': [],
                'tone_preferences': ['friendly', 'conversational']
            }
        }

    def check_text(self, text: str, style: str = 'professional') -> Dict:
        """Optimized text analysis"""
        try:
            suggestions = []
            
            # Only check if text is long enough
            if len(text.strip()) < 3:
                return {'suggestions': [], 'metrics': {}}

            # Simple space-based tokenization
            tokens = text.strip().split()

            # Only perform grammar check if LanguageTool is available
            if self.language_tool:
                grammar_errors = self.language_tool.check(text)
                for error in grammar_errors:
                    if error.ruleId not in ['WHITESPACE_RULE', 'COMMA_PARENTHESIS_WHITESPACE']:
                        suggestion = {
                            'type': 'grammar' if 'SPELL' not in error.ruleId else 'spelling',
                            'message': error.message,
                            'replacements': error.replacements[:3],  # Limit replacements
                            'context': error.context,
                            'offset': error.offset,
                            'length': error.errorLength,
                            'severity': self._calculate_severity(error)
                        }
                        suggestions.append(suggestion)

            # Metrics using space-based tokens
            metrics = {
                'word_count': len(tokens),
                'sentence_count': len(text.split('.')),
                'average_token_length': sum(len(token) for token in tokens) / len(tokens) if tokens else 0,
                'unique_tokens': len(set(token.lower() for token in tokens))
            }

            return {
                'suggestions': suggestions,
                'metrics': metrics,
                'tokens': tokens[:100]  # Return first 100 tokens for reference
            }

        except Exception as e:
            logging.error(f"Error analyzing text: {str(e)}")
            return {'error': 'Analysis failed', 'details': str(e)}

    def _check_style(self, doc, style: str) -> List[Dict]:
        """Check writing style consistency"""
        style_suggestions = []
        style_config = self.writing_styles.get(style, self.writing_styles['professional'])

        for token in doc:
            if token.text.lower() in style_config['forbidden_words']:
                alternatives = self._get_alternatives(token.text)
                style_suggestions.append({
                    'type': 'style',
                    'message': f'Consider using a more {style} alternative',
                    'replacements': alternatives,
                    'context': token.sent.text,
                    'offset': token.idx,
                    'length': len(token.text),
                    'severity': 'suggestion'
                })

        return style_suggestions

    def _check_clarity(self, doc) -> List[Dict]:
        """Analyze and suggest clarity improvements"""
        clarity_suggestions = []

        for sent in doc.sents:
            # Check sentence length
            if len(sent) > 30:  # Long sentence
                clarity_suggestions.append({
                    'type': 'clarity',
                    'message': 'Consider breaking this long sentence into smaller ones',
                    'context': sent.text,
                    'offset': sent.start_char,
                    'length': len(sent.text),
                    'severity': 'suggestion'
                })

            # Check for passive voice
            if self._is_passive_voice(sent):
                clarity_suggestions.append({
                    'type': 'clarity',
                    'message': 'Consider using active voice',
                    'context': sent.text,
                    'offset': sent.start_char,
                    'length': len(sent.text),
                    'severity': 'suggestion'
                })

        return clarity_suggestions

    def _is_passive_voice(self, sent) -> bool:
        """Detect passive voice in a sentence"""
        return any(token.dep_ == 'nsubjpass' for token in sent)

    def _get_alternatives(self, word: str) -> List[str]:
        """Get word alternatives using WordNet"""
        synonyms = set()
        for syn in wordnet.synsets(word):
            for lemma in syn.lemmas():
                if lemma.name() != word:
                    synonyms.add(lemma.name())
        return list(synonyms)[:5]

    def _calculate_severity(self, error) -> str:
        """Simplified severity calculation"""
        if 'SPELL' in error.ruleId:
            return 'error'
        return 'warning'

    @staticmethod
    def _calculate_readability(text: str) -> float:
        """Calculate Flesch Reading Ease score"""
        # Implementation of readability calculation
        return 0.0

    @staticmethod
    def _calculate_avg_word_length(doc) -> float:
        """Calculate average word length"""
        words = [token.text for token in doc if not token.is_punct]
        return sum(len(word) for word in words) / len(words) if words else 0

checker = GrammarChecker()

@app.route('/favicon.ico')
def favicon():
    return send_from_directory(
        os.path.join(app.root_path, 'static'),
        'favicon.ico', 
        mimetype='image/vnd.microsoft.icon'
    )

@app.route('/')
def home():
    return jsonify({
        "status": "ok",
        "message": "Grammar checker API is running"
    })

@app.route('/check', methods=['POST'])
def check_text():
    data = request.get_json()
    text = data.get('text', '')
    start_position = data.get('startPosition', 0)
    action = data.get('action', 'input')
    
    # Initialize response with empty values
    response = {
        'suggestions': [],
        'error_count': 0
    }
    
    if text and (len(text.strip()) >= 3 or action == 'backspace'):
        try:
            results = checker.check_text(text)
            suggestions = results.get('suggestions', [])
            
            # Count all valid suggestions as errors
            total_errors = len(suggestions)
            
            response = {
                'suggestions': suggestions[:5],  # Keep top 5 suggestions
                'error_count': total_errors  # Total number of errors found
            }
            
            logging.info(f"Found {total_errors} total errors")
            
        except Exception as e:
            logging.error(f"Error processing text: {str(e)}")
            return jsonify({
                'error': 'Processing failed',
                'details': str(e)
            }), 500
    
    return jsonify(response), 200

@app.route('/status', methods=['GET'])
def status():
    return jsonify({
        "status": "ok",
        "version": "1.0",
        "timestamp": datetime.now().isoformat()
    })

if __name__ == '__main__':
    app.run(debug=True, port=8000, host='127.0.0.1')