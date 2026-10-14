"""Tool-calling support assistant, written as an MLflow ResponsesAgent and logged from code.

The agent asks a Databricks-hosted chat model what to do and gives it one tool: a Unity Catalog function,
run on a SQL warehouse. On Model Serving the agent runs with credentials scoped to the resources declared
at logging time (the chat endpoint, the function, the table it reads, and the warehouse), so Unity Catalog
grants decide what the tool can touch.
"""

import json
import uuid

import mlflow
from databricks.sdk import WorkspaceClient
from mlflow.models import ModelConfig, set_model
from mlflow.pyfunc import ResponsesAgent
from mlflow.types.responses import ResponsesAgentRequest, ResponsesAgentResponse

CONFIG = ModelConfig(
    development_config={
        "llm_endpoint": "databricks-claude-haiku-5-5",
        "function": "main.default.order_status",
        "function_comment": "Look up one order by its numeric order id.",
        "warehouse_id": "",
        "system_prompt": "You are a support assistant.",
        "max_tool_rounds": 4,
    }
)

TOOL_NAME = "order_status"


class SupportAssistant(ResponsesAgent):
    def __init__(self) -> None:
        self.cfg = CONFIG
        self._w = None

    @property
    def w(self) -> WorkspaceClient:
        if self._w is None:
            self._w = WorkspaceClient()
        return self._w

    @property
    def tools(self) -> list[dict]:
        return [{
            "type": "function",
            "function": {
                "name": TOOL_NAME,
                "description": self.cfg.get("function_comment"),
                "parameters": {
                    "type": "object",
                    "properties": {"order_id": {"type": "integer", "description": "Numeric order id, for example 1042"}},
                    "required": ["order_id"],
                },
            },
        }]

    @mlflow.trace(span_type="TOOL", name="uc_function_tool")
    def _call_tool(self, order_id: int) -> str:
        # order_id is cast to int, so the statement cannot carry anything else.
        result = self.w.statement_execution.execute_statement(
            statement=f"SELECT {self.cfg.get('function')}({int(order_id)}) AS result",
            warehouse_id=self.cfg.get("warehouse_id"),
            wait_timeout="30s",
        )
        if result.status.state.value != "SUCCEEDED":
            return f"ERROR: {result.status.error.message if result.status.error else result.status.state.value}"
        return str(result.result.data_array[0][0]) if result.result and result.result.data_array else "no result"

    @mlflow.trace(span_type="LLM", name="chat_model")
    def _llm(self, messages: list[dict]):
        client = self.w.serving_endpoints.get_open_ai_client()
        return client.chat.completions.create(model=self.cfg.get("llm_endpoint"), messages=messages, tools=self.tools, max_tokens=2000)

    def predict(self, request: ResponsesAgentRequest) -> ResponsesAgentResponse:
        messages = [{"role": "system", "content": self.cfg.get("system_prompt")}]
        messages += self.prep_msgs_for_cc_llm([i.model_dump() for i in request.input])
        text = ""
        for _ in range(int(self.cfg.get("max_tool_rounds"))):
            msg = self._llm(messages).choices[0].message
            if not msg.tool_calls:
                content = msg.content
                # Some models return a list of parts, including reasoning blocks; keep the text parts.
                text = content if isinstance(content, str) else "".join(
                    part.get("text", "") for part in content or [] if isinstance(part, dict) and part.get("type") == "text"
                )
                break
            messages.append(msg.model_dump(exclude_none=True))
            for call in msg.tool_calls:
                args = json.loads(call.function.arguments or "{}")
                messages.append({"role": "tool", "tool_call_id": call.id, "content": self._call_tool(args["order_id"])})
        else:
            text = "I could not finish the lookup within the tool limit."
        return ResponsesAgentResponse(output=[self.create_text_output_item(text, str(uuid.uuid4()))])


set_model(SupportAssistant())
