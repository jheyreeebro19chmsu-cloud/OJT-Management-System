"""
Data validation and sanitization utilities for registration and form submission.
Enforces 25-sentence limit on text fields and prevents dirty data (XSS, SQL injection, etc.)
"""

import re
import html
from typing import Any, Dict, Optional, Tuple

SENTENCE_LIMIT = 25
SENTENCE_REGEX = re.compile(r'[.!?]+')


def count_sentences(text: str) -> int:
    """
    Count sentences in a string.
    A sentence is delimited by . ! or ?
    """
    if not text or not text.strip():
        return 0
    
    matches = SENTENCE_REGEX.findall(text)
    return len(matches)


def exceeds_sentence_limit(text: str, limit: int = SENTENCE_LIMIT) -> bool:
    """Check if text exceeds the sentence limit."""
    return count_sentences(text) > limit


def validate_sentence_limit(
    text: Optional[str],
    field_name: str,
    limit: int = SENTENCE_LIMIT
) -> Tuple[bool, Optional[str]]:
    """
    Validate that a text field does not exceed the sentence limit.
    Returns (valid: bool, error: str or None)
    """
    if not text or not text.strip():
        return True, None
    
    sentences = count_sentences(text)
    if sentences > limit:
        return False, f"{field_name} exceeds {limit} sentence limit (contains {sentences} sentences)."
    
    return True, None


def sanitize_string(value: Any) -> str:
    """
    Sanitize a string to prevent XSS and basic injection attacks.
    - Removes HTML tags and entities
    - Trims whitespace
    - Removes suspicious patterns
    """
    if not value:
        return ''
    
    clean = str(value).strip()
    
    # Decode HTML entities first
    clean = html.unescape(clean)
    
    # Remove HTML tags (even if they sneak through)
    clean = re.sub(r'<[^>]*>', '', clean)
    
    # Remove control characters (except common whitespace)
    clean = re.sub(r'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', clean)
    
    # Normalize multiple spaces/newlines
    clean = re.sub(r'\s+', ' ', clean)
    
    return clean.strip()


def sanitize_email(email: Optional[str]) -> str:
    """
    Sanitize an email address.
    - Trims whitespace
    - Converts to lowercase
    - Removes suspicious characters
    """
    if not email:
        return ''
    
    clean = str(email).strip().lower()
    
    # Remove HTML tags
    clean = re.sub(r'<[^>]*>', '', clean)
    
    # Only keep alphanumeric, common email chars
    clean = re.sub(r'[^\w.+\-@]', '', clean)
    
    # Limit to reasonable email length
    return clean[:254]


def sanitize_phone(phone: Optional[str]) -> str:
    """
    Sanitize a phone number.
    - Keeps only digits, +, -, (, ), and spaces
    - Trims whitespace
    """
    if not phone:
        return ''
    
    clean = str(phone).strip()
    
    # Remove all non-phone characters except common separators
    clean = re.sub(r'[^\d+()\-\s]', '', clean)
    
    # Remove extra spaces
    clean = re.sub(r'\s+', ' ', clean).strip()
    
    return clean[:20]  # Reasonable phone length


def sanitize_url(url: Optional[str]) -> str:
    """
    Sanitize a URL/link.
    - Trims whitespace
    - Removes dangerous protocols
    """
    if not url:
        return ''
    
    clean = str(url).strip()
    
    # Remove dangerous protocols
    if re.match(r'^(javascript|data|vbscript):', clean, re.IGNORECASE):
        return ''
    
    # Remove HTML tags
    clean = re.sub(r'<[^>]*>', '', clean)
    
    return clean.strip()[:2048]


def validate_and_sanitize_field(
    field_name: str,
    value: Any,
    required: bool = False,
    min_length: int = 0,
    max_length: int = 500,
    max_sentences: int = SENTENCE_LIMIT,
    field_type: str = 'text',
    sanitize: bool = True
) -> Tuple[str, Optional[str]]:
    """
    Validate and sanitize a single form field.
    Returns (sanitized_value: str, error: str or None)
    """
    cleaned = str(value).strip() if value else ''
    
    # Check required
    if required and not cleaned:
        return '', f"{field_name} is required."
    
    if not cleaned:
        return '', None
    
    # Sanitize based on type
    if sanitize:
        if field_type == 'email':
            cleaned = sanitize_email(cleaned)
        elif field_type == 'phone':
            cleaned = sanitize_phone(cleaned)
        elif field_type == 'url':
            cleaned = sanitize_url(cleaned)
        else:
            cleaned = sanitize_string(cleaned)
    
    # Check length
    if len(cleaned) < min_length:
        return '', f"{field_name} must be at least {min_length} characters."
    
    if len(cleaned) > max_length:
        return '', f"{field_name} must not exceed {max_length} characters."
    
    # Check sentence limit for text fields
    if field_type == 'text' and max_sentences:
        sentences = count_sentences(cleaned)
        if sentences > max_sentences:
            return '', f"{field_name} exceeds {max_sentences} sentence limit (contains {sentences} sentences)."
    
    return cleaned, None


def validate_and_sanitize_form(
    form_data: Dict[str, Any],
    field_rules: Dict[str, Dict[str, Any]]
) -> Tuple[Dict[str, Any], Optional[str]]:
    """
    Validate and sanitize an entire form object.
    Returns (sanitized_dict: dict, error: str or None)
    
    If any field fails validation, returns (partial_dict, error_message)
    """
    sanitized = {}
    
    for field_name, value in form_data.items():
        rules = field_rules.get(field_name, {})
        
        if rules:
            cleaned, error = validate_and_sanitize_field(field_name, value, **rules)
            if error:
                return sanitized, error
            sanitized[field_name] = cleaned
        else:
            # Default sanitization for unlisted fields
            sanitized[field_name] = sanitize_string(value)
    
    return sanitized, None


def validate_registration_data(form_data: Dict[str, Any], role: str) -> Tuple[Dict[str, Any], Optional[str]]:
    """
    Validate registration form data specifically.
    This is the main validation entry point for backend registration endpoints.
    
    Returns (sanitized_dict: dict, error: str or None)
    """
    field_rules = {
        'email': {'required': True, 'field_type': 'email', 'max_length': 254},
        'first_name': {'required': True, 'field_type': 'text', 'max_length': 100, 'max_sentences': 3},
        'last_name': {'required': True, 'field_type': 'text', 'max_length': 100, 'max_sentences': 3},
        'middle_name': {'field_type': 'text', 'max_length': 100, 'max_sentences': 3},
        'password': {'required': True, 'min_length': 8, 'max_length': 128},
        
        # Address fields
        'street': {'field_type': 'text', 'max_length': 200, 'max_sentences': 5},
        'barangay': {'field_type': 'text', 'max_length': 100, 'max_sentences': 3},
        'city': {'field_type': 'text', 'max_length': 100, 'max_sentences': 3},
        'province': {'field_type': 'text', 'max_length': 100, 'max_sentences': 3},
        'region': {'field_type': 'text', 'max_length': 100, 'max_sentences': 3},
        
        # Company/HTE fields
        'company_name': {'field_type': 'text', 'max_length': 255, 'max_sentences': 5},
        'company_address': {'field_type': 'text', 'max_length': 500, 'max_sentences': 10},
        'contact_person': {'field_type': 'text', 'max_length': 200, 'max_sentences': 3},
        'contact_phone': {'field_type': 'phone', 'max_length': 20},
        
        # School/Academic fields
        'school_name': {'field_type': 'text', 'max_length': 255, 'max_sentences': 5},
        'campus': {'field_type': 'text', 'max_length': 200, 'max_sentences': 3},
        'course': {'field_type': 'text', 'max_length': 200, 'max_sentences': 3},
        'department': {'field_type': 'text', 'max_length': 200, 'max_sentences': 3},
        
        # Employment fields
        'supervisor_name': {'field_type': 'text', 'max_length': 200, 'max_sentences': 3},
        'position': {'field_type': 'text', 'max_length': 200, 'max_sentences': 3},
        'employee_id': {'field_type': 'text', 'max_length': 50},
        
        # Other optional fields
        'instructor_email': {'field_type': 'email', 'max_length': 254},
        'username': {'field_type': 'text', 'max_length': 150},
        'age': {'field_type': 'text', 'max_length': 3},
        'address': {'field_type': 'text', 'max_length': 500, 'max_sentences': 10},
    }
    
    return validate_and_sanitize_form(form_data, field_rules)
