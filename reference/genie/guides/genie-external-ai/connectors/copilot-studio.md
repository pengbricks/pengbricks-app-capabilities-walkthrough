# Microsoft Copilot Studio: Databricks Genie tool

Source: Databricks, [Use Databricks data in Microsoft Copilot Studio](https://docs.databricks.com/aws/en/integrations/msft-power-platform/copilot-studio). Genie Agents as Copilot Studio tools have been in Public Preview since November 14, 2025. Connecting Genie to Microsoft Copilot Cowork through the Genie managed MCP server has been in Beta since June 16, 2026.

Copilot Studio uses a Databricks connector, so there is no endpoint to paste. The Databricks page does not name the endpoint the connector calls.

## Steps

1. **Workspace admin.** Turn on **Managed MCP Servers** on the workspace Previews page.
2. **Author, in Databricks.** Give the Genie Agent a clear name and description. Copilot Studio uses them to decide when to call it.
3. **Power Platform.** Create a Databricks connection in Microsoft Power Platform.
4. **Copilot Studio.** Create or open an agent. Choose a model. Databricks recommends Sonnet 4.5 and does not list it as required.
5. Add this instruction: `Always continue polling the Genie Agent until you receive a response. Do not stop after a few seconds.`
6. Under **Tools**, add a tool. Search **Databricks** or select **Model Context Protocol**, choose **Databricks Genie**, pick your connection, and set the Agent ID to the Genie Agent ID (copy it from the agent's **Settings** tab).
7. Under **Settings**, **Orchestration**, set AI orchestration to **Yes**, then publish. Publish the agent to Microsoft Teams or Microsoft 365 to share it, or use it from Power Apps.

On Azure Databricks the tool is named Azure Databricks Genie. Use the Microsoft Learn version of the page.

## Sign-in model

Set by the Power Platform connection. The Databricks page does not say whether the connection signs in per user or uses a service principal, so check the connection type before you share the agent. A shared service principal gives every user the same view of the data.

## Not confirmed

- Rate limits and token limits are not documented on the page.
- Copilot Cowork setup steps are in the release note only. Read the Databricks docs before you use it.

## Data

Answers go to the Copilot Studio agent and to wherever you publish it. See the [Microsoft privacy statement](https://privacy.microsoft.com/en-us/privacystatement).
