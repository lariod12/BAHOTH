"""
Interactive CLI agent for Chat Completions API.
API endpoint: http://localhost:8317/v1/chat/completions
"""

import json
import os
import sys
from pathlib import Path

import requests
from dotenv import load_dotenv


API_URL = os.getenv("API_URL", "http://localhost:8317/v1/chat/completions")
MODELS_URL = os.getenv("MODELS_URL", "http://localhost:8317/v1/models")


def load_env():
    """Load environment variables from .env next to this file."""

    script_dir = Path(__file__).parent
    env_path = script_dir / ".env"

    # utf-8-sig handles BOM (common on Windows)
    load_dotenv(dotenv_path=env_path, override=True, encoding="utf-8-sig")

    api_key = os.getenv("API_KEY")
    use_auth = os.getenv("USE_AUTH", "true").strip().lower() in {"1", "true", "yes", "y"}
    model_name = os.getenv("MODEL_NAME", "gemini-3-flash-preview")

    # Extra safety: if .env was read with BOM and python-dotenv didn't pick it up
    if not api_key and env_path.exists():
        try:
            content = env_path.read_text(encoding="utf-8")
            for line in content.splitlines():
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, value = line.split("=", 1)
                key = key.lstrip("\ufeff").strip()
                if key == "API_KEY":
                    api_key = value.strip()
                    break
        except Exception:
            pass

    return api_key, use_auth, model_name, env_path


def build_headers(api_key: str | None, use_auth: bool) -> dict:
    headers = {"Content-Type": "application/json"}
    if use_auth and api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    return headers


def extract_assistant_text(data: dict) -> str:
    """
    Try OpenAI-compatible shapes:
      - choices[0].message.content
      - choices[0].text
    """

    choices = data.get("choices") or []
    if not choices:
        return json.dumps(data, ensure_ascii=False)

    first = choices[0] or {}
    msg = first.get("message") or {}
    content = msg.get("content")
    if isinstance(content, str) and content.strip():
        return content

    text = first.get("text")
    if isinstance(text, str) and text.strip():
        return text

    return json.dumps(data, ensure_ascii=False)


def maybe_print_available_models(headers: dict):
    try:
        resp = requests.get(MODELS_URL, headers=headers, timeout=5)
        if resp.status_code != 200:
            return
        data = resp.json()
        print("\nAvailable models:")
        print(json.dumps(data, indent=2, ensure_ascii=False))
    except Exception:
        return


def run_agent():
    api_key, use_auth, model_name, env_path = load_env()
    headers = build_headers(api_key, use_auth)

    if use_auth and not api_key:
        print("Error: API_KEY is missing but USE_AUTH is enabled.")
        print(f"Expected .env at: {env_path}")
        sys.exit(1)

    print("Agent ready.")
    print(f"- URL: {API_URL}")
    print(f"- Model: {model_name}")
    print(f"- Auth: {'on' if use_auth else 'off'}")
    print("Type your message. Use /exit to quit.\n")

    messages: list[dict] = []

    while True:
        try:
            user_text = input("> ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nExiting.")
            return

        if not user_text:
            continue
        if user_text.lower() in {"/exit", "/quit"}:
            print("Exiting.")
            return

        messages.append({"role": "user", "content": user_text})

        payload = {"model": model_name, "messages": messages}

        try:
            resp = requests.post(API_URL, headers=headers, json=payload, timeout=60)
        except requests.exceptions.ConnectionError:
            print("Connection error: Could not connect to API server.")
            print("Make sure the API server is running.")
            continue
        except requests.exceptions.Timeout:
            print("Timeout: API took too long to respond.")
            continue
        except requests.exceptions.RequestException as e:
            print(f"Request error: {e}")
            continue

        if resp.status_code == 200:
            try:
                data = resp.json()
            except json.JSONDecodeError:
                print("Invalid JSON response:")
                print(resp.text)
                continue

            assistant_text = extract_assistant_text(data)
            print(assistant_text)
            messages.append({"role": "assistant", "content": assistant_text})
            continue

        if resp.status_code == 401:
            print("Authentication failed (401):")
            print(resp.text)
            continue

        if resp.status_code == 400 and "unknown provider" in resp.text.lower():
            print("Invalid model/provider (400):")
            print(resp.text)
            print("\nTip: set env MODEL_NAME to a valid model.")
            maybe_print_available_models(headers)
            continue

        print(f"Request failed ({resp.status_code}):")
        print(resp.text)


if __name__ == "__main__":
    run_agent()


