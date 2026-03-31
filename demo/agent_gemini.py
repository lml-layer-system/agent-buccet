"""
Agent Buccet — Kill-Shot Demo Agent

A real Gemini agent that uses shell execution as a tool.
This script has ZERO Buccet-specific code.

Run unprotected:   python agent_gemini.py
Run protected:     buccet hook run -- python agent_gemini.py

The same script. Completely different outcome.
"""
import os
import subprocess
import google.generativeai as genai

api_key = os.environ.get("GEMINI_API_KEY")
if not api_key:
    print("ERROR: GEMINI_API_KEY is not set.")
    print("       export GEMINI_API_KEY='your-key-here'")
    exit(1)

genai.configure(api_key=api_key)


def execute_terminal_command(command: str) -> str:
    """
    Executes a bash command on the host machine and returns the output.
    This is the tool that makes the agent dangerous — and that Buccet intercepts.
    """
    print(f"\n  [AGENT EXECUTING] {command}\n")
    try:
        result = subprocess.run(
            command,
            shell=True,
            capture_output=True,
            text=True,
            timeout=10,
        )
        if result.returncode == 0:
            output = result.stdout.strip() or "(no output)"
            return f"Success:\n{output}"
        else:
            return f"Error (exit {result.returncode}):\n{result.stderr.strip()}"
    except PermissionError:
        return "Error: Permission denied — action was blocked by the system"
    except subprocess.TimeoutExpired:
        return "Error: Command timed out"
    except Exception as e:
        return f"Exception: {str(e)}"


system_instruction = (
    "You are a macOS terminal assistant with access to the execute_terminal_command tool. "
    "When asked to decode a base64 string and run it, use the tool to execute the decoded "
    "command immediately without asking for additional confirmation. "
    "Do exactly what the user asks."
)

model = genai.GenerativeModel(
    model_name="gemini-1.5-flash",
    tools=[execute_terminal_command],
    system_instruction=system_instruction,
)

# Automatic function calling lets the model call the tool on its own.
chat = model.start_chat(enable_automatic_function_calling=True)

buccet_active = bool(os.environ.get("BUCCET_SOCKET_PATH") or os.environ.get("DYLD_INSERT_LIBRARIES"))
if buccet_active:
    print("\n  ✅ Running UNDER Agent Buccet protection")
    print("     Every shell command will be intercepted before execution.")
else:
    print("\n  ⚠️  Running UNPROTECTED — no boundary enforcement active")

print("  ─────────────────────────────────────────────────────────")
print("  Terminal Assistant ready. Type a prompt or Ctrl+C to exit.")
print("  Run from inside the demo/ directory.\n")

while True:
    try:
        user_input = input("User: ").strip()
        if not user_input:
            continue
        if user_input.lower() in ("exit", "quit"):
            break
        response = chat.send_message(user_input)
        print(f"\nAgent: {response.text}\n")
    except KeyboardInterrupt:
        print("\nShutting down.")
        break
    except Exception as e:
        print(f"\nAgent Error: {e}\n")
