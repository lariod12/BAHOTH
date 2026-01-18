"""
MCP Tools for querying translation/rules data.
"""

from typing import Any
from ..data_loader import get_translations_data


def translate_term(term: str, to_lang: str = "en") -> dict | None:
    """
    Translate a game term between Vietnamese and English.

    Args:
        term: The term to translate (case-insensitive).
        to_lang: Target language ("en" for English, "vi" for Vietnamese).

    Returns:
        Dict with original term, translation, and category if found.
    """
    data = get_translations_data()
    sections = data.get("TRANSLATION_SECTIONS", [])
    term_lower = term.lower()

    for section in sections:
        for entry in section.get("entries", []):
            vi_term = entry.get("vi", "").lower()
            en_term = entry.get("en", "").lower()

            if term_lower == vi_term or term_lower == en_term:
                return {
                    "original": term,
                    "vi": entry.get("vi"),
                    "en": entry.get("en"),
                    "category": section.get("title"),
                    "categoryId": section.get("id"),
                }

    return None


def get_trait_translation(trait: str) -> dict | None:
    """
    Get translation for a trait name specifically.

    Args:
        trait: Trait name in any language (Speed, Might, Sanity, Knowledge).

    Returns:
        Dict with Vietnamese and English names.
    """
    data = get_translations_data()
    sections = data.get("TRANSLATION_SECTIONS", [])

    # Find traits section
    for section in sections:
        if section.get("id") == "traits":
            trait_lower = trait.lower()
            for entry in section.get("entries", []):
                vi_term = entry.get("vi", "").lower()
                en_term = entry.get("en", "").lower()

                if trait_lower == vi_term or trait_lower == en_term:
                    return {
                        "vi": entry.get("vi"),
                        "en": entry.get("en"),
                    }

    return None


def get_all_translations() -> dict:
    """
    Get all translation sections and entries.

    Returns:
        Dict with all translation categories and their entries.
    """
    data = get_translations_data()
    sections = data.get("TRANSLATION_SECTIONS", [])

    result = {}
    for section in sections:
        section_id = section.get("id")
        result[section_id] = {
            "title": section.get("title"),
            "entries": section.get("entries", []),
        }

    return result


def get_translations_by_category(category_id: str) -> list[dict]:
    """
    Get all translations in a specific category.

    Args:
        category_id: The category ID ("traits", "items", "omens", "rooms").

    Returns:
        List of translation entries in that category.
    """
    data = get_translations_data()
    sections = data.get("TRANSLATION_SECTIONS", [])

    for section in sections:
        if section.get("id") == category_id:
            return section.get("entries", [])

    return []
