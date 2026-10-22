# ChatGPT: custom MCP server

Source: OpenAI, [Connecting custom MCP servers in ChatGPT](https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt). Replace `<workspace-host>` with your workspace host, for example the host in your workspace URL without the path.

## Who can do it

- Business: workspace admins and owners create and publish custom MCP server connections.
- Enterprise and Edu: admins can give selected members permission to create them through RBAC. Only admins and owners publish.
- Custom MCP server connections work on ChatGPT web, not mobile.

## Steps

1. **Account admin, in Databricks.** In the account console, open **Settings**, **App connections**, **Add connection**. Enter the redirect URL ChatGPT gives you for this connector, select the `ai-gateway` scope, and generate a client secret if the ChatGPT form takes one. Save the client ID. Changes take up to 30 minutes. This is an account-level action.
2. **ChatGPT admin.** Open **Plugins**, select the plus button, then **Add custom MCP server**.
3. Enter a name and this endpoint:
   ```
   https://<workspace-host>/ai-gateway/mcp-services/system.ai.genie_one_mcp
   ```
   For one curated agent, use the Genie Agent endpoint instead (preview, scope `genie`, Managed MCP Servers on):
   ```
   https://<workspace-host>/api/2.0/mcp/genie/<genie-space-id>
   ```
4. Choose OAuth. Request `offline_access` so refresh tokens are issued. OpenAI notes that users may need to sign in again when access expires if the provider does not issue them.
5. Acknowledge the risk warning, select **Create as a plugin**, and review the discovered tools. Expect `genie_ask`, `genie_poll_response`, `genie_get_query_result`, `genie_cancel_response`.
6. Older workspaces show **Settings**, **Apps**, **Create** instead. Enter the endpoint, choose authentication, select **Scan Tools**, and finish OAuth.

## Sign-in model

Per user. Each person signs in to Databricks, and Unity Catalog checks that person on every call.

## Not confirmed

- Databricks does not support dynamic client registration. OpenAI's article does not say where its OAuth form takes a client ID and secret. Test the sign-in on a pilot workspace before a rollout.

## Data

Answers, generated SQL, and result rows go to ChatGPT. Retention follows your OpenAI plan: see the [OpenAI privacy policy](https://openai.com/policies/privacy-policy/).
