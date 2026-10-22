# Microsoft Teams: the Databricks Genie app

Source: Databricks, [Databricks Genie app in Microsoft Teams](https://docs.databricks.com/aws/en/integrations/msft-teams). Beta from June 10, 2026. Public Preview from July 17, 2026. Sign-in by workspace URL since August 2026.

This is a packaged app. It needs no MCP URL or OAuth app connection. Your workspace URL is `https://<workspace-host>`.

## Steps

1. **Account admin.** In the account console, open **Previews** and enable **Databricks Genie for Microsoft Teams**. This is an account-level action.
2. **Microsoft 365 admin.** Find **Databricks Genie** in the Microsoft marketplace, install it, and approve the requested permissions (sign in and read the user profile, and maintain access to data you have granted it access to, plus the app's messaging permissions).
3. **Workspace admin.** Check the workspace security settings **Allow connection to collaboration platforms** and **Allow public messages in collaboration platforms**. With the second off, every response is private to the asker.
4. If users see **Need admin approval**, a Microsoft Entra administrator grants tenant-wide consent to the Databricks enterprise application.
5. **Each user.** In Teams, open **Apps**, then **Databricks Genie**, and ask a question. When prompted, select **Configure**, enter `https://<workspace-host>`, select **Continue**, and sign in to Databricks.
6. If the workspace uses IP access lists, add the East US 2 control plane outbound IPs.

## Sign-in model

Per user. Each person signs in with their own Databricks account, and the answer follows that person's Unity Catalog permissions.

## Limits

- File upload needs the Genie One File Upload preview (workspace admin) and OneDrive for Business. Up to 5 files per message and 20 MiB per file, in PDF, Word, or CSV. Direct messages only, not channels or group chats.
- Saving to PDF needs OneDrive and app version 1.0.17 or later. Documents over 20 MiB cannot be saved.

## Data

Questions and history are processed in the workspace region. Requests route through a central service in East US 2 that, per the docs, does not persist or log request or answer content. See the [Microsoft privacy statement](https://privacy.microsoft.com/en-us/privacystatement) for Teams.
