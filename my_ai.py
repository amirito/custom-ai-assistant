import inspect
import json
from dataclasses import dataclass, field
from typing import Any, Callable, Annotated, get_origin, get_args, Union, Final
import datetime
import getpass
import os

import requests
from rich.console import Console
from pypdf import PdfReader

@dataclass
class Tools:
    TOOL_SCHEMA_ATTR: Final[str] = "__tool_schema__"
    tools: dict[str, Callable[..., Any]] = field(default_factory=dict)

    @staticmethod
    def _annotaion_to_schema(annotation: Any) -> dict[str, Any]:
        schema: dict[str, Any] = {
            "type": "string"  # Default type
        }
        description: str | None = None
        origin = get_origin(annotation)
        if origin is Annotated:
            base_type, *meta = get_args(annotation)
            schema = Tools._annotaion_to_schema(base_type)
            if meta:
                description = str(meta[0])
        elif annotation in (int, float):
            schema = {"type": "number"}
        elif annotation is bool:
            schema = {"type": "boolean"}
        elif annotation is str:
            schema = {"type": "string"}
        elif annotation is dict:
            schema = {"type": "object"}
        elif annotation is list:
            schema = {"type": "array"}
        elif origin is list:
            item_type = get_args(annotation)[0]
            schema = {
                "type": "array",
                "items": Tools._annotaion_to_schema(get_args(annotation)[0])
            }
        elif origin is dict:
            schema = {"type": "object"}
        elif origin is Union:
            any_of = [
                Tools._annotaion_to_schema(arg) for arg in get_args(annotation)
                if arg is not type(None)  # Exclude NoneType
            ]

            if any_of:
                schema = any_of[0]

        if description:
            schema["description"] = description

        return schema

    @classmethod
    def schema_for_callable(cls, func: Callable[..., Any]) -> dict[str, Any]:
        sig = inspect.signature(func)
        annotations = inspect.get_annotations(func)
        parameters = {
            "type": "object",
            "properties": {},
            "required": [],
            "additionalProperties": False
        }
        for name, param in sig.parameters.items():
            annotation = annotations.get(name, inspect.Parameter.empty)

            if annotation is inspect.Parameter.empty:
                continue

            parameters["properties"][name] = cls._annotaion_to_schema(annotation)

            if param.default is param.empty:
                parameters["required"].append(name)

        return {
            "type": "function",
            "function": {
                "name": func.__name__,
                "description": func.__doc__ or "No description provided.",
                "parameters": parameters,
                "strict": True
            }
        }

    def get_schemas(self) -> list[dict[str, Any]]:
        out: list[dict[str, Any]] = []
        for fn in self.tools.values():
            s = getattr(fn, self.TOOL_SCHEMA_ATTR, None)
            if s is not None:
                out.append(s)
        return out

    def register(self, func: Callable[..., Any]) -> Callable[..., Any]:
        if getattr(func, self.TOOL_SCHEMA_ATTR, None) is None:
            schema = self.schema_for_callable(func)
            setattr(func, self.TOOL_SCHEMA_ATTR, schema)

        self.tools[func.__name__] = func
        return func

    def execute(self, tool_call: dict[str, Any]) -> dict[str, Any]:
        fn_payload = tool_call.get("function") or {}
        fn_name = fn_payload.get("name")
        fn = self.tools.get(fn_name) if fn_name else None
        if not fn:
            return {"error": f"Function '{fn_name}' not found."}

        try:
            args = json.loads(fn_payload.get("arguments", "{}"))
            result = fn(**args)
            return result if isinstance(result, dict) else {"result": result}
        except KeyboardInterrupt:
            raise
        except Exception as e:
            return {"error": str(e)}
        
        

@dataclass
class Agent:
    system_prompt: str = "You are Amir AI, a helpful assistant."
    model: str = "qwen2.5:7b"
    base_url: str = "http://localhost:11434/v1"
    api_key: str = "qwen2.5:7b"
    tools: Tools = field(default_factory=Tools)
    contexts: dict[str, Callable[[], str]] = field(default_factory=dict)
    messages: list[dict[str, Any]] = field(default_factory=list)

    def __post_init__(self) -> None:
        self.base_url = self.base_url.rstrip("/")

    def tool(self, func: Callable[..., Any]) -> Callable[..., Any]:
        return self.tools.register(func)

    def context(self, func: Callable[[], str]) -> Callable[[], str]:
        self.contexts[func.__name__] = func
        return func

    def chat(self, user_message: str, max_steps: int = 5) -> str:  # <--- تغییر ۱: اضافه کردن max_steps
        self.messages.append({"role": "user", "content": user_message})
        context_content = "\n\n".join(
            f"<context name='{name}'>\n{func()}\n</context>" for name, func in self.contexts.items()
        )
        system_content = self.system_prompt
        if context_content:
            system_content += f"\n\nContext Information:\n{context_content}"

        prefix: list[dict[str, Any]] = [
            {"role": "system", "content": system_content}
        ]

        for step in range(max_steps):  # <--- تغییر ۲: جایگزینی while True با حلقه محدود
            api_kwargs = {
                "model": self.model,
                "messages": prefix + self.messages,
                "temperature": 0.3
            }

            tool_schemas = self.tools.get_schemas()
            if tool_schemas:
                api_kwargs["tools"] = tool_schemas

            url = f"{self.base_url}/chat/completions"
            headers = {"Authorization": f"Bearer {self.api_key}"}
            response = requests.post(
                url,
                headers=headers,
                json=api_kwargs
            )
            response.raise_for_status()
            data = response.json()
            choices = data.get("choices", [])
            if not choices:
                raise ValueError(f"No choices returned from API. Response: {data}") 
            message = choices[0].get("message")
            if not message:
                raise ValueError(f"No message returned in the first choice. Response: {data}")

            tool_calls = message.get("tool_calls") or []
            print(f"[Step {step + 1}] Tool calls: {tool_calls}")  # <--- لاگ برای دیدن رفتار مدل

            assistant_msg: dict[str, Any] = {
                "role": "assistant",
                "content": message.get("content") or "",
            }

            if tool_calls:
                assistant_msg["tool_calls"] = tool_calls
            
            self.messages.append(assistant_msg)

            if not tool_calls:
                return message.get("content") or ""

            for tool_call in tool_calls:
                result = self.tools.execute(tool_call)
                self.messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.get("id"),
                    "content": json.dumps(result, ensure_ascii=False)  # <--- تغییر ۳: خوانا ماندن فارسی برای مدل
                })

        return "⚠️ Model reached maximum steps without providing a final answer. Please try again or simplify your request."

            # assistant_message = message.get("content") or ""
            # self.messages.append({"role": "assistant", "content": assistant_message})
            # return assistant_message

def main() -> None:
    agent = Agent(
        model="qwen2.5:7b",
        system_prompt=(
            "You are Amir AI, a helpful and honest local assistant. "
            "If you do not have accurate knowledge about a specific cultural topic, recipe, or fact, "
            "honestly admit that you don't know instead of guessing or making up information. "
            "Use tools only when the user asks to read PDFs or search files."
        ),
    )

    @agent.context
    def user_context() -> str:
        username = getpass.getuser()
        current_time = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        return f"User: {username}\nCurrent Time: {current_time}"

    @agent.tool
    def add(a: Annotated[int, "The first number to add"], b: Annotated[int, "The second number to add"]) -> dict[str, int]:
        """Add two numbers and return the result."""
        return {"result": a + b}

    @agent.tool
    def multiply(x: Annotated[int, "The first number to multiply"], y: Annotated[int, "The second number to multiply"]) -> dict[str, int]:
        """Multiply two numbers and return the result."""
        return {"result": x * y}

    @agent.tool
    def search_files(
        directory: Annotated[str, "The folder path to search in (e.g., '.' for current folder or '~/Desktop')"],
        keyword: Annotated[str, "Part of the filename or extension to look for (e.g., '.pdf' or 'report')"]
    ) -> dict[str, Any]:
        """Search for files matching a keyword inside a directory and its subfolders."""
        expanded_dir = os.path.expanduser(directory)
        if not os.path.exists(expanded_dir):
            return {"error": f"Directory '{directory}' does not exist."}

        matches: list[str] = []
        for root, _, files in os.walk(expanded_dir):
            for file in files:
                if keyword.lower() in file.lower():
                    matches.append(os.path.join(root, file))
                    if len(matches) >= 20:  # محدودیت برای جلوگیری از شلوغ شدن کانتکست مدل
                        return {"files": matches, "note": "Showing first 20 matches."}

        return {"files": matches}

    @agent.tool
    def read_pdf(
        file_path: Annotated[str, "The full or relative path to the PDF file"],
        max_pages: Annotated[int, "Maximum number of pages to read (default is 5)"] = 5
    ) -> dict[str, Any]:
        """Extract and return text content from a PDF file."""
        expanded_path = os.path.expanduser(file_path)
        if not os.path.isfile(expanded_path):
            return {"error": f"PDF file not found at '{file_path}'."}

        reader = PdfReader(expanded_path)
        total_pages = len(reader.pages)
        pages_to_read = min(total_pages, max_pages)

        extracted_text: list[str] = []
        for i in range(pages_to_read):
            page_text = reader.pages[i].extract_text() or ""
            extracted_text.append(f"--- Page {i + 1} ---\n{page_text}")

        return {
            "total_pages": total_pages,
            "pages_read": pages_to_read,
            "content": "\n\n".join(extracted_text)
        }

    # @agent.tool
    # def secret() -> dict[str, str]:
    #     """Return a secret key."""
    #     return {"result": "This is a secret key"}

    console = Console()

    while True:
        console.print("[bold green]You:[/bold green]", end=" ")
        user_input = console.input()

        if user_input.strip().lower() in {"exit", "quit"}:
            console.print("[bold red]Exiting...[/bold red]")
            return
        with console.status("[bold blue]Processing...[/bold blue]"):
            try:
                response = agent.chat(user_input).strip()
                console.print(f"[bold yellow]Amir AI:[/bold yellow] {response}")
            except Exception as e:
                console.print(f"[bold red]Error:[/bold red] {e}")

if __name__ == "__main__":
    main()